import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';

import { AppText, Container, ScreenHeader } from '../../components/ui';
import { colors, radius, spacing } from '../../constants/theme';

/** Shared frame for sign-in / sign-up / password screens: compact brand header + centred form column. */
export function AuthLayout({
  title,
  subtitle,
  headerTitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  headerTitle: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScreenHeader title={headerTitle} />
      <ScrollView contentContainerStyle={{ paddingBottom: 80 }} keyboardShouldPersistTaps="handled">
        <Container style={styles.column}>
          <View style={styles.brand}>
            <LinearGradient colors={['#6B1426', '#2A070E']} style={styles.mark}>
              <AppText variant="h3" tone="gold">
                GF
              </AppText>
            </LinearGradient>
            <View>
              <AppText variant="h3">
                Gala<AppText variant="h3" tone="gold">Forum</AppText>
              </AppText>
              <AppText variant="overline" tone="gold" uppercase>
                Daima Galatasaray
              </AppText>
            </View>
          </View>
          <AppText variant="h1" accessibilityRole="header" style={{ marginTop: spacing.xxl }}>
            {title}
          </AppText>
          {subtitle ? (
            <AppText variant="body" tone="muted" style={{ marginTop: spacing.xs }}>
              {subtitle}
            </AppText>
          ) : null}
          <View style={styles.form}>{children}</View>
          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </Container>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/** Inline status block (success / info / error) for auth flows. */
export function Notice({ tone, children }: { tone: 'success' | 'error' | 'info'; children: ReactNode }) {
  const palette = {
    success: { bg: 'rgba(98,185,140,0.10)', border: 'rgba(98,185,140,0.4)', fg: colors.success },
    error: { bg: 'rgba(228,106,94,0.08)', border: 'rgba(228,106,94,0.4)', fg: colors.danger },
    info: { bg: 'rgba(217,164,65,0.08)', border: colors.borderGold, fg: colors.goldSoft },
  }[tone];
  return (
    <View
      accessibilityRole={tone === 'error' ? 'alert' : 'summary'}
      accessibilityLiveRegion="polite"
      style={[styles.notice, { backgroundColor: palette.bg, borderColor: palette.border }]}
    >
      <AppText variant="small" style={{ color: palette.fg }}>
        {children}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  column: { maxWidth: 480, paddingTop: spacing.xxl },
  brand: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  mark: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderGold,
  },
  form: { marginTop: spacing.xxl, gap: spacing.lg },
  footer: { marginTop: spacing.xxl, gap: spacing.sm, alignItems: 'flex-start' },
  notice: { borderWidth: 1, borderRadius: radius.md, padding: spacing.md },
});
