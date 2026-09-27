/**
 * Public runtime configuration. Only EXPO_PUBLIC_* values are bundled into the client.
 * Never place a Supabase service-role key here.
 */
export const env = {
  supabaseUrl: (process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').trim(),
  supabaseAnonKey: (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '').trim(),
  /** Shown in the legal pages; required before a store release (see docs/RELEASE.md). */
  contactEmail: (process.env.EXPO_PUBLIC_CONTACT_EMAIL ?? '').trim(),
  /** Data controller (KVKK "veri sorumlusu"): the person or company operating GalaForum. */
  operatorName: (process.env.EXPO_PUBLIC_OPERATOR_NAME ?? '').trim(),
};

export const isSupabaseConfigured = env.supabaseUrl.startsWith('https://') && env.supabaseAnonKey.length > 20;
