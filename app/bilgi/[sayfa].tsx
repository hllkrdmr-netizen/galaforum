import { router, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AppText, Container, EmptyState, PressableScale, ScreenHeader } from '../../components/ui';
import { colors, radius, spacing } from '../../constants/theme';
import { env } from '../../lib/env';
import { isLegalSlug, LEGAL_PAGES, LEGAL_UPDATED, legalPage } from '../../lib/legal';

/** Topluluk kuralları, kullanım koşulları ve gizlilik metni. */
export default function LegalScreen() {
  const { sayfa } = useLocalSearchParams<{ sayfa: string }>();
  if (!isLegalSlug(sayfa)) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Bilgi" />
        <EmptyState icon="document-outline" title="Sayfa bulunamadı." actionLabel="Ana sayfaya dön" onAction={() => router.replace('/')} />
      </View>
    );
  }
  const page = legalPage(sayfa, { operatorName: env.operatorName, contactEmail: env.contactEmail });
  return (
    <View style={styles.screen}>
      <ScreenHeader title={page.title} />
      <ScrollView contentContainerStyle={{ paddingBottom: 96 }}>
        <Container style={{ paddingTop: spacing.xl, gap: spacing.xl, maxWidth: 720 }}>
          <View style={{ gap: spacing.sm }}>
            <AppText variant="h1" accessibilityRole="header">
              {page.title}
            </AppText>
            <AppText variant="caption" tone="subtle">
              Son güncelleme: {LEGAL_UPDATED}
            </AppText>
            <AppText variant="body" tone="muted" style={styles.p}>
              {page.intro}
            </AppText>
          </View>
          {page.sections.map((s) => (
            <View key={s.title} style={{ gap: spacing.sm }}>
              <AppText variant="h3" accessibilityRole="header">
                {s.title}
              </AppText>
              {s.paragraphs.map((p, i) => (
                <AppText key={i} variant="body" style={styles.p} selectable>
                  {p}
                </AppText>
              ))}
            </View>
          ))}
          <View style={styles.others}>
            {LEGAL_PAGES.filter((p) => p.slug !== sayfa).map((p) => (
              <PressableScale key={p.slug} accessibilityRole="link" onPress={() => router.replace(`/bilgi/${p.slug}`)} style={styles.link}>
                <AppText variant="small" style={{ color: colors.goldSoft, fontWeight: '700' }}>
                  {p.title} →
                </AppText>
              </PressableScale>
            ))}
          </View>
        </Container>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  p: { lineHeight: 25 },
  others: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingTop: spacing.lg, gap: spacing.xs },
  link: { minHeight: 44, justifyContent: 'center', borderRadius: radius.sm },
});
