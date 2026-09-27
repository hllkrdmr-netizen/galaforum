import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, Button, Container, EmptyState, ErrorState, IconButton, SectionHeader, SkeletonRow } from '../../components/ui';
import { CATEGORY_BY_SLUG } from '../../constants/categories';
import { colors, spacing } from '../../constants/theme';
import { useForumQuery } from '../../hooks/useForumQuery';
import { forum } from '../../services/forum';
import { TopicRow } from '../forum/TopicRow';

type IconName = keyof typeof Ionicons.glyphMap;

export interface SectionScreenProps {
  title: string;
  /** One short sentence under the title. */
  description: string;
  icon: IconName;
  /** Forum categories whose live discussions are listed on this screen. */
  categorySlugs: string[];
  extra?: ReactNode;
}

/** Tab screen for a topic area (Transfer, Topluluk): short header, one action, the live discussion list. */
export function SectionScreen({ title, description, icon, categorySlugs, extra }: SectionScreenProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const key = `forum:section:${categorySlugs.join(',')}`;
  const topics = useForumQuery(key, async () => {
    const pages = await Promise.all(categorySlugs.map((s) => forum.getCategoryTopics(s, 0, 8)));
    return pages
      .flatMap((p) => p.items)
      .sort((a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt))
      .slice(0, 10);
  });
  const primary = CATEGORY_BY_SLUG[categorySlugs[0]];
  const openCreate = () => router.push({ pathname: '/konu-ac', params: primary ? { kategori: primary.slug } : {} });

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ paddingBottom: 140 }}>
      <Container style={{ paddingTop: insets.top + spacing.xl }}>
        <View style={styles.titleRow}>
          <Ionicons name={icon} size={24} color={colors.gold} />
          <AppText variant="h1" accessibilityRole="header" style={{ flex: 1 }} numberOfLines={1}>
            {title}
          </AppText>
          {width >= 420 ? (
            <Button label="Konu Aç" icon="add" variant="secondary" onPress={openCreate} />
          ) : (
            <IconButton icon="add" label="Konu Aç" tone="gold" onPress={openCreate} />
          )}
        </View>
        <AppText variant="small" tone="muted" style={{ marginTop: spacing.xs }}>
          {description}
        </AppText>
      </Container>

      {extra ? <Container style={{ marginTop: spacing.lg }}>{extra}</Container> : null}

      <Container style={{ marginTop: spacing.xl }}>
        <SectionHeader
          title="Son hareketler"
          actionLabel={primary ? 'Tümü' : undefined}
          onAction={primary ? () => router.push(`/kategori/${primary.slug}`) : undefined}
        />
        <View style={styles.list}>
          {topics.isLoading ? (
            <>
              <SkeletonRow />
              <SkeletonRow />
            </>
          ) : topics.error ? (
            <ErrorState compact message={topics.error.message} onRetry={topics.refetch} />
          ) : (topics.data ?? []).length === 0 ? (
            <EmptyState compact title="Bu alanda henüz konu yok." actionLabel="İlk konuyu sen aç" onAction={openCreate} />
          ) : (
            (topics.data ?? []).map((t) => <TopicRow key={t.id} topic={t} />)
          )}
        </View>
      </Container>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  list: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
});
