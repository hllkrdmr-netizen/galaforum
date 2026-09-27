import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';

import { AppText, Button, Container, PressableScale, ScreenHeader, TextField } from '../components/ui';
import { colors, radius, spacing } from '../constants/theme';
import { Notice } from '../features/auth/AuthLayout';
import { SignInPrompt } from '../features/auth/SignInPrompt';
import { invalidateQueries, useForumQuery } from '../hooks/useForumQuery';
import { matchTitle } from '../lib/match';
import { suggestFromKickoff, validateMeetup } from '../lib/meetups';
import type { MeetupErrors } from '../lib/meetups';
import { community } from '../services/community';
import { matches } from '../services/match';
import type { MeetupForm } from '../types/community';

const EMPTY: MeetupForm = {
  title: '',
  description: '',
  date: '',
  time: '',
  city: '',
  placeName: '',
  address: '',
  location: '',
  capacity: '',
  matchId: null,
};

export default function CreateMeetupScreen() {
  const { mac } = useLocalSearchParams<{ mac?: string }>();
  const [form, setForm] = useState<MeetupForm>({ ...EMPTY, matchId: mac ? String(mac) : null });
  const [errors, setErrors] = useState<MeetupErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fixtures = useForumQuery('match:list', () => matches.listMatches());
  const upcoming = (fixtures.data ?? []).filter((m) => m.status === 'scheduled').slice(0, 4);

  const set = (k: keyof MeetupForm) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const pickMatch = (id: string | null) => {
    const m = upcoming.find((x) => x.id === id);
    setForm((f) => ({
      ...f,
      matchId: id,
      ...(m && !f.date && !f.time ? suggestFromKickoff(m.kickoffAt) : {}),
      ...(m && !f.title ? { title: `${matchTitle(m)} öncesi buluşma` } : {}),
    }));
  };

  const submit = async () => {
    const { errors: e, input } = validateMeetup(form);
    setErrors(e);
    setSubmitError(null);
    if (!input) return;
    setBusy(true);
    try {
      const { id } = await community.createMeetup(input);
      invalidateQueries('community:');
      router.replace(`/bulusma/${id}`);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Buluşma oluşturulamadı.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScreenHeader title="Buluşma aç" />
      <ScrollView contentContainerStyle={{ paddingBottom: 80 }} keyboardShouldPersistTaps="handled">
        <Container style={{ paddingTop: spacing.xl, gap: spacing.lg, maxWidth: 640 }}>
          <AppText variant="h1" accessibilityRole="header">
            Yeni buluşma
          </AppText>

          {upcoming.length > 0 ? (
            <View style={{ gap: spacing.sm }}>
              <AppText variant="small" style={styles.label}>
                Maç (isteğe bağlı)
              </AppText>
              <View style={styles.chips}>
                {[null, ...upcoming.map((m) => m.id)].map((mid) => {
                  const m = upcoming.find((x) => x.id === mid);
                  const on = form.matchId === mid;
                  return (
                    <PressableScale
                      key={mid ?? 'none'}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: on }}
                      onPress={() => pickMatch(mid)}
                      style={[styles.chip, on && styles.chipOn]}
                    >
                      <AppText variant="caption" style={{ fontWeight: '700', color: on ? colors.goldSoft : colors.textMuted }}>
                        {m ? matchTitle(m) : 'Maçla ilgili değil'}
                      </AppText>
                    </PressableScale>
                  );
                })}
              </View>
            </View>
          ) : null}

          <TextField label="Başlık" value={form.title} onChangeText={set('title')} maxLength={100} error={errors.title} />
          <View style={styles.two}>
            <View style={{ flex: 1 }}>
              <TextField label="Tarih" placeholder="GG.AA.YYYY" value={form.date} onChangeText={set('date')} keyboardType="numbers-and-punctuation" maxLength={10} error={errors.date} />
            </View>
            <View style={{ width: 110 }}>
              <TextField label="Saat" placeholder="SS:DD" value={form.time} onChangeText={set('time')} keyboardType="numbers-and-punctuation" maxLength={5} />
            </View>
          </View>
          <TextField label="Şehir" value={form.city} onChangeText={set('city')} maxLength={60} error={errors.city} />
          <TextField label="Buluşma noktası" placeholder="Ör. metro çıkışı, kafe adı" value={form.placeName} onChangeText={set('placeName')} maxLength={100} error={errors.placeName} />
          <TextField label="Adres (isteğe bağlı)" value={form.address} onChangeText={set('address')} maxLength={200} error={errors.address} />
          <TextField
            label="Harita konumu (isteğe bağlı)"
            placeholder="41.0082, 28.9784 ya da harita bağlantısı"
            value={form.location}
            onChangeText={set('location')}
            autoCapitalize="none"
            hint="Haritalar uygulamasında konumu paylaşıp bağlantıyı buraya yapıştırabilirsin."
            error={errors.location}
          />
          <TextField label="Kontenjan (isteğe bağlı)" placeholder="Sınırsız" value={form.capacity} onChangeText={set('capacity')} keyboardType="number-pad" maxLength={3} error={errors.capacity} />
          <TextField
            label="Açıklama (isteğe bağlı)"
            value={form.description}
            onChangeText={set('description')}
            multiline
            maxLength={2000}
            error={errors.description}
          />

          {submitError ? <Notice tone="error">{submitError}</Notice> : null}
          <SignInPrompt message="Buluşma açmak için giriş yap." />
          <Button label="Buluşmayı yayımla" icon="send" size="lg" loading={busy} onPress={() => void submit()} />
          <AppText variant="caption" tone="subtle">
            Buluşmayı açan kişi otomatik olarak katılımcı olur ve gerekirse iptal edebilir. Aynı anda en fazla 5 yaklaşan buluşma açılabilir.
          </AppText>
        </Container>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  label: { fontWeight: '600', color: colors.textMuted },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { minHeight: 36, justifyContent: 'center', paddingHorizontal: spacing.md, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border },
  chipOn: { borderColor: colors.gold, backgroundColor: 'rgba(217,164,65,0.12)' },
  two: { flexDirection: 'row', gap: spacing.md },
});
