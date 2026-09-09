import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Supabase client singleton.
 *
 * Env vars are read at bundle time via `process.env.EXPO_PUBLIC_*` — the
 * Expo v54 convention that inlines these into the JS bundle. See
 * `.env.example` for the full list.
 *
 * When either env var is missing (fresh checkout, CI without secrets, a
 * local `.env` that hasn't been filled in yet) the client is `null` and
 * every consumer must guard on that. `isSupabaseConfigured()` is the
 * canonical check — the auth store uses it to fall through into an
 * "cloud-not-configured" state so the rest of the app keeps working
 * offline instead of crashing at startup.
 *
 * Two prerender/SSR pitfalls this file guards against:
 *
 * 1. Expo Router's `expo export -p web` prerenders every route in Node.
 *    There is no `window` there, and `AsyncStorage`'s web adapter reaches
 *    into `window.localStorage` at the first `getItem` call — which
 *    GoTrueClient's constructor triggers via `_emitInitialSession`. We
 *    return `null` when `window` is missing so no client is created and
 *    prerender walks past this module cleanly.
 *
 * 2. On native we pass `AsyncStorage`. On web (in the browser) we
 *    intentionally do NOT pass a storage adapter — supabase-js defaults
 *    to `localStorage`, which is the right thing for the web bundle and
 *    avoids the AsyncStorage-web shim entirely.
 */

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Decide what environment this file is being evaluated in. `Platform.OS`
 * is not reliable during Expo Router's static prerender pass — Vercel
 * has been observed to enter this module without `Platform.OS === 'web'`,
 * which meant the earlier "skip if web + no window" guard didn't fire.
 * These duck-type checks are portable and don't depend on the RN
 * platform module.
 */
function detectEnvironment(): 'browser' | 'native' | 'ssr' {
  // React Native (native) sets `navigator.product = 'ReactNative'` but
  // has no `document`. This is the standard React Native detection trick.
  if (typeof navigator !== 'undefined' && (navigator as { product?: string }).product === 'ReactNative') {
    return 'native';
  }
  // Browsers have both `window` and `document`. Prerender/SSR has neither.
  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    return 'browser';
  }
  return 'ssr';
}

function buildClient(): SupabaseClient | null {
  if (!url || !anonKey) return null;

  const env = detectEnvironment();

  // Prerender / SSR: construct nothing. GoTrueClient's constructor
  // eagerly calls `_emitInitialSession` which hits the storage adapter;
  // on web that adapter reaches for `window.localStorage` and blows up
  // in Node. The runtime bundle re-evaluates this module in the browser
  // where all the necessary globals are present.
  if (env === 'ssr') return null;

  return createClient(url, anonKey, {
    auth: {
      // Native: hand Supabase our AsyncStorage adapter so the session
      // survives app restarts. Browser: intentionally omit `storage`
      // and let supabase-js use its default (`localStorage`), which is
      // the right adapter for the web bundle and does not go through
      // the AsyncStorage web shim.
      ...(env === 'native' ? { storage: AsyncStorage } : {}),
      autoRefreshToken: true,
      persistSession: true,
      // OAuth on web returns to the app with the code in the URL hash;
      // let Supabase parse it out. Not applicable on native.
      detectSessionInUrl: env === 'browser',
      flowType: 'pkce',
    },
  });
}

export const supabase: SupabaseClient | null = buildClient();

export function isSupabaseConfigured(): boolean {
  return supabase !== null;
}
