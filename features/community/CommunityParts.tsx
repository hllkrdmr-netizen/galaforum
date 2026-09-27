import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

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

/** Horizontal strip of the most active members (avatar + name + post count). */
export function ActiveMembers({ members }: { members: ActiveMember[] }) {
  return (
    <View style={styles.people}>
      {members.map((m) => (
        <PressableScale
          key={m.id}
          accessibilityRole="link"
          accessibilityLabel={`${m.username}, son 30 günde ${m.postCount} mesaj`}
          onPress={() => router.push(`/uye/${m.username}`)}
          style={styles.person}
        >
          <Avatar name={m.username} uri={m.avatarUrl} size={44} />
          <AppText variant="caption" numberOfLines={1} style={{ maxWidth: 72, fontWeight: '600' }}>
            {m.username}
          </AppText>
          <AppText variant="caption" tone="subtle">
            {m.postCount} mesaj
          </AppText>
        </PressableScale>
      ))}
    </View>
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
  people: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  person: { alignItems: 'center', gap: 2, width: 76 },
});
