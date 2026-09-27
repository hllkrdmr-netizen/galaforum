/**
 * Public runtime configuration. Only EXPO_PUBLIC_* values are bundled into the client.
 * Never place a Supabase service-role key here.
 */
export const env = {
  supabaseUrl: (process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').trim(),
  supabaseAnonKey: (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '').trim(),
};

export const isSupabaseConfigured = env.supabaseUrl.startsWith('https://') && env.supabaseAnonKey.length > 20;
