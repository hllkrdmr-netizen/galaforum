import { router } from 'expo-router';
import { useState } from 'react';

import { Button, TextField } from '../components/ui';
import { AuthLayout, Notice } from '../features/auth/AuthLayout';
import { useAuth } from '../lib/auth/AuthProvider';
import { AuthError, PASSWORD_MIN, validatePassword } from '../lib/auth/validation';

/** Reached from the reset e-mail (via /auth-callback) or from account settings while signed in. */
export default function NewPasswordScreen() {
  const { status, updatePassword } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async () => {
    const p = validatePassword(password);
    if (p) return setError(p);
    if (password !== confirm) return setError('Şifreler eşleşmiyor.');
    setBusy(true);
    setError(null);
    try {
      await updatePassword(password);
      setDone(true);
    } catch (e) {
      setError(e instanceof AuthError ? e.message : 'Şifre güncellenemedi.');
    } finally {
      setBusy(false);
    }
  };

  if (status !== 'signedIn' && status !== 'loading') {
    return (
      <AuthLayout headerTitle="Yeni şifre" title="Bağlantının süresi dolmuş olabilir" subtitle="Yeni şifre belirlemek için oturum gerekiyor.">
        <Notice tone="info">Sıfırlama bağlantısını tekrar iste ve e-postadaki bağlantıyı bu cihazda aç.</Notice>
        <Button label="Yeni bağlantı iste" onPress={() => router.replace('/sifre-sifirla')} />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout headerTitle="Yeni şifre" title="Yeni şifreni belirle" subtitle={`En az ${PASSWORD_MIN} karakter; harf ve rakam içermeli.`}>
      {done ? (
        <>
          <Notice tone="success">Şifren güncellendi.</Notice>
          <Button label="Hesabıma git" onPress={() => router.replace('/hesap')} />
        </>
      ) : (
        <>
          <TextField label="Yeni şifre" value={password} onChangeText={setPassword} secureToggle autoCapitalize="none" autoComplete="new-password" textContentType="newPassword" />
          <TextField label="Yeni şifre (tekrar)" value={confirm} onChangeText={setConfirm} secureToggle autoCapitalize="none" autoComplete="new-password" textContentType="newPassword" onSubmitEditing={() => void submit()} />
          {error ? <Notice tone="error">{error}</Notice> : null}
          <Button label="Şifreyi kaydet" icon="key-outline" size="lg" loading={busy} onPress={() => void submit()} />
        </>
      )}
    </AuthLayout>
  );
}
