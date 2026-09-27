import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { colors, radius, spacing } from '../../constants/theme';
import { AppText } from './AppText';
import { Button } from './Button';

interface StateProps {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  compact?: boolean;
}

export function EmptyState({ icon = 'chatbubbles-outline', title, message, actionLabel, onAction, compact }: StateProps) {
  return (
    <View style={[styles.wrap, compact && styles.compact]} accessibilityRole="summary">
      <View style={styles.iconWrap}>
        <Ionicons name={icon} size={24} color={colors.gold} />
      </View>
      <AppText variant="h3" style={styles.center}>
        {title}
      </AppText>
      {message ? (
        <AppText variant="small" tone="muted" style={[styles.center, styles.message]}>
          {message}
        </AppText>
      ) : null}
      {actionLabel && onAction ? <Button label={actionLabel} onPress={onAction} style={styles.action} /> : null}
    </View>
  );
}

export function ErrorState({ title = 'Bir şeyler ters gitti', message, onRetry, compact }: {
  title?: string;
  message?: string;
  onRetry?: () => void;
  compact?: boolean;
}) {
  return (
    <View style={[styles.wrap, compact && styles.compact]} accessibilityRole="alert">
      <View style={[styles.iconWrap, styles.errorIcon]}>
        <Ionicons name="cloud-offline-outline" size={24} color={colors.danger} />
      </View>
      <AppText variant="h3" style={styles.center}>
        {title}
      </AppText>
      <AppText variant="small" tone="muted" style={[styles.center, styles.message]}>
        {message ?? 'Bağlantı kurulamadı. İnternetini kontrol edip tekrar dene.'}
      </AppText>
      {onRetry ? <Button label="Tekrar dene" icon="refresh" variant="secondary" onPress={onRetry} style={styles.action} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingVertical: spacing.huge, paddingHorizontal: spacing.xl, gap: spacing.sm },
  compact: { paddingVertical: spacing.xxl },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.goldDim,
    borderWidth: 1,
    borderColor: colors.borderGold,
    marginBottom: spacing.sm,
  },
  errorIcon: { backgroundColor: 'rgba(228,106,94,0.1)', borderColor: 'rgba(228,106,94,0.35)' },
  center: { textAlign: 'center' },
  message: { maxWidth: 380 },
  action: { alignSelf: 'center', marginTop: spacing.md },
});
