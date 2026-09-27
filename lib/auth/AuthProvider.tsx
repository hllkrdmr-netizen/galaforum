import type { Session, SupabaseClient, User } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { AppState, Platform } from 'react-native';

import { invalidateQueries } from '../../hooks/useForumQuery';
import type { AuthorSummary, UserRole } from '../../types/forum';
import { notifications } from '../../services/notifications';
import { disablePushOnThisDevice } from '../push';
import { LEGAL_VERSION } from '../legal';
import { getSupabase } from '../supabase';
import {
  AuthError,
  mapAuthError,
  normalizeEmail,
  normalizeUsername,
  validateEmail,
  validatePassword,
  validateSignUp,
  validateUsername,
} from './validation';
import type { SignUpInput } from './validation';

export type AuthStatus = 'loading' | 'signedOut' | 'signedIn' | 'unavailable';

export interface AuthContextValue {
  status: AuthStatus;
  session: Session | null;
  user: User | null;
  profile: AuthorSummary | null;
  signIn(email: string, password: string): Promise<void>;
  /** Returns true when the account needs e-mail verification before the first sign-in. */
  signUp(input: SignUpInput): Promise<{ needsVerification: boolean }>;
  signOut(): Promise<void>;
  resendVerification(email: string): Promise<void>;
  requestPasswordReset(email: string): Promise<void>;
  updatePassword(password: string): Promise<void>;
  updateUsername(username: string): Promise<void>;
  deleteAccount(): Promise<void>;
  refreshProfile(): Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const DEMO_MESSAGE =
  'Demo modunda hesap işlemleri kapalı. Gerçek üyelik için Supabase bağlantısını (.env) yapılandır.';

/** Where Supabase e-mail links send the user back to (must be in Supabase Auth → URL Configuration). */
export function authRedirectUrl(next?: 'yeni-sifre'): string {
  return Linking.createURL('/auth-callback', next ? { queryParams: { next } } : undefined);
}

function requireClient(sb: SupabaseClient | null): SupabaseClient {
  if (!sb) throw new AuthError(DEMO_MESSAGE, 'unavailable');
  return sb;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const sb = useMemo(() => getSupabase(), []);
  const [status, setStatus] = useState<AuthStatus>(sb ? 'loading' : 'unavailable');
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<AuthorSummary | null>(null);

  const loadProfile = useCallback(
    async (uid: string | undefined) => {
      if (!sb || !uid) {
        setProfile(null);
        return;
      }
      const { data } = await sb.from('profiles').select('id, username, avatar_url, role').eq('id', uid).maybeSingle();
      const row = data as { id: string; username: string; avatar_url: string | null; role: UserRole } | null;
      setProfile(row ? { id: row.id, username: row.username, avatarUrl: row.avatar_url, role: row.role } : null);
    },
    [sb],
  );

  useEffect(() => {
    if (!sb) return;
    let active = true;
    sb.auth
      .getSession()
      .then(({ data }) => {
        if (!active) return;
        setSession(data.session);
        setStatus(data.session ? 'signedIn' : 'signedOut');
        void loadProfile(data.session?.user.id);
      })
      .catch(() => active && setStatus('signedOut'));

    const { data: sub } = sb.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setStatus(next ? 'signedIn' : 'signedOut');
      void loadProfile(next?.user.id);
      // Per-user data (likes, votes, inbox) must be refetched when the identity changes.
      invalidateQueries('forum:');
      invalidateQueries('notif:');
      invalidateQueries('mod:');
    });

    // Native apps: only refresh tokens while in the foreground (recommended by Supabase).
    const appState =
      Platform.OS === 'web'
        ? null
        : AppState.addEventListener('change', (s) => {
            if (s === 'active') void sb.auth.startAutoRefresh();
            else void sb.auth.stopAutoRefresh();
          });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
      appState?.remove();
    };
  }, [sb, loadProfile]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      session,
      user: session?.user ?? null,
      profile,

      async signIn(email, password) {
        const client = requireClient(sb);
        const emailError = validateEmail(email);
        if (emailError) throw new AuthError(emailError, 'validation');
        if (!password) throw new AuthError('Şifreni yaz.', 'validation');
        const { error } = await client.auth.signInWithPassword({ email: normalizeEmail(email), password });
        if (error) throw mapAuthError(error);
      },

      async signUp(input) {
        const client = requireClient(sb);
        const errors = validateSignUp(input);
        const first = Object.values(errors).find(Boolean);
        if (first) throw new AuthError(first, 'validation');
        const username = normalizeUsername(input.username);
        const { data: available, error: availErr } = await client.rpc('username_available', { p_username: username });
        if (availErr) throw mapAuthError(availErr);
        if (available === false) throw new AuthError('Bu kullanıcı adı alınmış. Başka bir ad dene.', 'username_taken');
        const { data, error } = await client.auth.signUp({
          email: normalizeEmail(input.email),
          password: input.password,
          // The accepted legal version is kept in the auth user's metadata as the record of consent.
          options: { data: { username, terms_version: LEGAL_VERSION }, emailRedirectTo: authRedirectUrl() },
        });
        if (error) throw mapAuthError(error);
        // With e-mail confirmation enabled Supabase returns no session until the link is opened.
        return { needsVerification: !data.session };
      },

      async signOut() {
        const client = requireClient(sb);
        // Stop pushes to this device for the member who is leaving (no-op if push was never enabled).
        await disablePushOnThisDevice(notifications);
        const { error } = await client.auth.signOut();
        if (error) throw mapAuthError(error);
      },

      async resendVerification(email) {
        const client = requireClient(sb);
        const emailError = validateEmail(email);
        if (emailError) throw new AuthError(emailError, 'validation');
        const { error } = await client.auth.resend({
          type: 'signup',
          email: normalizeEmail(email),
          options: { emailRedirectTo: authRedirectUrl() },
        });
        if (error) throw mapAuthError(error);
      },

      async requestPasswordReset(email) {
        const client = requireClient(sb);
        const emailError = validateEmail(email);
        if (emailError) throw new AuthError(emailError, 'validation');
        const { error } = await client.auth.resetPasswordForEmail(normalizeEmail(email), {
          redirectTo: authRedirectUrl('yeni-sifre'),
        });
        // Rate limits are surfaced; any other outcome is reported as success to avoid e-mail enumeration.
        if (error && mapAuthError(error).code === 'rate_limited') throw mapAuthError(error);
      },

      async updatePassword(password) {
        const client = requireClient(sb);
        const passwordError = validatePassword(password);
        if (passwordError) throw new AuthError(passwordError, 'validation');
        const { error } = await client.auth.updateUser({ password });
        if (error) throw mapAuthError(error);
      },

      async updateUsername(username) {
        const client = requireClient(sb);
        const uid = session?.user.id;
        if (!uid) throw new AuthError('Oturumun sona ermiş. Lütfen tekrar giriş yap.', 'session_missing');
        const usernameError = validateUsername(username);
        if (usernameError) throw new AuthError(usernameError, 'validation');
        const next = normalizeUsername(username);
        if (next === profile?.username) return;
        const { error } = await client.from('profiles').update({ username: next }).eq('id', uid);
        if (error) {
          if (error.code === '23505') throw new AuthError('Bu kullanıcı adı alınmış. Başka bir ad dene.', 'username_taken');
          throw mapAuthError(error);
        }
        await loadProfile(uid);
        invalidateQueries('forum:');
      },

      async deleteAccount() {
        const client = requireClient(sb);
        const { error } = await client.rpc('delete_my_account');
        if (error) throw mapAuthError(error);
        // The server already removed the identity; clear the local session only.
        await client.auth.signOut({ scope: 'local' });
        invalidateQueries('forum:');
      },

      async refreshProfile() {
        await loadProfile(session?.user.id);
      },
    }),
    [sb, status, session, profile, loadProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
