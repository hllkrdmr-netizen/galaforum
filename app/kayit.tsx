import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText, Button, PressableScale, TextField } from '../components/ui';
import { colors, radius, spacing } from '../constants/theme';
import { AuthLayout, Notice } from '../features/auth/AuthLayout';
import { useAuth } from '../lib/auth/AuthProvider';
import { AuthError, PASSWORD_MIN, validateSignUp } from '../lib/auth/validation';
import type { SignUpErrors, SignUpInput } from '../lib/auth/validation';

export default function SignUpScreen() {
  const { status, signUp, resendVerification } = useAuth();
  const [form, setForm] = useState<SignUpInput>({ username: '', email: '', password: '', passwordConfirm: '', acceptedTerms: false });
  const [errors, setErrors] = useState<SignUpErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [resent, setResent] = useState(false);

  useEffect(() => {
    if (status === 'signedIn') router.replace('/hesap');
  }, [status]);

  const set = (key: Exclude<keyof SignUpInput, 'acceptedTerms'>) => (v: string) => setForm((f) => ({ ...f, [key]: v }));

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
      <PressableScale
        accessibilityRole="checkbox"
        accessibilityState={{ checked: form.acceptedTerms, disabled }}
        accessibilityLabel="Topluluk kurallarını, kullanım koşullarını ve gizlilik metnini okudum, kabul ediyorum"
        disabled={disabled}
        onPress={() => setForm((f) => ({ ...f, acceptedTerms: !f.acceptedTerms }))}
        style={styles.terms}
      >
        <View style={[styles.box, form.acceptedTerms && styles.boxOn, errors.acceptedTerms ? styles.boxError : null]}>
          {form.acceptedTerms ? <Ionicons name="checkmark" size={16} color={colors.textOnGold} /> : null}
        </View>
        <AppText variant="small" tone="muted" style={{ flex: 1 }}>
          <AppText variant="small" tone="gold" style={styles.link} onPress={() => router.push('/bilgi/kurallar')}>
            Topluluk kurallarını
          </AppText>
          {', '}
          <AppText variant="small" tone="gold" style={styles.link} onPress={() => router.push('/bilgi/kosullar')}>
            kullanım koşullarını
          </AppText>
          {' ve '}
          <AppText variant="small" tone="gold" style={styles.link} onPress={() => router.push('/bilgi/gizlilik')}>
            gizlilik metnini
          </AppText>
          {' okudum, kabul ediyorum. Hakaret, nefret söylemi ve kaynaksız iddialar kaldırılır.'}
        </AppText>
      </PressableScale>
      {errors.acceptedTerms ? (
        <AppText variant="small" tone="danger">
          {errors.acceptedTerms}
        </AppText>
      ) : null}
      {error ? <Notice tone="error">{error}</Notice> : null}
      <Button label="Hesap oluştur" icon="person-add-outline" size="lg" loading={busy} disabled={disabled} onPress={() => void submit()} />
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  terms: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, paddingVertical: spacing.xs, minHeight: 44 },
  box: {
    width: 24,
    height: 24,
    marginTop: 1,
    borderRadius: radius.sm - 2,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxOn: { backgroundColor: colors.gold, borderColor: colors.gold },
  boxError: { borderColor: colors.danger },
  link: { fontWeight: '700', textDecorationLine: 'underline' },
});
