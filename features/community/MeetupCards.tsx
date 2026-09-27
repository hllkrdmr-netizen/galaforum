import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText, AvatarStack, Button, Card, ProgressBar } from '../../components/ui';
import { colors, fonts, radius, spacing } from '../../constants/theme';
import { invalidateQueries } from '../../hooks/useForumQuery';
import { community } from '../../services/community';
import type { Meetup } from '../../types/community';
import { meetupWhen } from './CommunityParts';
import { MapPreview } from './MapPreview';

function DateBlock({ iso, large }: { iso: string; large?: boolean }) {
  const w = meetupWhen(iso);
  return (
    <View style={[styles.dateBlock, large && styles.dateBlockLg]}>
      <AppText variant="caption" tone="gold" style={{ fontWeight: '800' }} uppercase>
        {w.month}
      </AppText>
      <AppText style={[styles.day, large && styles.dayLg]}>{w.day}</AppText>
      <AppText variant="caption" tone="subtle">
        {w.weekday}
      </AppText>
    </View>
  );
}

function Place({ meetup }: { meetup: Meetup }) {
  return (
    <View style={{ gap: 2 }}>
      <View style={styles.line}>
        <Ionicons name="location" size={15} color={colors.gold} />
        <AppText variant="bodyStrong" numberOfLines={1} style={{ flex: 1 }}>
          {meetup.placeName}
        </AppText>
      </View>
      <AppText variant="caption" tone="subtle" numberOfLines={1} style={{ marginLeft: 21 }}>
        {[meetup.address, meetup.city].filter(Boolean).join(' · ')} · saat {meetupWhen(meetup.startsAt).time}
      </AppText>
    </View>
  );
}

function Attendance({ meetup }: { meetup: Meetup }) {
  const full = meetup.capacity != null && meetup.attendeeCount >= meetup.capacity;
  return (
    <View style={{ gap: spacing.sm }}>
      <View style={styles.line}>
        <AvatarStack people={meetup.attendeePreview} total={meetup.attendeeCount} size={28} />
        <AppText variant="small" tone="muted" style={{ flex: 1 }}>
          <AppText variant="small" style={{ fontWeight: '800' }}>
            {meetup.attendeeCount}
          </AppText>
          {meetup.capacity ? ` / ${meetup.capacity}` : ''} katılımcı
          {full ? ' · dolu' : ''}
        </AppText>
        {meetup.isAttending ? (
          <View style={styles.going}>
            <Ionicons name="checkmark" size={12} color={colors.success} />
            <AppText variant="caption" style={{ color: colors.success, fontWeight: '700' }}>
              Katılıyorsun
            </AppText>
          </View>
        ) : null}
      </View>
      {meetup.capacity ? <ProgressBar value={meetup.attendeeCount / meetup.capacity} label="Kontenjan doluluğu" /> : null}
    </View>
  );
}

/** Featured (next) meetup: large date, meeting point, map, attendees, one-tap join. */
export function FeaturedMeetupCard({ meetup, onChanged }: { meetup: Meetup; onChanged?: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const full = meetup.capacity != null && meetup.attendeeCount >= meetup.capacity;
  const join = async () => {
    setBusy(true);
    setError(null);
    try {
      await community.setAttendance(meetup.id, true);
      invalidateQueries('community:');
      onChanged?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Katılım kaydedilemedi.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card tone="wine">
      <View style={styles.head}>
        <DateBlock iso={meetup.startsAt} large />
        <View style={{ flex: 1, gap: 4 }}>
          <AppText variant="overline" tone="gold" uppercase>
            Sıradaki buluşma · {meetup.city}
          </AppText>
          <AppText variant="h2" numberOfLines={3}>
            {meetup.title}
          </AppText>
        </View>
      </View>
      <Place meetup={meetup} />
      {meetup.lat != null && meetup.lng != null ? <MapPreview lat={meetup.lat} lng={meetup.lng} label={meetup.placeName} height={130} /> : null}
      <Attendance meetup={meetup} />
      {meetup.organizer ? (
        <AppText variant="caption" tone="subtle">
          Düzenleyen: {meetup.organizer.username}
        </AppText>
      ) : null}
      {error ? (
        <AppText variant="caption" tone="danger" accessibilityRole="alert">
          {error}
        </AppText>
      ) : null}
      <View style={styles.actions}>
        {!meetup.isAttending ? (
          <Button label={full ? 'Kontenjan dolu' : 'Katılıyorum'} icon="checkmark" loading={busy} disabled={full} onPress={() => void join()} />
        ) : null}
        <Button label="Detaylar" variant="secondary" onPress={() => router.push(`/bulusma/${meetup.id}`)} />
      </View>
    </Card>
  );
}

/** Standard meetup card for lists: date, title, meeting point, attendees. */
export function MeetupCard({ meetup }: { meetup: Meetup }) {
  return (
    <Card onPress={() => router.push(`/bulusma/${meetup.id}`)} accessibilityLabel={`${meetup.title}, ${meetup.placeName}, ${meetup.city}. ${meetup.attendeeCount} katılımcı.`}>
      <View style={styles.head}>
        <DateBlock iso={meetup.startsAt} />
        <View style={{ flex: 1, gap: 6 }}>
          <AppText variant="h3" numberOfLines={2}>
            {meetup.title}
          </AppText>
          <Place meetup={meetup} />
        </View>
      </View>
      <Attendance meetup={meetup} />
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', gap: spacing.lg, alignItems: 'flex-start' },
  dateBlock: {
    width: 56,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: 'rgba(11,5,7,0.55)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  dateBlockLg: { width: 68, paddingVertical: spacing.md },
  day: { fontFamily: fonts.display, fontSize: 24, lineHeight: 28, fontWeight: '800', color: colors.text },
  dayLg: { fontSize: 32, lineHeight: 36 },
  line: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  going: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.pill, backgroundColor: 'rgba(98,185,140,0.12)' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
