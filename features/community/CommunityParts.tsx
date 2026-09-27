import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AppText, Avatar, PressableScale } from '../../components/ui';
import { colors, radius, spacing } from '../../constants/theme';
import type { ActiveMember, Badge, Meetup } from '../../types/community';

type IconName = keyof typeof Ionicons.glyphMap;
const MONTHS = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
const DAYS = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];

export function meetupWhen(iso: string) {
  const d = new Date(iso);
  const hh = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return { day: String(d.getDate()), month: MONTHS[d.getMonth()], weekday: DAYS[d.getDay()], time: hh };
}

/** List row: date block · title · place/city · attendance. */
export function MeetupRow({ meetup, isLast }: { meetup: Meetup; isLast?: boolean }) {
  const w = meetupWhen(meetup.startsAt);
  const full = meetup.capacity != null && meetup.attendeeCount >= meetup.capacity;
  return (
    <PressableScale
      accessibilityRole="link"
      accessibilityLabel={`${meetup.title}. ${w.day} ${w.month} ${w.time}, ${meetup.placeName}, ${meetup.city}. ${meetup.attendeeCount} katılımcı.`}
      onPress={() => router.push(`/bulusma/${meetup.id}`)}
      style={({ hovered }) => [styles.row, !isLast && styles.divider, hovered && { backgroundColor: colors.surfaceHover }]}
    >
      <View style={styles.date}>
        <AppText variant="h3" style={{ lineHeight: 20 }}>
          {w.day}
        </AppText>
        <AppText variant="caption" tone="subtle">
          {w.month}
        </AppText>
      </View>
      <View style={{ flex: 1, gap: 1 }}>
        <AppText variant="bodyStrong" numberOfLines={2}>
          {meetup.title}
        </AppText>
        <AppText variant="caption" tone="subtle" numberOfLines={1}>
          {w.weekday} {w.time} · {meetup.city} · {meetup.attendeeCount}
          {meetup.capacity ? `/${meetup.capacity}` : ''} katılımcı{full ? ' · dolu' : ''}
          {meetup.isAttending ? ' · katılıyorsun' : ''}
        </AppText>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textSubtle} />
    </PressableScale>
  );
}

export function BadgeChip({ badge }: { badge: Badge }) {
  const icon = (badge.icon in Ionicons.glyphMap ? badge.icon : 'ribbon-outline') as IconName;
  return (
    <View style={styles.badge} accessible accessibilityLabel={`Rozet: ${badge.name}. ${badge.description}`}>
      <Ionicons name={icon} size={14} color={colors.gold} />
      <AppText variant="caption" style={{ fontWeight: '700', color: colors.textMuted }}>
        {badge.name}
      </AppText>
    </View>
  );
}

/** Horizontal strip of the most active members; the top three get a gold ring and rank. */
export function ActiveMembers({ members }: { members: ActiveMember[] }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.people}>
      {members.map((m, i) => (
        <PressableScale
          key={m.id}
          accessibilityRole="link"
          accessibilityLabel={`${i + 1}. ${m.username}, son 30 günde ${m.postCount} mesaj`}
          onPress={() => router.push(`/uye/${m.username}`)}
          style={({ hovered }) => [styles.person, hovered && { backgroundColor: colors.surfaceHover }]}
        >
          <View style={[styles.avatarRing, i < 3 && styles.avatarRingTop]}>
            <Avatar name={m.username} uri={m.avatarUrl} size={52} />
          </View>
          {i < 3 ? (
            <View style={styles.rank}>
              <AppText variant="caption" style={{ fontSize: 10, fontWeight: '900', color: colors.textOnGold }}>
                {i + 1}
              </AppText>
            </View>
          ) : null}
          <AppText variant="caption" numberOfLines={1} style={{ maxWidth: 84, fontWeight: '700', marginTop: 6 }}>
            {m.username}
          </AppText>
          <AppText variant="caption" tone="subtle">
            {m.postCount} mesaj
          </AppText>
        </PressableScale>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md, paddingHorizontal: spacing.md, minHeight: 64 },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  date: {
    width: 44,
    alignItems: 'center',
    paddingVertical: 4,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  people: { flexDirection: 'row', gap: spacing.sm, paddingVertical: spacing.xs },
  person: { alignItems: 'center', width: 96, paddingVertical: spacing.sm, borderRadius: radius.lg },
  avatarRing: { padding: 3, borderRadius: 40, borderWidth: 2, borderColor: 'transparent' },
  avatarRingTop: { borderColor: colors.gold },
  rank: {
    position: 'absolute',
    top: spacing.sm + 44,
    right: 22,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.gold,
    borderWidth: 2,
    borderColor: colors.bg,
  },
});
