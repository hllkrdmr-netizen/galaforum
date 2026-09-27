import { StyleSheet, View } from 'react-native';

import { colors, spacing } from '../../constants/theme';
import { AppText } from './AppText';
import { PressableScale } from './PressableScale';

/**
 * One-line section heading: small gold bar + title (+ optional text action).
 * `overline` is accepted for backwards compatibility but no longer rendered —
 * a single heading per section keeps screens calm.
 */
export function SectionHeader({
  title,
  actionLabel,
  onAction,
}: {
  overline?: string;
  title: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.bar} />
      <AppText variant="h2" accessibilityRole="header" style={{ flex: 1 }} numberOfLines={1}>
        {title}
      </AppText>
      {actionLabel && onAction ? (
        <PressableScale accessibilityRole="button" onPress={onAction} style={styles.action}>
          <AppText variant="small" tone="gold" style={{ fontWeight: '700' }}>
            {actionLabel}
          </AppText>
        </PressableScale>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  bar: { width: 3, height: 18, backgroundColor: colors.gold, borderRadius: 2 },
  action: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.xs },
});
