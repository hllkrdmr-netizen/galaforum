import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppText, Avatar, Pill, PressableScale, Skeleton } from '../../components/ui';
import { colors, radius, spacing } from '../../constants/theme';
import { formatCount, formatDateTime, formatRelativeTime, toPreview } from '../../lib/format';
import type { LatestPost } from '../../types/forum';

export function LatestMessage({ data }: { data: LatestPost }) {
  const { post, topic, category } = data;
  const action = post.isOpeningPost ? 'yeni konu açtı' : 'yanıt yazdı';
  return (
    <PressableScale
      accessibilityRole="link"
      accessibilityLabel={`Son mesaj: ${post.author.username} ${action}, ${topic.title}. ${formatRelativeTime(post.createdAt)}.`}
      accessibilityHint="Konuyu açar"
      onPress={() => router.push(`/konu/${topic.id}`)}
      style={({ hovered }) => [styles.card, hovered && styles.hovered]}
    >
      <View style={styles.accent} />
      <View style={styles.body}>
        <View style={styles.headRow}>
          <Avatar name={post.author.username} uri={post.author.avatarUrl} size={36} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <AppText variant="small" numberOfLines={1}>
              <AppText variant="small" style={{ fontWeight: '700' }}>
                {post.author.username}
              </AppText>
              <AppText variant="small" tone="muted"> {action}</AppText>
            </AppText>
            <AppText variant="caption" tone="subtle" accessibilityLabel={formatDateTime(post.createdAt)}>
              {formatRelativeTime(post.createdAt)}
            </AppText>
          </View>
        </View>

        <View style={styles.categoryRow}>
          <Pill label={category.name} tone="gold" />
        </View>
        <AppText variant="h2" numberOfLines={2} style={styles.title}>
          {topic.title}
        </AppText>
        <AppText variant="body" tone="muted" numberOfLines={2} style={styles.preview}>
          “{toPreview(post.body, 180)}”
        </AppText>

        <View style={styles.footer}>
          <View style={styles.meta}>
            <Ionicons name="chatbubbles-outline" size={14} color={colors.textSubtle} />
            <AppText variant="caption" tone="muted">
              {formatCount(topic.replyCount)} yanıt
            </AppText>
          </View>
          <View style={styles.meta}>
            <AppText variant="caption" tone="gold" style={{ fontWeight: '700' }}>
              Konuya git
            </AppText>
            <Ionicons name="arrow-forward" size={14} color={colors.gold} />
          </View>
        </View>
      </View>
    </PressableScale>
  );
}

export function LatestMessageSkeleton() {
  return (
    <View style={styles.card} accessibilityLabel="Son mesaj yükleniyor">
      <View style={styles.accent} />
      <View style={[styles.body, { gap: spacing.md }]}>
        <View style={styles.headRow}>
          <Skeleton width={36} height={36} rounded={18} />
          <View style={{ flex: 1, gap: 6 }}>
            <Skeleton width="40%" height={12} />
            <Skeleton width="20%" height={10} />
          </View>
        </View>
        <Skeleton width="75%" height={18} />
        <Skeleton width="95%" height={13} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  hovered: { borderColor: colors.borderGold, backgroundColor: colors.surfaceHover },
  accent: { width: 3, backgroundColor: colors.gold },
  body: { flex: 1, padding: spacing.lg },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  categoryRow: { flexDirection: 'row', marginTop: spacing.md },
  title: { marginTop: spacing.sm },
  preview: { marginTop: spacing.xs, fontStyle: 'italic' },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.md },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
