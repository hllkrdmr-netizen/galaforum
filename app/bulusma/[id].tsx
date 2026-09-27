import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AppText, Avatar, Button, Container, EmptyState, ErrorState, PressableScale, ScreenHeader, Skeleton } from '../../components/ui';
import { colors, spacing } from '../../constants/theme';
import { Notice } from '../../features/auth/AuthLayout';
import { SignInPrompt } from '../../features/auth/SignInPrompt';
import { meetupWhen } from '../../features/community/CommunityParts';
import { MapPreview } from '../../features/community/MapPreview';
import { invalidateQueries, useForumQuery } from '../../hooks/useForumQuery';
import { useAuth } from '../../lib/auth/AuthProvider';
import { community } from '../../services/community';
import { DEMO_GUEST } from '../../services/forum/demoRepository';

export default function MeetupScreen() {
  const { id = '' } = useLocalSearchParams<{ id: string }>();
  const q = useForumQuery(`community:meetup:${id}`, () => community.getMeetup(id), { staleTime: 10_000 });
  const { profile } = useAuth();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);
  const m = q.data;
  const myId = community.mode === 'demo' ? DEMO_GUEST.id : profile?.id;

  const run = async (fn: () => Promise<unknown>, ok?: string) => {
    setBusy(true);
    setMessage(null);
    try {
      await fn();
      invalidateQueries('community:');
      await q.refetch();
      if (ok) setMessage({ tone: 'success', text: ok });
    } catch (e) {
      setMessage({ tone: 'error', text: e instanceof Error ? e.message : 'İşlem tamamlanamadı.' });
    } finally {
      setBusy(false);
    }
  };

  if (q.isLoading) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Buluşma" />
        <Container style={{ paddingTop: spacing.xl, gap: spacing.md }}>
          <Skeleton width="80%" height={24} />
          <Skeleton height={180} />
        </Container>
      </View>
    );
  }
  if (q.error) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Buluşma" />
        <ErrorState message={q.error.message} onRetry={q.refetch} />
      </View>
    );
  }
  if (!m) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Buluşma" />
        <EmptyState icon="location-outline" title="Buluşma bulunamadı." actionLabel="Buluşmalara dön" onAction={() => router.replace('/bulusmalar')} />
      </View>
    );
  }

  const w = meetupWhen(m.startsAt);
  const past = new Date(m.startsAt).getTime() < Date.now();
  const full = m.capacity != null && m.attendeeCount >= m.capacity;
  const isOrganizer = Boolean(myId && m.organizer?.id === myId);
  const closed = m.cancelled || past;

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Buluşma" />
      <ScrollView contentContainerStyle={{ paddingBottom: 80 }}>
        <Container style={{ paddingTop: spacing.xl, gap: spacing.lg, maxWidth: 720 }}>
          <View style={{ gap: spacing.xs }}>
            {m.cancelled ? (
              <AppText variant="small" tone="danger" style={{ fontWeight: '800' }}>
                İPTAL EDİLDİ
              </AppText>
            ) : null}
            <AppText variant="h1" accessibilityRole="header">
              {m.title}
            </AppText>
          </View>

          <View style={{ gap: spacing.sm }}>
            <Line icon="calendar-outline" text={`${w.weekday}, ${w.day} ${w.month} · ${w.time}`} />
            <Line icon="location-outline" text={`${m.placeName}${m.address ? `, ${m.address}` : ''} · ${m.city}`} />
            <Line
              icon="people-outline"
              text={`${m.attendeeCount}${m.capacity ? ` / ${m.capacity}` : ''} katılımcı${full ? ' · kontenjan dolu' : ''}`}
            />
            {m.organizer ? <Line icon="person-outline" text={`Düzenleyen: ${m.organizer.username}`} /> : null}
          </View>

          {m.lat != null && m.lng != null ? <MapPreview lat={m.lat} lng={m.lng} label={m.placeName} /> : null}

          {m.description ? (
            <AppText variant="body" style={{ lineHeight: 24 }}>
              {m.description}
            </AppText>
          ) : null}

          {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}

          {!closed ? (
            <View style={styles.row}>
              {m.isAttending ? (
                isOrganizer ? (
                  <Button
                    label="Buluşmayı iptal et"
                    variant="secondary"
                    icon="close-circle-outline"
                    loading={busy}
                    onPress={() => void run(() => community.cancelMeetup(m.id), 'Buluşma iptal edildi.')}
                  />
                ) : (
                  <Button label="Katılmıyorum" variant="secondary" loading={busy} onPress={() => void run(() => community.setAttendance(m.id, false))} />
                )
              ) : (
                <Button
                  label={full ? 'Kontenjan dolu' : 'Katılıyorum'}
                  icon="checkmark"
                  disabled={full}
                  loading={busy}
                  onPress={() => void run(() => community.setAttendance(m.id, true), 'Katılımın kaydedildi.')}
                />
              )}
            </View>
          ) : null}
          {!closed ? <SignInPrompt message="Buluşmaya katılmak için giriş yap." /> : null}

          {m.attendees.length > 0 ? (
            <View style={{ gap: spacing.sm }}>
              <AppText variant="small" tone="muted" style={{ fontWeight: '700' }}>
                Katılanlar
              </AppText>
              <View style={styles.people}>
                {m.attendees.map((a) => (
                  <PressableScale key={a.id} accessibilityRole="link" accessibilityLabel={a.username} onPress={() => router.push(`/uye/${a.username}`)} style={styles.person}>
                    <Avatar name={a.username} uri={a.avatarUrl} size={28} />
                    <AppText variant="caption" style={{ fontWeight: '600' }}>
                      {a.username}
                    </AppText>
                  </PressableScale>
                ))}
              </View>
            </View>
          ) : null}

          <AppText variant="caption" tone="subtle">
            Buluşmalar üyeler tarafından düzenlenir. Kişisel güvenliğin için kalabalık ve herkese açık yerleri tercih et.
          </AppText>
        </Container>
      </ScrollView>
    </View>
  );
}

function Line({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return (
    <View style={styles.line}>
      <Ionicons name={icon} size={16} color={colors.textSubtle} />
      <AppText variant="body" tone="muted" style={{ flex: 1 }}>
        {text}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  line: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  people: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  person: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 36 },
});
