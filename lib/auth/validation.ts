/** Pure auth helpers (no React Native imports) so they can be unit tested with node:test. */

export const USERNAME_PATTERN = /^[a-z0-9_]{3,24}$/;
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 72; // bcrypt limit used by Supabase Auth

export type AuthErrorCode =
  | 'invalid_credentials'
  | 'email_not_confirmed'
  | 'weak_password'
  | 'rate_limited'
  | 'username_taken'
  | 'validation'
  | 'session_missing'
  | 'unavailable'
  | 'network'
  | 'unknown';

export class AuthError extends Error {
  readonly code: AuthErrorCode;

  constructor(message: string, code: AuthErrorCode = 'unknown') {
    super(message);
    this.name = 'AuthError';
    this.code = code;
  }
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function validateEmail(email: string): string | null {
  const e = normalizeEmail(email);
  if (!e) return 'E-posta adresini yaz.';
  if (e.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e)) return 'Geçerli bir e-posta adresi yaz.';
  return null;
}

export function validatePassword(password: string): string | null {
  if (password.length < PASSWORD_MIN) return `Şifre en az ${PASSWORD_MIN} karakter olmalı.`;
  if (password.length > PASSWORD_MAX) return `Şifre en fazla ${PASSWORD_MAX} karakter olabilir.`;
  if (!/[A-Za-zÇĞİÖŞÜçğıöşü]/.test(password) || !/\d/.test(password)) return 'Şifre en az bir harf ve bir rakam içermeli.';
  return null;
}

export function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

export function validateUsername(username: string): string | null {
  const u = normalizeUsername(username);
  if (!USERNAME_PATTERN.test(u)) return 'Kullanıcı adı 3–24 karakter olmalı; yalnızca a-z, 0-9 ve _ kullanılabilir.';
  if (u.startsWith('silinmis_')) return 'Bu kullanıcı adı kullanılamaz.';
  return null;
}

export interface SignUpInput {
  username: string;
  email: string;
  password: string;
  passwordConfirm: string;
  /** Topluluk kuralları, kullanım koşulları ve gizlilik metni onayı (store requirement for UGC apps). */
  acceptedTerms: boolean;
}

export type SignUpErrors = Partial<Record<keyof SignUpInput, string>>;

export function validateSignUp(input: SignUpInput): SignUpErrors {
  const errors: SignUpErrors = {};
  const u = validateUsername(input.username);
  if (u) errors.username = u;
  const e = validateEmail(input.email);
  if (e) errors.email = e;
  const p = validatePassword(input.password);
  if (p) errors.password = p;
  if (input.password !== input.passwordConfirm) errors.passwordConfirm = 'Şifreler eşleşmiyor.';
  if (!input.acceptedTerms) errors.acceptedTerms = 'Devam etmek için kuralları ve koşulları kabul etmelisin.';
  return errors;
}

/** Maps Supabase Auth errors to clear Turkish messages. Never reveals whether an e-mail exists. */
export function mapAuthError(error: { message?: string; code?: string; status?: number } | null | undefined): AuthError {
  const code = error?.code ?? '';
  const msg = (error?.message ?? '').toLowerCase();
  if (code === 'invalid_credentials' || msg.includes('invalid login credentials')) {
    return new AuthError('E-posta veya şifre hatalı.', 'invalid_credentials');
  }
  if (code === 'email_not_confirmed' || msg.includes('email not confirmed')) {
    return new AuthError('E-posta adresin henüz doğrulanmadı. Gelen kutunu kontrol et.', 'email_not_confirmed');
  }
  if (code === 'weak_password' || msg.includes('password should')) {
    return new AuthError('Şifre yeterince güçlü değil. Daha uzun ve tahmin edilmesi zor bir şifre seç.', 'weak_password');
  }
  if (code === 'same_password') {
    return new AuthError('Yeni şifre eskisiyle aynı olamaz.', 'weak_password');
  }
  if (code.startsWith('over_') || error?.status === 429 || msg.includes('rate limit')) {
    return new AuthError('Çok fazla deneme yapıldı. Biraz bekleyip tekrar dene.', 'rate_limited');
  }
  if (code === 'session_not_found' || code === 'refresh_token_not_found' || msg.includes('auth session missing')) {
    return new AuthError('Oturumun sona ermiş. Lütfen tekrar giriş yap.', 'session_missing');
  }
  if (code === 'email_address_invalid') return new AuthError('Geçerli bir e-posta adresi yaz.', 'validation');
  if (code === 'signup_disabled') return new AuthError('Yeni üyelikler şu an kapalı.', 'unavailable');
  if (msg.includes('fetch') || msg.includes('network')) {
    return new AuthError('Bağlantı kurulamadı. İnternetini kontrol edip tekrar dene.', 'network');
  }
  return new AuthError('İşlem tamamlanamadı. Lütfen tekrar dene.', 'unknown');
}

export interface AuthCallbackParams {
  code?: string;
  next?: string;
  accessToken?: string;
  refreshToken?: string;
  errorDescription?: string;
}

/** Reads auth redirect parameters from both the query string (PKCE) and the hash fragment (implicit). */
export function parseAuthCallback(url: string): AuthCallbackParams {
  const out: AuthCallbackParams = {};
  const [beforeHash, hash = ''] = url.split('#');
  const query = beforeHash.includes('?') ? beforeHash.slice(beforeHash.indexOf('?') + 1) : '';
  for (const part of [query, hash]) {
    const params = new URLSearchParams(part);
    const get = (k: string) => params.get(k) ?? undefined;
    out.code ??= get('code');
    out.next ??= get('next');
    out.accessToken ??= get('access_token');
    out.refreshToken ??= get('refresh_token');
    out.errorDescription ??= get('error_description') ?? get('error');
  }
  for (const key of Object.keys(out) as Array<keyof AuthCallbackParams>) {
    if (out[key] === undefined) delete out[key];
  }
  return out;
}

/** Only allow known in-app destinations after an auth redirect (prevents open redirects). */
export function safeNextRoute(next: string | undefined): '/yeni-sifre' | '/hesap' {
  return next === 'yeni-sifre' ? '/yeni-sifre' : '/hesap';
}

/** Return-path after sign-in: only same-app absolute paths, never auth screens or external URLs. */
export function safeReturnPath(path: string | undefined): string {
  if (!path || !path.startsWith('/') || path.startsWith('//') || path.includes('://')) return '/hesap';
  if (['/giris', '/kayit', '/sifre-sifirla', '/auth-callback'].some((p) => path.startsWith(p))) return '/hesap';
  return path;
}
