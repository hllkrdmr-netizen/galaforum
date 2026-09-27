import { router, useLocalSearchParams } from 'expo-router';
import type { Href } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import type { TextInput } from 'react-native';

import { AppText, Button, PressableScale, TextField } from '../components/ui';
import { AuthLayout, Notice } from '../features/auth/AuthLayout';
import { useAuth } from '../lib/auth/AuthProvider';
import { AuthError, safeReturnPath } from '../lib/auth/validation';

export default function SignInScreen() {
  const { status, signIn, resendVerification } = useAuth();
  const { sonra } = useLocalSearchParams<{ sonra?: string }>();
  const target = safeReturnPath(sonra) as Href;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<AuthError | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const passwordRef = useRef<TextInput>(null);

  useEffect(() => {
    if (status === 'signedIn') router.replace(target);
  }, [status, target]);

  const submit = async () => {
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      await signIn(email, password);
    } catch (e) {
      setError(e instanceof AuthError ? e : new AuthError('Giriş yapılamadı. Lütfen tekrar dene.'));
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    setBusy(true);
    try {
      await resendVerification(email);
      setError(null);
      setInfo('Doğrulama bağlantısı tekrar gönderildi. Gelen kutunu ve gereksiz klasörünü kontrol et.');
    } catch (e) {
      setError(e instanceof AuthError ? e : new AuthError('E-posta gönderilemedi.'));
    } finally {
      setBusy(false);
    }
  };

  const disabled = status === 'unavailable';

  return (
    <AuthLayout
      headerTitle="Giriş yap"
      title="Tekrar hoş geldin"
      subtitle="Tartışmalara katılmak, beğenmek ve oy vermek için hesabına giriş yap."
      footer={
        <>
          <PressableScale accessibilityRole="link" onPress={() => router.push('/sifre-sifirla')} style={{ minHeight: 44, justifyContent: 'center' }}>
            <AppText variant="small" tone="gold" style={{ fontWeight: '700' }}>
              Şifremi unuttum
            </AppText>
          </PressableScale>
          <PressableScale accessibilityRole="link" onPress={() => router.replace('/kayit')} style={{ minHeight: 44, justifyContent: 'center' }}>
            <AppText variant="small" tone="muted">
              Hesabın yok mu? <AppText variant="small" tone="gold" style={{ fontWeight: '700' }}>Üye ol</AppText>
            </AppText>
          </PressableScale>
        </>
      }
    >
      {disabled ? (
        <Notice tone="info">
          Demo modunda giriş kapalı. Gerçek üyelik için Supabase bağlantısını (.env) yapılandır.
        </Notice>
      ) : null}
      <TextField
        label="E-posta"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
        returnKeyType="next"
        onSubmitEditing={() => passwordRef.current?.focus()}
        editable={!disabled}
      />
      <TextField
        ref={passwordRef}
        label="Şifre"
        value={password}
        onChangeText={setPassword}
        secureToggle
        autoCapitalize="none"
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="go"
        onSubmitEditing={() => void submit()}
        editable={!disabled}
      />
      {error ? <Notice tone="error">{error.message}</Notice> : null}
      {info ? <Notice tone="success">{info}</Notice> : null}
      {error?.code === 'email_not_confirmed' ? (
        <Button label="Doğrulama e-postasını tekrar gönder" variant="secondary" loading={busy} onPress={() => void resend()} />
      ) : null}
      <Button label="Giriş yap" icon="log-in-outline" size="lg" loading={busy} disabled={disabled} onPress={() => void submit()} />
    </AuthLayout>
  );
}
