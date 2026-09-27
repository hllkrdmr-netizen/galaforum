import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';

import { env, isSupabaseConfigured } from './env';

let client: SupabaseClient | null = null;

/** Lazily creates the Supabase client. Returns null when the project is not configured. */
export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured) return null;
  if (!client) {
    client = createClient(env.supabaseUrl, env.supabaseAnonKey, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        // PKCE on every platform; e-mail links are exchanged explicitly in app/auth-callback.tsx.
        flowType: 'pkce',
        detectSessionInUrl: false,
      },
    });
  }
  return client;
}
