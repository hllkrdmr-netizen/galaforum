import { StyleSheet, View } from 'react-native';

import { colors, spacing } from '../../constants/theme';
import { AppText } from './AppText';
import { PressableScale } from './PressableScale';

export function SectionHeader({
  overline,
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
      <View style={{ flex: 1 }}>
        {overline ? (
          <View style={styles.overlineRow}>
            <View style={styles.bar} />
            <AppText variant="overline" tone="gold" uppercase>
              {overline}
            </AppText>
          </View>
        ) : null}
        <AppText variant="h1" accessibilityRole="header">
          {title}
        </AppText>
      </View>
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
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.md, marginBottom: spacing.lg },
  overlineRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs },
  bar: { width: 18, height: 2, backgroundColor: colors.gold, borderRadius: 2 },
  action: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.xs },
});
