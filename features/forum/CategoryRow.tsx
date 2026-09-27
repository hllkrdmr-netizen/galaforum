import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppText, PressableScale } from '../../components/ui';
import { colors, spacing } from '../../constants/theme';
import { formatCount, formatRelativeTime } from '../../lib/format';
import type { CategoryWithStats } from '../../types/forum';
import { CategoryIcon } from './CategoryIcon';

/**
 * Compact category row. Mobile: icon + name + one meta line. Wide screens add the short
 * description and the latest topic, since there is room for them without extra height.
 */
export function CategoryRow({
  category,
  wide,
  isLast,
}: {
  category: CategoryWithStats;
  wide: boolean;
  isLast?: boolean;
}) {
  const { stats } = category;
  const meta = `${formatCount(stats.topicCount)} konu${stats.lastActivityAt ? ` · ${formatRelativeTime(stats.lastActivityAt)}` : ''}`;
  return (
    <PressableScale
      accessibilityRole="link"
      accessibilityLabel={`${category.name}. ${stats.topicCount} konu, ${stats.postCount} mesaj.`}
      onPress={() => router.push(`/kategori/${category.slug}`)}
      style={({ hovered }) => [styles.row, !isLast && styles.divider, hovered && styles.hovered]}
    >
      <CategoryIcon icon={category.icon} size={36} />
      <View style={styles.main}>
        <AppText variant="bodyStrong" numberOfLines={1}>
          {category.name}
        </AppText>
        <AppText variant="caption" tone="subtle" numberOfLines={1}>
          {wide ? `${category.description}` : meta}
        </AppText>
      </View>
      {wide ? (
        <View style={styles.lastCol}>
          <AppText variant="small" numberOfLines={1}>
            {stats.lastTopic?.title ?? 'Henüz konu yok'}
          </AppText>
          <AppText variant="caption" tone="subtle">
            {meta}
          </AppText>
        </View>
      ) : null}
      <Ionicons name="chevron-forward" size={18} color={colors.textSubtle} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md, paddingHorizontal: spacing.md, minHeight: 60 },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  hovered: { backgroundColor: colors.surfaceHover },
  main: { flex: 1, gap: 1, minWidth: 0 },
  lastCol: { width: 280, gap: 1 },
});
