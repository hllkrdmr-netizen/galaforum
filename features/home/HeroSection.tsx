import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Image, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, Button, IconButton, Pill } from '../../components/ui';
import { colors, fonts, gradients, layout, spacing } from '../../constants/theme';
import { useResponsive } from '../../hooks/useResponsive';
import { formatCount } from '../../lib/format';
import type { ForumOverview } from '../../types/forum';
import { SearchBar } from '../forum/SearchBar';

const LION = require('../../assets/images/lion-hero-realistic.png');

export function HeroSection({
  overview,
  isDemo,
  onBrowseCategories,
}: {
  overview?: ForumOverview;
  isDemo: boolean;
  onBrowseCategories?: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { width, isWide, isDesktop, gutter } = useResponsive();

  // Lion composition: large, anchored right, partially cropped for a cinematic feel.
  const lionSize = isDesktop ? 700 : isWide ? Math.min(620, width * 0.8) : Math.min(560, width * 1.08);
  const innerWidth = Math.min(width, layout.maxContentWidth);
  // Keep only the outer red mane tip beyond the viewport; preserve the supplied image.
  const lionRight = -lionSize * 0.09;
  const lionTop = isDesktop ? -30 : insets.top + (isWide ? 0 : 6);
  const textTop = isDesktop ? 0 : isWide ? lionSize * 0.34 : lionSize * 0.58;
  // Veil stops are computed against the full viewport so there is no visible seam at the container edge.
  const side = Math.max(0, (width - innerWidth) / 2);
  const veilStart = (side + innerWidth * (isDesktop ? 0.3 : isWide ? 0.25 : 0.0)) / width;
  const veilEnd = (side + innerWidth * (isDesktop ? 0.62 : isWide ? 0.7 : 0.9)) / width;
  const veilStops = [0, veilStart, Math.min(0.99, (veilStart + veilEnd) / 2), Math.min(1, veilEnd)] as const;
  const titleSize = isDesktop ? 88 : isWide ? 72 : width < 360 ? 46 : 54;

  return (
    <View style={[styles.hero, { paddingTop: insets.top + spacing.md }]}>
      <LinearGradient colors={gradients.hero} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }} style={StyleSheet.absoluteFill} />
      {/* Warm stadium glow from the top-left; restrained */}
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(140,29,51,0.32)', 'rgba(140,29,51,0)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.55, y: 0.7 }}
        style={StyleSheet.absoluteFill}
      />
      {/* Lion layer — anchored to the viewport, with the outer mane tip clipped */}
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <View style={{ flex: 1, width: '100%' }}>
          <View
            pointerEvents="none"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={[styles.lionWrap, { width: lionSize, height: lionSize, right: lionRight, top: lionTop }]}
          >
            <Image source={LION} style={{ width: lionSize, height: lionSize }} resizeMode="contain" />
          </View>
        </View>
      </View>
      {/* Readability veil: full-bleed, fades the lion behind the text column */}
      <LinearGradient
        pointerEvents="none"
        colors={isWide ? gradients.readability : gradients.readabilitySoft}
        locations={veilStops}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient pointerEvents="none" colors={gradients.fadeToBg} style={styles.bottomFade} />

      <View style={[styles.stage, { maxWidth: innerWidth }]}>
        {/* Top bar */}
        <View style={[styles.topBar, { paddingHorizontal: gutter }]}>
          <View style={styles.brandRow}>
            <View style={styles.brandDot} />
            <AppText variant="overline" tone="gold" uppercase>
              Taraftar Forumu
            </AppText>
            {isDemo ? <Pill label="Demo" tone="neutral" /> : null}
          </View>
          <IconButton icon="person-circle-outline" label="Profil ve diğer seçenekler" onPress={() => router.push('/daha')} />
        </View>

        {/* Copy + actions */}
        <View style={[styles.copy, { paddingHorizontal: gutter, marginTop: textTop, maxWidth: isDesktop ? 600 : 560 }]}>
          <AppText
            accessibilityRole="header"
            style={[styles.title, { fontSize: titleSize, lineHeight: titleSize * 1.02 }]}
            maxFontSizeMultiplier={1.2}
          >
            Gala<AppText style={[styles.title, styles.titleGold, { fontSize: titleSize, lineHeight: titleSize * 1.02 }]}>Forum</AppText>
          </AppText>
          <View style={styles.taglineRow}>
            <View style={styles.taglineBar} />
            <AppText
              variant="tagline"
              tone="gold"
              numberOfLines={1}
              style={isDesktop ? { fontSize: 18, letterSpacing: 6 } : width < 360 ? { fontSize: 13, letterSpacing: 2.4 } : null}
            >
              DAİMA GALATASARAY
            </AppText>
          </View>
          <AppText variant="body" tone="muted" style={[styles.lead, isDesktop && { fontSize: 17, lineHeight: 26 }]}>
            Maç analizinden transfer gündemine, tribün hatıralarından kulüp tarihine — Galatasaray taraftarının
            derinlikli tartışma adresi.
          </AppText>

          <View style={styles.search}>
            <SearchBar />
          </View>

          <View style={styles.actions}>
            <Button
              label="Konu Aç"
              icon="add"
              size="lg"
              onPress={() => router.push('/konu-ac')}
              accessibilityHint="Yeni bir tartışma başlatır"
            />
            {onBrowseCategories ? (
              <Button label="Kategoriler" variant="secondary" size="lg" icon="grid-outline" onPress={onBrowseCategories} />
            ) : null}
          </View>

          {overview ? (
            <AppText variant="caption" tone="muted" style={styles.stats}>
              <AppText variant="caption" tone="default" style={styles.statNum}>{formatCount(overview.topicCount)}</AppText> konu
              {'   ·   '}
              <AppText variant="caption" tone="default" style={styles.statNum}>{formatCount(overview.postCount)}</AppText> mesaj
              {'   ·   '}
              <AppText variant="caption" tone="default" style={styles.statNum}>{formatCount(overview.memberCount)}</AppText> aktif üye
            </AppText>
          ) : (
            <View style={{ height: 16 }} />
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { width: '100%', overflow: 'hidden', backgroundColor: colors.bg },
  beam: { position: 'absolute', top: -80, width: 90, height: 520 },
  stage: { width: '100%', alignSelf: 'center', paddingBottom: spacing.huge, minHeight: 520, zIndex: 2 },
  lionWrap: { position: 'absolute' },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', zIndex: 2 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  brandDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.gold },
  copy: { zIndex: 2, width: '100%' },
  title: {
    fontFamily: fonts.display,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -1,
    textShadowColor: 'rgba(0,0,0,0.55)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 18,
  },
  titleGold: { color: colors.gold },
  taglineRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.sm },
  taglineBar: { width: 28, height: 2, backgroundColor: colors.gold, borderRadius: 1 },
  lead: { marginTop: spacing.lg, maxWidth: 520 },
  search: { marginTop: spacing.xxl, maxWidth: 520 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.lg },
  stats: { marginTop: spacing.xl, letterSpacing: 0.3 },
  statNum: { fontWeight: '700' },
  bottomFade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 90 },
});
