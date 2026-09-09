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
 */

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const supabase: SupabaseClient | null =
  url && anonKey
    ? createClient(url, anonKey, {
        auth: {
          // Persist the session across app restarts. On web, Supabase falls
          // back to localStorage under the hood — we still pass the same
          // storage adapter so the codepath stays uniform.
          storage: AsyncStorage,
          autoRefreshToken: true,
          persistSession: true,
          // React Native does not have URLSearchParams support that
          // Supabase's browser flow assumes for OAuth redirects. `pkce` is
          // safer and works everywhere.
          detectSessionInUrl: Platform.OS === 'web',
          flowType: 'pkce',
        },
      })
    : null;

export function isSupabaseConfigured(): boolean {
  return supabase !== null;
}
