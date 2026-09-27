import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { AppText, Container, EmptyState, ErrorState, SectionHeader, SkeletonRow } from '../../components/ui';
import { colors, spacing } from '../../constants/theme';
import { invalidateQueries, useForumQuery } from '../../hooks/useForumQuery';
import { useResponsive } from '../../hooks/useResponsive';
import { forum } from '../../services/forum';
import { CategoryRow } from '../forum/CategoryRow';
import { TopicRow } from '../forum/TopicRow';
import { HeroSection } from './HeroSection';
import { LatestMessage, LatestMessageSkeleton } from './LatestMessage';

/** Home = Gündem: hero → son mesaj → what is being discussed now → categories. */
export function HomeScreen() {
  const { isWide } = useResponsive();
  const [refreshing, setRefreshing] = useState(false);

  const latest = useForumQuery('forum:latest-post', () => forum.getLatestPost(), { staleTime: 15_000 });
  const trending = useForumQuery('forum:trending', () => forum.getTrendingTopics(5));
  const categories = useForumQuery('forum:categories', () => forum.getCategories());

  const refetchLatest = latest.refetch;
  const refetchTrending = trending.refetch;
  const refetchCategories = categories.refetch;
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    invalidateQueries('forum:');
    await Promise.all([refetchLatest(), refetchTrending(), refetchCategories()]);
    setRefreshing(false);
  }, [refetchLatest, refetchTrending, refetchCategories]);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor={colors.gold} />}
    >
      <HeroSection isDemo={forum.mode === 'demo'} />

      <Container style={{ marginTop: spacing.lg }}>
        {latest.isLoading ? (
          <LatestMessageSkeleton />
        ) : latest.data ? (
          <LatestMessage data={latest.data} />
        ) : null}
      </Container>

      <Container style={styles.section}>
        <SectionHeader title="Şu an konuşulanlar" />
        <View style={styles.list}>
          {trending.isLoading ? (
            <>
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
            </>
          ) : trending.error ? (
            <ErrorState compact message={trending.error.message} onRetry={trending.refetch} />
          ) : (trending.data ?? []).length === 0 ? (
            <EmptyState
              compact
              title="Gündem şu an sakin."
              message="Bir tartışma başlat, gündemi sen belirle."
              actionLabel="Konu Aç"
              onAction={() => router.push('/konu-ac')}
            />
          ) : (
            (trending.data ?? []).map((t) => <TopicRow key={t.id} topic={t} />)
          )}
        </View>
      </Container>

      <Container style={styles.section}>
        <SectionHeader title="Kategoriler" />
        <View style={styles.list}>
          {categories.isLoading ? (
            <>
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
            </>
          ) : categories.error ? (
            <ErrorState compact message={categories.error.message} onRetry={categories.refetch} />
          ) : (
            (categories.data ?? []).map((c, i, arr) => (
              <CategoryRow key={c.id} category={c} wide={isWide} isLast={i === arr.length - 1} />
            ))
          )}
        </View>
      </Container>

      <Container style={styles.footer}>
        <AppText variant="tagline" tone="gold" style={{ textAlign: 'center' }}>
          DAİMA GALATASARAY
        </AppText>
        <AppText variant="caption" tone="subtle" style={{ textAlign: 'center', marginTop: spacing.sm }}>
          Bağımsız taraftar platformu; kulübün resmi kanalı değildir.
          {forum.mode === 'demo' ? ' Demo modu: örnek içerik gösteriliyor.' : ''}
        </AppText>
      </Container>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingBottom: 140 },
  section: { marginTop: spacing.xxl },
  list: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  footer: { marginTop: spacing.huge, alignItems: 'center' },
});
