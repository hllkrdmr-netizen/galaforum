import { router } from 'expo-router';
import { useState } from 'react';

import { Button, TextField } from '../components/ui';
import { AuthLayout, Notice } from '../features/auth/AuthLayout';
import { useAuth } from '../lib/auth/AuthProvider';
import { AuthError } from '../lib/auth/validation';

export default function RequestResetScreen() {
  const { status, requestPasswordReset } = useAuth();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const disabled = status === 'unavailable';

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await requestPasswordReset(email);
      setSent(true);
    } catch (e) {
      setError(e instanceof AuthError ? e.message : 'İstek gönderilemedi. Lütfen tekrar dene.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout
      headerTitle="Şifre sıfırlama"
      title="Şifreni sıfırla"
      subtitle="Hesabına bağlı e-posta adresini yaz; yeni şifre belirlemen için bir bağlantı gönderelim."
    >
      {disabled ? <Notice tone="info">Demo modunda şifre sıfırlama kapalı.</Notice> : null}
      {sent ? (
        <>
          <Notice tone="success">
            Bu adres kayıtlıysa birkaç dakika içinde bir sıfırlama bağlantısı gelecek. Bağlantıyı bu cihazda aç.
          </Notice>
          <Button label="Giriş ekranına dön" variant="secondary" onPress={() => router.replace('/giris')} />
        </>
      ) : (
        <>
          <TextField
            label="E-posta"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
            editable={!disabled}
            onSubmitEditing={() => void submit()}
          />
          {error ? <Notice tone="error">{error}</Notice> : null}
          <Button label="Bağlantı gönder" icon="mail-outline" size="lg" loading={busy} disabled={disabled} onPress={() => void submit()} />
        </>
      )}
    </AuthLayout>
  );
}
