import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppText, Avatar, Pill, PressableScale } from '../../components/ui';
import { colors, spacing } from '../../constants/theme';
import { formatCount, formatRelativeTime } from '../../lib/format';
import type { TopicSummary } from '../../types/forum';

const POPULAR_REPLIES = 3;
const NEW_WINDOW_MS = 6 * 3_600_000;

export function topicBadges(t: TopicSummary, now = Date.now()) {
  return {
    pinned: t.isPinned,
    locked: t.isLocked,
    popular: !t.isLocked && (t.replyCount >= POPULAR_REPLIES || t.viewCount >= 1500),
    isNew: now - new Date(t.createdAt).getTime() < NEW_WINDOW_MS,
  };
}

export function TopicRow({ topic, showCategory = true }: { topic: TopicSummary; showCategory?: boolean }) {
  const b = topicBadges(topic);
  const last = topic.lastReplier ?? topic.author;
  return (
    <PressableScale
      accessibilityRole="link"
      accessibilityLabel={`${topic.title}. ${topic.replyCount} yanıt. Son aktivite ${formatRelativeTime(topic.lastActivityAt)}`}
      onPress={() => router.push(`/konu/${topic.id}`)}
      style={({ hovered }) => [styles.row, hovered && styles.hovered]}
    >
      <Avatar name={topic.author.username} uri={topic.author.avatarUrl} size={40} />
      <View style={styles.main}>
        {b.pinned || b.locked || b.popular || b.isNew ? (
          <View style={styles.badges}>
            {b.pinned ? <Pill label="Sabit" tone="gold" icon="pin" /> : null}
            {b.locked ? <Pill label="Kilitli" icon="lock-closed" /> : null}
            {b.popular ? <Pill label="Popüler" tone="wine" icon="flame" /> : null}
            {b.isNew ? <Pill label="Yeni" tone="success" /> : null}
          </View>
        ) : null}
        <AppText variant="bodyStrong" numberOfLines={2}>
          {topic.title}
        </AppText>
        <AppText variant="caption" tone="subtle" numberOfLines={1} style={styles.meta}>
          {showCategory ? `${topic.category.name} · ` : ''}
          {topic.author.username} · {formatRelativeTime(topic.createdAt)}
        </AppText>
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Ionicons name="chatbubble-outline" size={13} color={colors.textSubtle} />
            <AppText variant="caption" tone="muted">
              {formatCount(topic.replyCount)}
            </AppText>
          </View>
          <View style={styles.stat}>
            <Ionicons name="eye-outline" size={13} color={colors.textSubtle} />
            <AppText variant="caption" tone="muted">
              {formatCount(topic.viewCount)}
            </AppText>
          </View>
          <AppText variant="caption" tone="subtle" numberOfLines={1} style={{ flexShrink: 1 }}>
            Son: <AppText variant="caption" tone="gold">{last.username}</AppText> · {formatRelativeTime(topic.lastActivityAt)}
          </AppText>
        </View>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    borderRadius: 4,
  },
  hovered: { backgroundColor: colors.surfaceHover },
  main: { flex: 1, gap: 3 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: 2 },
  meta: { marginTop: 1 },
  statsRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.xs },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
