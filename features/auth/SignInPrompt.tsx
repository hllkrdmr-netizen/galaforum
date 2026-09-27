import { router, usePathname } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppText, Button } from '../../components/ui';
import { colors, radius, spacing } from '../../constants/theme';
import { useAuth } from '../../lib/auth/AuthProvider';

/**
 * Shown where a signed-in member is required (Supabase mode only). Renders nothing in demo mode
 * or when a session exists, so it can be dropped next to any composer.
 */
export function SignInPrompt({ message = 'Yazmak, beğenmek ve oy vermek için giriş yap.' }: { message?: string }) {
  const { status } = useAuth();
  const pathname = usePathname();
  if (status !== 'signedOut') return null;
  return (
    <View style={styles.box} accessibilityRole="summary">
      <AppText variant="small" tone="muted" style={{ flex: 1, minWidth: 180 }}>
        {message}
      </AppText>
      <View style={styles.actions}>
        <Button label="Giriş yap" onPress={() => router.push({ pathname: '/giris', params: { sonra: pathname } })} />
        <Button label="Üye ol" variant="secondary" onPress={() => router.push('/kayit')} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderGold,
    backgroundColor: 'rgba(217,164,65,0.06)',
    marginVertical: spacing.md,
  },
  actions: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
});
