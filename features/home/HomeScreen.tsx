import { useCallback, useRef, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';

import { AppText, Container, EmptyState, ErrorState, SectionHeader, SkeletonRow } from '../../components/ui';
import { colors, radius, spacing } from '../../constants/theme';
import { invalidateQueries, useForumQuery } from '../../hooks/useForumQuery';
import { useResponsive } from '../../hooks/useResponsive';
import { forum } from '../../services/forum';
import { CategoryRow } from '../forum/CategoryRow';
import { TopicRow } from '../forum/TopicRow';
import { HeroSection } from './HeroSection';
import { LatestMessage, LatestMessageSkeleton } from './LatestMessage';

export function HomeScreen() {
  const { isWide } = useResponsive();
  const scrollRef = useRef<ScrollView>(null);
  const [categoriesY, setCategoriesY] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const overview = useForumQuery('forum:overview', () => forum.getOverview());
  const latest = useForumQuery('forum:latest-post', () => forum.getLatestPost(), { staleTime: 15_000 });
  const categories = useForumQuery('forum:categories', () => forum.getCategories());
  const trending = useForumQuery('forum:trending', () => forum.getTrendingTopics(6));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    invalidateQueries('forum:');
    await Promise.all([overview.refetch(), latest.refetch(), categories.refetch(), trending.refetch()]);
    setRefreshing(false);
  }, [overview, latest, categories, trending]);

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.gold} />}
    >
      <HeroSection
        overview={overview.data}
        isDemo={forum.mode === 'demo'}
        onBrowseCategories={() => scrollRef.current?.scrollTo({ y: Math.max(0, categoriesY - 12), animated: true })}
      />

      <Container style={styles.section}>
        <SectionHeader overline="Son mesaj" title="Forumda en son" />
        {latest.isLoading ? (
          <LatestMessageSkeleton />
        ) : latest.error ? (
          <View style={styles.group}>
            <ErrorState compact message={latest.error.message} onRetry={latest.refetch} />
          </View>
        ) : latest.data ? (
          <LatestMessage data={latest.data} />
        ) : (
          <View style={styles.group}>
            <EmptyState
              compact
              title="Henüz mesaj yok."
              message="Forumdaki ilk mesajı yazmak ister misin?"
              actionLabel="İlk konuyu sen aç"
              onAction={() => router.push('/konu-ac')}
            />
          </View>
        )}
      </Container>

      <Container style={styles.section} onLayout={(e) => setCategoriesY(e.nativeEvent.layout.y)}>
        <SectionHeader overline="Forum" title="Kategoriler" />
        <View style={styles.group}>
          {isWide ? (
            <View style={styles.tableHead}>
              <AppText variant="overline" tone="subtle" uppercase style={{ flex: 1, paddingLeft: 60 }}>
                Kategori
              </AppText>
              <AppText variant="overline" tone="subtle" uppercase style={styles.headStat}>
                Konu
              </AppText>
              <AppText variant="overline" tone="subtle" uppercase style={styles.headStat}>
                Mesaj
              </AppText>
              <AppText variant="overline" tone="subtle" uppercase style={styles.headLast}>
                Son aktivite
              </AppText>
            </View>
          ) : null}
          {categories.isLoading ? (
            <View style={{ paddingHorizontal: spacing.lg }}>
              {Array.from({ length: 6 }).map((_, i) => (
                <SkeletonRow key={i} />
              ))}
            </View>
          ) : categories.error ? (
            <ErrorState compact message={categories.error.message} onRetry={categories.refetch} />
          ) : (
            (categories.data ?? []).map((c, i, arr) => (
              <CategoryRow key={c.id} category={c} wide={isWide} isLast={i === arr.length - 1} />
            ))
          )}
        </View>
      </Container>

      <Container style={styles.section}>
        <SectionHeader overline="Gündem" title="Şu an konuşulanlar" />
        <View style={styles.group}>
          {trending.isLoading ? (
            <View style={{ paddingHorizontal: spacing.lg }}>
              {Array.from({ length: 3 }).map((_, i) => (
                <SkeletonRow key={i} />
              ))}
            </View>
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

      <Container style={styles.footer}>
        <View style={styles.footerRule} />
        <AppText variant="tagline" tone="gold" style={{ textAlign: 'center' }}>
          DAİMA GALATASARAY
        </AppText>
        <AppText variant="caption" tone="subtle" style={{ textAlign: 'center', marginTop: spacing.sm }}>
          GalaForum bağımsız bir taraftar platformudur; kulübün resmi kanalı değildir.
        </AppText>
        {forum.mode === 'demo' ? (
          <AppText variant="caption" tone="subtle" style={{ textAlign: 'center', marginTop: spacing.xs }}>
            Demo modu: örnek içerik gösteriliyor. Gerçek veriler için Supabase bağlantısını yapılandır.
          </AppText>
        ) : null}
      </Container>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingBottom: 140 },
  section: { marginTop: spacing.xxxl },
  group: {
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  tableHead: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: 'rgba(107,20,38,0.18)',
    gap: spacing.md,
  },
  headStat: { width: 72, textAlign: 'center' },
  headLast: { width: 240 + 18 + spacing.md },
  footer: { marginTop: spacing.huge, alignItems: 'center' },
  footerRule: { width: 48, height: 2, backgroundColor: colors.borderGold, marginBottom: spacing.lg, borderRadius: 1 },
});
