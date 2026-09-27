import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { AppText, Button, Container, EmptyState, ErrorState, ScreenHeader, SkeletonRow } from '../../components/ui';
import { CATEGORY_BY_SLUG } from '../../constants/categories';
import { colors, layout, radius, spacing } from '../../constants/theme';
import { useForumQuery } from '../../hooks/useForumQuery';
import { useResponsive } from '../../hooks/useResponsive';
import { FollowCategoryButton } from '../../features/community/FollowButtons';
import { CategoryIcon } from '../../features/forum/CategoryIcon';
import { TopicRow } from '../../features/forum/TopicRow';
import { forum } from '../../services/forum';
import type { TopicSummary } from '../../types/forum';

const PAGE = 20;

export default function CategoryScreen() {
  const { slug = '' } = useLocalSearchParams<{ slug: string }>();
  const category = CATEGORY_BY_SLUG[slug];
  const { gutter } = useResponsive();
  const first = useForumQuery(`forum:category:${slug}:0`, () => forum.getCategoryTopics(slug, 0, PAGE), { enabled: Boolean(category) });
  const [extra, setExtra] = useState<TopicSummary[]>([]);
  const [cursor, setCursor] = useState<number | null | undefined>(undefined);
  const [loadingMore, setLoadingMore] = useState(false);

  const nextCursor = cursor === undefined ? first.data?.nextCursor ?? null : cursor;
  const items = [...(first.data?.items ?? []), ...extra];

  const loadMore = useCallback(async () => {
    if (loadingMore || nextCursor == null) return;
    setLoadingMore(true);
    try {
      const page = await forum.getCategoryTopics(slug, nextCursor, PAGE);
      setExtra((e) => [...e, ...page.items]);
      setCursor(page.nextCursor);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, nextCursor, slug]);

  const openCreate = () => router.push({ pathname: '/konu-ac', params: { kategori: slug } });

  if (!category) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Kategori" />
        <EmptyState icon="compass-outline" title="Kategori bulunamadı." actionLabel="Ana sayfaya dön" onAction={() => router.replace('/')} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScreenHeader title={category.name} />
      <FlatList
        data={items}
        keyExtractor={(t) => t.id}
        contentContainerStyle={{ paddingBottom: 60 }}
        onEndReached={loadMore}
        onEndReachedThreshold={0.4}
        ListHeaderComponent={
          <Container style={styles.head}>
            <View style={styles.headRow}>
              <CategoryIcon icon={category.icon} size={56} />
              <View style={{ flex: 1 }}>
                <AppText variant="h1" accessibilityRole="header">
                  {category.name}
                </AppText>
                <AppText variant="small" tone="muted">
                  {category.description}
                </AppText>
              </View>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.lg }}>
              <Button label="Konu Aç" icon="add" onPress={openCreate} />
              <FollowCategoryButton slug={category.slug} />
            </View>
          </Container>
        }
        ListEmptyComponent={
          <Container>
            {first.isLoading ? (
              <View>
                <SkeletonRow />
                <SkeletonRow />
                <SkeletonRow />
              </View>
            ) : first.error ? (
              <ErrorState message={first.error.message} onRetry={first.refetch} />
            ) : (
              <EmptyState title="Bu kategoride henüz konu yok." actionLabel="İlk konuyu sen aç" onAction={openCreate} />
            )}
          </Container>
        }
        renderItem={({ item }) => (
          <View style={{ width: '100%', maxWidth: layout.maxContentWidth, alignSelf: 'center', paddingHorizontal: gutter }}>
            <TopicRow topic={item} showCategory={false} />
          </View>
        )}
        ListFooterComponent={
          loadingMore ? (
            <Container>
              <SkeletonRow />
            </Container>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  head: { paddingTop: spacing.xxl, paddingBottom: spacing.lg, marginBottom: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, borderRadius: radius.lg },
});
