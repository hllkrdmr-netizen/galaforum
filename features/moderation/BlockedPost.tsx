import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { AppText, PressableScale } from '../../components/ui';
import { colors, spacing } from '../../constants/theme';

/** Collapsed stand-in for a post by a member the reader blocked. */
export function BlockedPost({ username, onReveal }: { username: string; onReveal: () => void }) {
  return (
    <View style={styles.row}>
      <Ionicons name="eye-off-outline" size={16} color={colors.textSubtle} />
      <AppText variant="small" tone="subtle" style={{ flex: 1 }}>
        Engellediğin bir üyenin mesajı ({username})
      </AppText>
      <PressableScale accessibilityRole="button" accessibilityLabel="Mesajı göster" onPress={onReveal} style={styles.show}>
        <AppText variant="small" style={{ color: colors.goldSoft, fontWeight: '700' }}>
          Göster
        </AppText>
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  show: { minHeight: 40, justifyContent: 'center', paddingHorizontal: spacing.md },
});
