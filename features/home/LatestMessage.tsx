import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppText, Avatar, PressableScale, Skeleton } from '../../components/ui';
import { colors, radius, spacing } from '../../constants/theme';
import { formatDateTime, formatRelativeTime, toPreview } from '../../lib/format';
import type { LatestPost } from '../../types/forum';

/** One-row "Son mesaj" strip: who wrote where and when, with a one-line preview. */
export function LatestMessage({ data }: { data: LatestPost }) {
  const { post, topic } = data;
  const action = post.isOpeningPost ? 'yeni konu açtı' : 'yanıt yazdı';
  return (
    <PressableScale
      accessibilityRole="link"
      accessibilityLabel={`Son mesaj: ${post.author.username} ${action}, ${topic.title}. ${formatRelativeTime(post.createdAt)}.`}
      accessibilityHint="Konuyu açar"
      onPress={() => router.push(`/konu/${topic.id}`)}
      style={({ hovered }) => [styles.strip, hovered && styles.hovered]}
    >
      <Avatar name={post.author.username} uri={post.author.avatarUrl} size={32} />
      <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
        <AppText variant="caption" tone="subtle" numberOfLines={1}>
          <AppText variant="caption" tone="gold" style={{ fontWeight: '800' }}>
            Son mesaj
          </AppText>
          {'  ·  '}
          {post.author.username} {action} · <AppText variant="caption" tone="subtle" accessibilityLabel={formatDateTime(post.createdAt)}>{formatRelativeTime(post.createdAt)}</AppText>
        </AppText>
        <AppText variant="bodyStrong" numberOfLines={1}>
          {topic.title}
        </AppText>
        <AppText variant="small" tone="muted" numberOfLines={1}>
          {toPreview(post.body, 120)}
        </AppText>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textSubtle} />
    </PressableScale>
  );
}

export function LatestMessageSkeleton() {
  return (
    <View style={styles.strip} accessibilityLabel="Son mesaj yükleniyor">
      <Skeleton width={32} height={32} rounded={16} />
      <View style={{ flex: 1, gap: 6 }}>
        <Skeleton width="45%" height={10} />
        <Skeleton width="80%" height={14} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    borderLeftWidth: 3,
    borderLeftColor: colors.gold,
    backgroundColor: colors.surface,
  },
  hovered: { backgroundColor: colors.surfaceHover },
});
