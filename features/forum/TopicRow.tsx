import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppText, Avatar, PressableScale } from '../../components/ui';
import { colors, spacing } from '../../constants/theme';
import { formatCount, formatRelativeTime } from '../../lib/format';
import type { TopicSummary } from '../../types/forum';

const POPULAR_REPLIES = 5;
const POPULAR_VIEWS = 3000;
const NEW_WINDOW_MS = 6 * 3_600_000;

export function topicBadges(t: TopicSummary, now = Date.now()) {
  return {
    pinned: t.isPinned,
    locked: t.isLocked,
    popular: !t.isLocked && (t.replyCount >= POPULAR_REPLIES || t.viewCount >= POPULAR_VIEWS),
    isNew: now - new Date(t.createdAt).getTime() < NEW_WINDOW_MS,
  };
}

/**
 * Compact forum-index row: title + one meta line. Status is shown as small inline icons
 * (pinned / locked / popular) instead of pills, so rows stay calm and scannable.
 */
export function TopicRow({ topic, showCategory = true }: { topic: TopicSummary; showCategory?: boolean }) {
  const b = topicBadges(topic);
  const context = showCategory ? topic.category.name : topic.author.username;
  const status = [b.pinned && 'sabit', b.locked && 'kilitli', b.popular && 'popüler'].filter(Boolean).join(', ');
  return (
    <PressableScale
      accessibilityRole="link"
      accessibilityLabel={`${topic.title}${status ? ` (${status})` : ''}. ${context}, ${topic.replyCount} yanıt, son aktivite ${formatRelativeTime(topic.lastActivityAt)}`}
      onPress={() => router.push(`/konu/${topic.id}`)}
      style={({ hovered }) => [styles.row, hovered && styles.hovered]}
    >
      <Avatar name={topic.author.username} uri={topic.author.avatarUrl} size={32} />
      <View style={styles.main}>
        <View style={styles.titleRow}>
          {b.pinned ? <Ionicons name="pin" size={13} color={colors.gold} style={styles.icon} /> : null}
          {b.locked ? <Ionicons name="lock-closed" size={13} color={colors.textSubtle} style={styles.icon} /> : null}
          <AppText variant="bodyStrong" numberOfLines={2} style={{ flexShrink: 1 }}>
            {topic.title}
            {b.popular ? '  ' : ''}
            {b.popular ? <Ionicons name="flame" size={13} color={colors.wineBright} /> : null}
          </AppText>
        </View>
        <AppText variant="caption" tone="subtle" numberOfLines={1}>
          {context} · {formatCount(topic.replyCount)} yanıt · {formatRelativeTime(topic.lastActivityAt)}
        </AppText>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    minHeight: 64,
  },
  hovered: { backgroundColor: colors.surfaceHover },
  main: { flex: 1, gap: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 4 },
  icon: { marginTop: 4 },
});
