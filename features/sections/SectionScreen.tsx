import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, Button, Container, EmptyState, ErrorState, SectionHeader, SkeletonRow } from '../../components/ui';
import { CATEGORY_BY_SLUG } from '../../constants/categories';
import { colors, radius, spacing } from '../../constants/theme';
import { useForumQuery } from '../../hooks/useForumQuery';
import { forum } from '../../services/forum';
import { TopicRow } from '../forum/TopicRow';

type IconName = keyof typeof Ionicons.glyphMap;

export interface SectionScreenProps {
  overline: string;
  title: string;
  description: string;
  icon: IconName;
  /** Planned capabilities shown honestly as "yakında". */
  upcoming: { icon: IconName; label: string }[];
  /** Forum categories whose live discussions are listed on this screen. */
  categorySlugs: string[];
  extra?: ReactNode;
}

export function SectionScreen({ overline, title, description, icon, upcoming, categorySlugs, extra }: SectionScreenProps) {
  const insets = useSafeAreaInsets();
  const key = `forum:section:${categorySlugs.join(',')}`;
  const topics = useForumQuery(key, async () => {
    const pages = await Promise.all(categorySlugs.map((s) => forum.getCategoryTopics(s, 0, 8)));
    return pages
      .flatMap((p) => p.items)
      .sort((a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt))
      .slice(0, 8);
  });
  const primary = CATEGORY_BY_SLUG[categorySlugs[0]];

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ paddingBottom: 140 }}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.xxl }]}>
        <LinearGradient colors={['#0B0507', '#1E060D', '#2E0812']} style={StyleSheet.absoluteFill} />
        <Container>
          <View style={styles.overlineRow}>
            <Ionicons name={icon} size={16} color={colors.gold} />
            <AppText variant="overline" tone="gold" uppercase>
              {overline}
            </AppText>
          </View>
          <AppText variant="displaySm" accessibilityRole="header">
            {title}
          </AppText>
          <AppText variant="body" tone="muted" style={styles.desc}>
            {description}
          </AppText>
          <View style={styles.actions}>
            <Button
              label="Konu Aç"
              icon="add"
              onPress={() => router.push({ pathname: '/konu-ac', params: primary ? { kategori: primary.slug } : {} })}
            />
            {primary ? (
              <Button label={`${primary.name} kategorisi`} variant="secondary" onPress={() => router.push(`/kategori/${primary.slug}`)} />
            ) : null}
          </View>
        </Container>
      </View>

      {extra ? <Container style={styles.section}>{extra}</Container> : null}

      <Container style={styles.section}>
        <SectionHeader overline="Tartışmalar" title="Son hareketler" />
        <View style={styles.group}>
          {topics.isLoading ? (
            <View style={{ paddingHorizontal: spacing.lg }}>
              <SkeletonRow />
              <SkeletonRow />
            </View>
          ) : topics.error ? (
            <ErrorState compact message={topics.error.message} onRetry={topics.refetch} />
          ) : (topics.data ?? []).length === 0 ? (
            <EmptyState
              compact
              title="Bu alanda henüz konu yok."
              actionLabel="İlk konuyu sen aç"
              onAction={() => router.push({ pathname: '/konu-ac', params: primary ? { kategori: primary.slug } : {} })}
            />
          ) : (
            (topics.data ?? []).map((t) => <TopicRow key={t.id} topic={t} />)
          )}
        </View>
      </Container>

      <Container style={styles.section}>
        <SectionHeader overline="Yakında" title="Bu alanda neler olacak" />
        <View style={styles.upcoming}>
          {upcoming.map((u) => (
            <View key={u.label} style={styles.upItem}>
              <Ionicons name={u.icon} size={18} color={colors.gold} />
              <AppText variant="small" tone="muted" style={{ flex: 1 }}>
                {u.label}
              </AppText>
            </View>
          ))}
        </View>
      </Container>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: { paddingBottom: spacing.xxxl, overflow: 'hidden', borderBottomWidth: 1, borderBottomColor: colors.border },
  overlineRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  desc: { marginTop: spacing.md, maxWidth: 560 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.xl },
  section: { marginTop: spacing.xxxl },
  group: {
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  upcoming: { gap: spacing.sm },
  upItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
});
