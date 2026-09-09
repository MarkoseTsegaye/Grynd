import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

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

function buildClient(): SupabaseClient | null {
  if (!url || !anonKey) return null;

  // Guard against the Node prerender pass: no window means no browser
  // storage and no OAuth-URL parsing to do. The runtime bundle re-runs
  // this file on the client where `window` is present.
  if (Platform.OS === 'web' && typeof window === 'undefined') return null;

  const isWeb = Platform.OS === 'web';

  return createClient(url, anonKey, {
    auth: {
      // On native we hand Supabase our AsyncStorage adapter so the
      // session survives app restarts. On web supabase-js's default is
      // `localStorage`, which is what we want — passing AsyncStorage
      // here forces its web shim to reach into `window.localStorage`
      // and blows up under Node prerender.
      ...(isWeb ? {} : { storage: AsyncStorage }),
      autoRefreshToken: true,
      persistSession: true,
      // OAuth on web returns to the app with the code in the URL hash;
      // let Supabase parse it out. Not applicable on native.
      detectSessionInUrl: isWeb,
      flowType: 'pkce',
    },
  });
}

export const supabase: SupabaseClient | null = buildClient();

export function isSupabaseConfigured(): boolean {
  return supabase !== null;
}
