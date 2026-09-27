import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';

import { AppText, Avatar, Button, Container, Pill, ScreenHeader, SectionHeader, TextField } from '../components/ui';
import { colors, radius, spacing } from '../constants/theme';
import { Notice } from '../features/auth/AuthLayout';
import { useAuth } from '../lib/auth/AuthProvider';
import { AuthError, validateUsername } from '../lib/auth/validation';

const ROLE_LABEL = { user: 'Üye', verified: 'Onaylı Üye', moderator: 'Moderatör', admin: 'Yönetici' } as const;
const DELETE_WORD = 'SİL';

export default function AccountScreen() {
  const auth = useAuth();
  const { status, profile, user } = auth;
  const [username, setUsername] = useState(profile?.username ?? '');
  const [nameMsg, setNameMsg] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState<'name' | 'out' | 'delete' | null>(null);
  const [confirmWord, setConfirmWord] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    if (profile?.username) setUsername(profile.username);
  }, [profile?.username]);

  if (status === 'loading') {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.gold} />
      </View>
    );
  }

  if (status !== 'signedIn') {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Hesap" />
        <Container style={{ paddingTop: spacing.xxl, gap: spacing.lg, maxWidth: 560 }}>
          <AppText variant="h1" accessibilityRole="header">
            Hesabın
          </AppText>
          {status === 'unavailable' ? (
            <Notice tone="info">
              Demo modunda hesaplar kapalı. Gerçek üyelik, oturum ve profil için Supabase bağlantısını (.env) yapılandır.
            </Notice>
          ) : (
            <>
              <AppText tone="muted">Konu açmak, yanıt yazmak ve profilini yönetmek için giriş yap.</AppText>
              <View style={styles.row}>
                <Button label="Giriş yap" icon="log-in-outline" onPress={() => router.push('/giris')} />
                <Button label="Üye ol" variant="secondary" onPress={() => router.push('/kayit')} />
              </View>
            </>
          )}
        </Container>
      </View>
    );
  }

  const saveName = async () => {
    const v = validateUsername(username);
    if (v) return setNameMsg({ tone: 'error', text: v });
    setBusy('name');
    setNameMsg(null);
    try {
      await auth.updateUsername(username);
      setNameMsg({ tone: 'success', text: 'Kullanıcı adın güncellendi.' });
    } catch (e) {
      setNameMsg({ tone: 'error', text: e instanceof AuthError ? e.message : 'Kaydedilemedi.' });
    } finally {
      setBusy(null);
    }
  };

  const signOut = async () => {
    setBusy('out');
    try {
      await auth.signOut();
      router.replace('/');
    } finally {
      setBusy(null);
    }
  };

  const deleteAccount = async () => {
    setBusy('delete');
    setDeleteError(null);
    try {
      await auth.deleteAccount();
      router.replace('/');
    } catch (e) {
      setDeleteError(e instanceof AuthError ? e.message : 'Hesap silinemedi. Lütfen tekrar dene.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Hesap" />
      <ScrollView contentContainerStyle={{ paddingBottom: 80 }} keyboardShouldPersistTaps="handled">
        <Container style={{ paddingTop: spacing.xxl, maxWidth: 640 }}>
          <View style={styles.identity}>
            <Avatar name={profile?.username ?? '?'} uri={profile?.avatarUrl} size={64} />
            <View style={{ flex: 1, gap: 4 }}>
              <AppText variant="h1" numberOfLines={1}>
                {profile?.username ?? '…'}
              </AppText>
              <AppText variant="small" tone="muted" numberOfLines={1}>
                {user?.email}
              </AppText>
              {profile?.role ? <Pill label={ROLE_LABEL[profile.role]} tone={profile.role === 'user' ? 'neutral' : 'gold'} /> : null}
            </View>
          </View>
          {profile ? (
            <Button
              label="Profilimi görüntüle"
              variant="secondary"
              icon="person-outline"
              onPress={() => router.push(`/uye/${profile.username}`)}
              style={{ marginTop: spacing.lg }}
            />
          ) : null}

          <View style={styles.section}>
            <SectionHeader overline="Kimlik" title="Kullanıcı adı" />
            <TextField
              label="Kullanıcı adı"
              value={username}
              onChangeText={(v) => setUsername(v.toLowerCase())}
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={24}
              hint="Değiştirdiğinde eski @bahsetmeler yeni ada otomatik bağlanmaz."
            />
            {nameMsg ? <Notice tone={nameMsg.tone}>{nameMsg.text}</Notice> : null}
            <Button
              label="Kaydet"
              loading={busy === 'name'}
              disabled={!username || username === profile?.username}
              onPress={() => void saveName()}
              style={{ marginTop: spacing.md }}
            />
          </View>

          <View style={styles.section}>
            <SectionHeader overline="Güvenlik" title="Oturum" />
            <View style={styles.row}>
              <Button label="Şifreyi değiştir" variant="secondary" icon="key-outline" onPress={() => router.push('/yeni-sifre')} />
              <Button label="Çıkış yap" variant="secondary" icon="log-out-outline" loading={busy === 'out'} onPress={() => void signOut()} />
            </View>
          </View>

          <View style={[styles.section, styles.danger]}>
            <AppText variant="h2" style={{ color: colors.danger }}>
              Hesabı sil
            </AppText>
            <AppText variant="small" tone="muted">
              E-posta adresin, oturumların, beğenilerin, anket oyların ve şikâyet kayıtların kalıcı olarak silinir. Tartışma
              bütünlüğü için yazdığın mesajlar “silinmiş üye” adıyla kalır. Bu işlem geri alınamaz.
            </AppText>
            <TextField
              label={`Onaylamak için ${DELETE_WORD} yaz`}
              value={confirmWord}
              onChangeText={setConfirmWord}
              autoCapitalize="characters"
              autoCorrect={false}
            />
            {deleteError ? <Notice tone="error">{deleteError}</Notice> : null}
            <Button
              label="Hesabımı kalıcı olarak sil"
              variant="secondary"
              icon="trash-outline"
              loading={busy === 'delete'}
              disabled={confirmWord.trim().toLocaleUpperCase('tr-TR') !== DELETE_WORD}
              onPress={() => void deleteAccount()}
              accessibilityHint="Hesabını ve kişisel verilerini kalıcı olarak siler"
            />
          </View>
        </Container>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  identity: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  section: { marginTop: spacing.xxxl, gap: spacing.md },
  danger: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(228,106,94,0.35)',
    backgroundColor: 'rgba(228,106,94,0.05)',
  },
});
