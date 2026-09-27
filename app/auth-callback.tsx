import { router, useLocalSearchParams } from 'expo-router';
import * as Linking from 'expo-linking';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';

import { Button } from '../components/ui';
import { colors } from '../constants/theme';
import { AuthLayout, Notice } from '../features/auth/AuthLayout';
import { mapAuthError, parseAuthCallback, safeNextRoute } from '../lib/auth/validation';
import { getSupabase } from '../lib/supabase';

/**
 * Landing route for e-mail links (sign-up confirmation, password reset).
 * Exchanges the PKCE code (or implicit tokens) for a session, then continues to a known in-app route.
 */
export default function AuthCallbackScreen() {
  const params = useLocalSearchParams<{ code?: string; next?: string; error_description?: string }>();
  const [error, setError] = useState<string | null>(null);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    void (async () => {
      const sb = getSupabase();
      if (!sb) return setError('Demo modunda e-posta bağlantıları kullanılamaz.');
      // Web keeps tokens in the hash fragment, which the router does not expose as params.
      const fromUrl =
        Platform.OS === 'web' && typeof window !== 'undefined'
          ? parseAuthCallback(window.location.href)
          : parseAuthCallback((await Linking.getInitialURL()) ?? '');
      const code = params.code ?? fromUrl.code;
      const next = safeNextRoute(params.next ?? fromUrl.next);
      const errorDescription = params.error_description ?? fromUrl.errorDescription;
      if (errorDescription) return setError('Bağlantı geçersiz ya da süresi dolmuş. Lütfen yeni bir bağlantı iste.');
      try {
        if (code) {
          const { error: e } = await sb.auth.exchangeCodeForSession(code);
          if (e) throw e;
        } else if (fromUrl.accessToken && fromUrl.refreshToken) {
          const { error: e } = await sb.auth.setSession({ access_token: fromUrl.accessToken, refresh_token: fromUrl.refreshToken });
          if (e) throw e;
        } else {
          const { data } = await sb.auth.getSession();
          if (!data.session) return setError('Bağlantı geçersiz ya da süresi dolmuş. Lütfen yeni bir bağlantı iste.');
        }
        router.replace(next);
      } catch (e) {
        setError(mapAuthError(e as { message?: string; code?: string }).message);
      }
    })();
  }, [params.code, params.next, params.error_description]);

  if (!error) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }} accessibilityLabel="Oturum doğrulanıyor">
        <ActivityIndicator color={colors.gold} />
      </View>
    );
  }
  return (
    <AuthLayout headerTitle="Doğrulama" title="Bağlantı açılamadı">
      <Notice tone="error">{error}</Notice>
      <Button label="Giriş ekranına git" onPress={() => router.replace('/giris')} />
      <Button label="Şifre sıfırlama bağlantısı iste" variant="secondary" onPress={() => router.replace('/sifre-sifirla')} />
    </AuthLayout>
  );
}
