import { router } from 'expo-router';
import type { ErrorBoundaryProps } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AppText, Button } from '../../components/ui';
import { colors, radius, spacing } from '../../constants/theme';

/**
 * Last-resort screen when rendering crashes. Shows a calm Turkish message with "Tekrar dene" and
 * "Ana sayfa"; technical details only in development builds.
 */
export function AppErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return (
    <View style={styles.screen} accessibilityRole="alert">
      <ScrollView contentContainerStyle={styles.content}>
        <AppText variant="tagline" tone="gold">
          DAİMA GALATASARAY
        </AppText>
        <AppText variant="h1" style={{ textAlign: 'center' }}>
          Bir şeyler ters gitti
        </AppText>
        <AppText variant="body" tone="muted" style={{ textAlign: 'center', maxWidth: 420 }}>
          Bu ekran açılırken beklenmeyen bir hata oluştu. Tekrar denemek çoğu zaman yeterli; sorun sürerse ana sayfadan devam et.
        </AppText>
        <View style={styles.actions}>
          <Button label="Tekrar dene" icon="refresh-outline" onPress={() => void retry()} />
          <Button label="Ana sayfa" variant="secondary" icon="home-outline" onPress={() => router.replace('/')} />
        </View>
        {__DEV__ ? (
          <View style={styles.details}>
            <AppText variant="caption" tone="subtle" selectable>
              {error.name}: {error.message}
            </AppText>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.lg, padding: spacing.xxl },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, justifyContent: 'center', marginTop: spacing.md },
  details: { marginTop: spacing.xl, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, maxWidth: 560 },
});
