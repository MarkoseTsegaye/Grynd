import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { Platform } from 'react-native';
import type { Session, User } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from '../../../lib/supabase';

/**
 * Auth store — the source of truth for whether the current user is signed
 * in and, if so, whether they've attached a real identity or are still
 * running as an anonymous account.
 *
 * The core flow (see plan-of-record):
 *
 *   1. First launch → `bootstrap()` calls `signInAnonymously()`. User gets
 *      a real UID immediately, no sign-in wall, can log workouts.
 *   2. Any time later → they can sign in via Apple / Google / email OTP.
 *      All existing data stays attached to the same UID because we use
 *      `linkIdentity` (OAuth) or `updateUser({ email })` + OTP, NOT a
 *      fresh sign-in that would create a new account.
 *   3. Sign out → clears the session. On next launch we re-bootstrap into
 *      a NEW anonymous account (the previous data is safely on the server
 *      attached to the previous UID; signing back in with the same
 *      identity recovers it).
 *
 * When Supabase is not configured (no env vars), we set `status =
 * 'unconfigured'` and every action becomes a no-op. This keeps the app
 * working offline for local dev / tests / CI without secrets.
 */

export type AuthStatus =
  | 'idle'
  | 'bootstrapping'
  | 'anonymous'
  | 'identified'
  | 'unconfigured'
  | 'error';

interface AuthState {
  status: AuthStatus;
  session: Session | null;
  user: User | null;
  errorMessage: string | null;
  /** true iff a sign-in method call is in flight (used by the sheet's spinner). */
  isSigningIn: boolean;

  bootstrap: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  /** Sends the magic-link email. The link back into the app calls back into Supabase to complete. */
  sendEmailOtp: (email: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  /** Called from the deep-link handler once the user pastes/opens the token. */
  verifyEmailOtp: (
    email: string,
    token: string,
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
  signOut: () => Promise<void>;
  /**
   * Deletes the current user's server-side account (via the
   * `delete_user()` RPC — see supabase/migrations/002_delete_user.sql)
   * and wipes every local AsyncStorage key. Sign-out follows so the
   * next launch bootstraps a fresh anonymous account.
   *
   * Irreversible. UI must confirm before calling.
   */
  deleteAccount: () => Promise<{ ok: true } | { ok: false; error: string }>;
}

function pickStatusFromUser(user: User | null): AuthStatus {
  if (!user) return 'idle';
  // Supabase marks anonymous users with `is_anonymous: true` on the JWT and
  // the user record. Older clients don't have the field on User — fall back
  // to the app_metadata provider list being empty.
  const providers = (user.app_metadata?.providers as string[] | undefined) ?? [];
  const isAnon =
    (user as User & { is_anonymous?: boolean }).is_anonymous === true ||
    providers.length === 0;
  return isAnon ? 'anonymous' : 'identified';
}

/**
 * The deep-link scheme the OAuth provider redirects back to. On native we
 * use the Expo scheme configured in `app.config.ts` (`workout-logger://`);
 * on web the browser stays in the same origin.
 */
function getOAuthRedirectTo(): string | undefined {
  if (Platform.OS === 'web') {
    if (typeof window === 'undefined') return undefined;
    return `${window.location.origin}/`;
  }
  return 'workout-logger://auth-callback';
}

export const useAuthStore = create<AuthState>()(
  devtools(
    (set, get) => ({
      status: 'idle',
      session: null,
      user: null,
      errorMessage: null,
      isSigningIn: false,

      bootstrap: async () => {
        if (!isSupabaseConfigured() || !supabase) {
          set({ status: 'unconfigured' });
          return;
        }

        set({ status: 'bootstrapping', errorMessage: null });

        try {
          const { data: sessionData } = await supabase.auth.getSession();

          if (sessionData.session) {
            const user = sessionData.session.user;
            set({
              session: sessionData.session,
              user,
              status: pickStatusFromUser(user),
            });
          } else {
            // First launch — no session. Create an anonymous user silently
            // so the app can start writing data through the sync layer with
            // a real UID from second one.
            const { data, error } = await supabase.auth.signInAnonymously();
            if (error) {
              set({ status: 'error', errorMessage: error.message });
              return;
            }
            set({
              session: data.session,
              user: data.user,
              status: pickStatusFromUser(data.user),
            });
          }

          // Keep the store in sync with any subsequent auth changes
          // (token refresh, sign-out from another tab, etc). Idempotent —
          // Supabase de-dupes duplicate subscriptions internally.
          supabase.auth.onAuthStateChange((_event, session) => {
            set({
              session,
              user: session?.user ?? null,
              status: session?.user ? pickStatusFromUser(session.user) : 'idle',
            });
          });
        } catch (err) {
          set({
            status: 'error',
            errorMessage: err instanceof Error ? err.message : String(err),
          });
        }
      },

      signInWithApple: async () => {
        if (!supabase) return;
        set({ isSigningIn: true, errorMessage: null });
        try {
          // signInWithOAuth opens a browser (native) or redirects (web).
          // The `redirectTo` value is where Supabase sends the user after
          // the identity is granted. Our `bootstrap` subscription picks up
          // the resulting session automatically.
          const { error } = await supabase.auth.signInWithOAuth({
            provider: 'apple',
            options: { redirectTo: getOAuthRedirectTo() },
          });
          if (error) {
            set({ errorMessage: error.message });
          }
        } finally {
          set({ isSigningIn: false });
        }
      },

      signInWithGoogle: async () => {
        if (!supabase) return;
        set({ isSigningIn: true, errorMessage: null });
        try {
          const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: { redirectTo: getOAuthRedirectTo() },
          });
          if (error) {
            set({ errorMessage: error.message });
          }
        } finally {
          set({ isSigningIn: false });
        }
      },

      sendEmailOtp: async (email) => {
        if (!supabase) return { ok: false, error: 'Cloud sign-in is not configured.' };
        set({ isSigningIn: true, errorMessage: null });
        try {
          // If the current session is anonymous, attach the identity to
          // THIS user rather than creating a new one. updateUser({email})
          // triggers a confirm-email flow whose OTP we verify below with
          // type: 'email_change'. Net effect: the UID stays the same, so
          // all locally-synced data lives under one account after sign-in.
          //
          // For a fresh (non-anonymous) session, fall through to the
          // standard signInWithOtp flow.
          const currentUser = get().user;
          const isAnon =
            currentUser &&
            ((currentUser as User & { is_anonymous?: boolean }).is_anonymous === true ||
              ((currentUser.app_metadata?.providers as string[] | undefined) ?? []).length === 0);

          if (isAnon) {
            const { error } = await supabase.auth.updateUser({ email });
            if (error) {
              set({ errorMessage: error.message });
              return { ok: false, error: error.message };
            }
            return { ok: true };
          }

          const { error } = await supabase.auth.signInWithOtp({
            email,
            options: {
              // shouldCreateUser: true is the default. It's still explicit
              // here so a future switch to invite-only email links is one
              // line away.
              shouldCreateUser: true,
              emailRedirectTo: getOAuthRedirectTo(),
            },
          });
          if (error) {
            set({ errorMessage: error.message });
            return { ok: false, error: error.message };
          }
          return { ok: true };
        } finally {
          set({ isSigningIn: false });
        }
      },

      verifyEmailOtp: async (email, token) => {
        if (!supabase) return { ok: false, error: 'Cloud sign-in is not configured.' };
        set({ isSigningIn: true, errorMessage: null });
        try {
          // Mirror sendEmailOtp: if the current session is anonymous,
          // this token came from updateUser({email})'s confirmation email
          // and verifies via type: 'email_change' — attaching the
          // identity to the same UID. Otherwise it's a plain OTP sign-in.
          const currentUser = get().user;
          const isAnon =
            currentUser &&
            ((currentUser as User & { is_anonymous?: boolean }).is_anonymous === true ||
              ((currentUser.app_metadata?.providers as string[] | undefined) ?? []).length === 0);

          const { data, error } = await supabase.auth.verifyOtp(
            isAnon
              ? { email, token, type: 'email_change' }
              : { email, token, type: 'email' },
          );
          if (error) {
            set({ errorMessage: error.message });
            return { ok: false, error: error.message };
          }
          if (data.session) {
            set({
              session: data.session,
              user: data.user,
              status: pickStatusFromUser(data.user),
            });
          }
          return { ok: true };
        } finally {
          set({ isSigningIn: false });
        }
      },

      signOut: async () => {
        if (!supabase) return;
        // Note the intentional design: after sign-out we do NOT
        // automatically re-bootstrap into a new anonymous account. The
        // caller (app root) handles the next-launch re-bootstrap. This
        // keeps the sign-out action predictable: it only signs out.
        await supabase.auth.signOut();
        set({ session: null, user: null, status: 'idle' });
        void get();
      },

      deleteAccount: async () => {
        if (!supabase) {
          return { ok: false, error: 'Cloud sign-in is not configured.' };
        }
        set({ isSigningIn: true, errorMessage: null });
        try {
          // 1. Server-side delete via the RPC. Cascades wipe the user's
          //    rows in every data table. If the migration hasn't been
          //    applied on the target project this errors out — the
          //    caller surfaces the message so the user knows they can
          //    email support.
          const { error: rpcError } = await supabase.rpc('delete_user');
          if (rpcError) {
            set({ errorMessage: rpcError.message });
            return { ok: false, error: rpcError.message };
          }

          // 2. Wipe every local AsyncStorage key so the next launch
          //    doesn't restore stale data. `getAllKeys` + `multiRemove`
          //    is safer than clear() — it leaves alone any keys owned
          //    by libraries we don't manage (Supabase itself, expo,
          //    etc). We match by our own prefixes.
          try {
            const AsyncStorage = (
              await import('@react-native-async-storage/async-storage')
            ).default;
            const keys = await AsyncStorage.getAllKeys();
            const ours = keys.filter(
              (k) =>
                k.startsWith('splits:') ||
                k.startsWith('exercises:') ||
                k.startsWith('sessions:') ||
                k.startsWith('cycle:') ||
                k.startsWith('prefs:') ||
                k.startsWith('weight:') ||
                k.startsWith('sync:') ||
                k.startsWith('auth:'),
            );
            if (ours.length > 0) await AsyncStorage.multiRemove(ours);
          } catch {
            // Non-fatal: the account is gone server-side; stale local
            // data will be overwritten by the next fresh bootstrap.
          }

          // 3. Sign out so onAuthStateChange emits the transition and
          //    the sync engine unbinds.
          await supabase.auth.signOut();
          set({ session: null, user: null, status: 'idle' });
          return { ok: true };
        } finally {
          set({ isSigningIn: false });
        }
      },
    }),
    { name: 'AuthStore', enabled: process.env.APP_ENV === 'development' },
  ),
);
