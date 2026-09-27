import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppText, PressableScale } from '../../components/ui';
import { colors, spacing } from '../../constants/theme';
import { formatCount, formatRelativeTime } from '../../lib/format';
import type { CategoryWithStats } from '../../types/forum';
import { CategoryIcon } from './CategoryIcon';

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
  const a11y = `${category.name}. ${category.description} ${stats.topicCount} konu, ${stats.postCount} mesaj.`;
  return (
    <PressableScale
      accessibilityRole="link"
      accessibilityLabel={a11y}
      onPress={() => router.push(`/kategori/${category.slug}`)}
      style={({ hovered }) => [styles.row, !isLast && styles.divider, hovered && styles.hovered]}
    >
      <CategoryIcon icon={category.icon} size={wide ? 48 : 44} />
      <View style={styles.main}>
        <AppText variant="h3" numberOfLines={1}>
          {category.name}
        </AppText>
        <AppText variant="small" tone="muted" numberOfLines={wide ? 1 : 2}>
          {category.description}
        </AppText>
        {!wide ? (
          <AppText variant="caption" tone="subtle" numberOfLines={1} style={{ marginTop: 2 }}>
            {formatCount(stats.topicCount)} konu · {formatCount(stats.postCount)} mesaj
            {stats.lastActivityAt ? ` · ${formatRelativeTime(stats.lastActivityAt)}` : ''}
          </AppText>
        ) : null}
      </View>

      {wide ? (
        <>
          <View style={styles.statCol}>
            <AppText variant="bodyStrong">{formatCount(stats.topicCount)}</AppText>
            <AppText variant="caption" tone="subtle">
              konu
            </AppText>
          </View>
          <View style={styles.statCol}>
            <AppText variant="bodyStrong">{formatCount(stats.postCount)}</AppText>
            <AppText variant="caption" tone="subtle">
              mesaj
            </AppText>
          </View>
          <View style={styles.lastCol}>
            {stats.lastTopic ? (
              <>
                <AppText variant="small" numberOfLines={1}>
                  {stats.lastTopic.title}
                </AppText>
                <AppText variant="caption" tone="gold">
                  {formatRelativeTime(stats.lastActivityAt)}
                </AppText>
              </>
            ) : (
              <AppText variant="small" tone="subtle">
                Henüz konu yok
              </AppText>
            )}
          </View>
        </>
      ) : null}
      <Ionicons name="chevron-forward" size={18} color={colors.textSubtle} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  hovered: { backgroundColor: colors.surfaceHover },
  main: { flex: 1, gap: 2, minWidth: 0 },
  statCol: { width: 72, alignItems: 'center' },
  lastCol: { width: 240, gap: 2 },
});
