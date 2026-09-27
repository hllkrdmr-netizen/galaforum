import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, spacing } from '../../constants/theme';
import { AppText } from './AppText';
import { Container } from './Container';
import { IconButton } from './IconButton';

/** Compact header for secondary screens: back button + title. */
export function ScreenHeader({ title, right }: { title?: string; right?: ReactNode }) {
  const insets = useSafeAreaInsets();
  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/'));
  return (
    <View style={[styles.wrap, { paddingTop: insets.top + spacing.sm }]}>
      <Container style={styles.row}>
        <IconButton icon="chevron-back" label="Geri" onPress={goBack} />
        <AppText variant="h3" numberOfLines={1} style={styles.title} accessibilityRole="header">
          {title ?? ''}
        </AppText>
        <View style={styles.right}>{right}</View>
      </Container>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: colors.bg, borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  title: { flex: 1 },
  right: { minWidth: 44, alignItems: 'flex-end' },
});
