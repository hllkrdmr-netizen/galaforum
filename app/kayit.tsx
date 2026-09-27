import { router } from 'expo-router';
import { useEffect, useState } from 'react';

import { AppText, Button, PressableScale, TextField } from '../components/ui';
import { AuthLayout, Notice } from '../features/auth/AuthLayout';
import { useAuth } from '../lib/auth/AuthProvider';
import { AuthError, PASSWORD_MIN, validateSignUp } from '../lib/auth/validation';
import type { SignUpErrors, SignUpInput } from '../lib/auth/validation';

export default function SignUpScreen() {
  const { status, signUp, resendVerification } = useAuth();
  const [form, setForm] = useState<SignUpInput>({ username: '', email: '', password: '', passwordConfirm: '' });
  const [errors, setErrors] = useState<SignUpErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [resent, setResent] = useState(false);

  useEffect(() => {
    if (status === 'signedIn') router.replace('/hesap');
  }, [status]);

  const set = (key: keyof SignUpInput) => (v: string) => setForm((f) => ({ ...f, [key]: v }));

  const submit = async () => {
    const v = validateSignUp(form);
    setErrors(v);
    setError(null);
    if (Object.values(v).some(Boolean)) return;
    setBusy(true);
    try {
      const { needsVerification } = await signUp(form);
      if (needsVerification) setSentTo(form.email.trim().toLowerCase());
    } catch (e) {
      if (e instanceof AuthError && e.code === 'username_taken') setErrors({ username: e.message });
      else setError(e instanceof AuthError ? e.message : 'Kayıt tamamlanamadı. Lütfen tekrar dene.');
    } finally {
      setBusy(false);
    }
  };

  if (sentTo) {
    return (
      <AuthLayout headerTitle="Üye ol" title="E-postanı doğrula" subtitle={`${sentTo} adresine bir doğrulama bağlantısı gönderdik.`}>
        <Notice tone="success">
          Bağlantıya tıkladığında hesabın etkinleşir ve otomatik olarak giriş yaparsın. E-posta birkaç dakika içinde gelmezse gereksiz klasörüne bak.
        </Notice>
        {resent ? <Notice tone="info">Bağlantı tekrar gönderildi.</Notice> : null}
        {error ? <Notice tone="error">{error}</Notice> : null}
        <Button
          label="Bağlantıyı tekrar gönder"
          variant="secondary"
          loading={busy}
          onPress={async () => {
            setBusy(true);
            try {
              await resendVerification(sentTo);
              setResent(true);
              setError(null);
            } catch (e) {
              setError(e instanceof AuthError ? e.message : 'E-posta gönderilemedi.');
            } finally {
              setBusy(false);
            }
          }}
        />
        <Button label="Giriş ekranına dön" variant="ghost" onPress={() => router.replace('/giris')} />
      </AuthLayout>
    );
  }

  const disabled = status === 'unavailable';

  return (
    <AuthLayout
      headerTitle="Üye ol"
      title="Aileye katıl"
      subtitle="Kullanıcı adın forumdaki kimliğin olur; sonradan hesap ayarlarından değiştirebilirsin."
      footer={
        <PressableScale accessibilityRole="link" onPress={() => router.replace('/giris')} style={{ minHeight: 44, justifyContent: 'center' }}>
          <AppText variant="small" tone="muted">
            Zaten üye misin? <AppText variant="small" tone="gold" style={{ fontWeight: '700' }}>Giriş yap</AppText>
          </AppText>
        </PressableScale>
      }
    >
      {disabled ? (
        <Notice tone="info">
          Demo modunda üyelik kapalı. Gerçek üyelik için Supabase bağlantısını (.env) yapılandır.
        </Notice>
      ) : null}
      <TextField
        label="Kullanıcı adı"
        value={form.username}
        onChangeText={(v) => set('username')(v.toLowerCase())}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="username-new"
        textContentType="username"
        maxLength={24}
        hint="3–24 karakter: a-z, 0-9 ve _"
        error={errors.username}
        editable={!disabled}
      />
      <TextField
        label="E-posta"
        value={form.email}
        onChangeText={set('email')}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
        error={errors.email}
        editable={!disabled}
      />
      <TextField
        label="Şifre"
        value={form.password}
        onChangeText={set('password')}
        secureToggle
        autoCapitalize="none"
        autoComplete="new-password"
        textContentType="newPassword"
        hint={`En az ${PASSWORD_MIN} karakter; harf ve rakam içermeli.`}
        error={errors.password}
        editable={!disabled}
      />
      <TextField
        label="Şifre (tekrar)"
        value={form.passwordConfirm}
        onChangeText={set('passwordConfirm')}
        secureToggle
        autoCapitalize="none"
        autoComplete="new-password"
        textContentType="newPassword"
        error={errors.passwordConfirm}
        editable={!disabled}
        onSubmitEditing={() => void submit()}
      />
      <AppText variant="caption" tone="subtle">
        Üye olarak forum kurallarına uymayı kabul edersin: saygılı dil, kaynaklı bilgi, kişisel saldırı yok.
      </AppText>
      {error ? <Notice tone="error">{error}</Notice> : null}
      <Button label="Hesap oluştur" icon="person-add-outline" size="lg" loading={busy} disabled={disabled} onPress={() => void submit()} />
    </AuthLayout>
  );
}
