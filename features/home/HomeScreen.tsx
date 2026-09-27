import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { AppText, Container, EmptyState, ErrorState, PressableScale, SectionHeader, Skeleton, SkeletonRow } from '../../components/ui';
import { colors, layout, radius, spacing } from '../../constants/theme';
import { invalidateQueries, useForumQuery } from '../../hooks/useForumQuery';
import { useResponsive } from '../../hooks/useResponsive';
import { isLive, nextMatch } from '../../lib/match';
import { community } from '../../services/community';
import { forum } from '../../services/forum';
import { matches } from '../../services/match';
import { MeetupCard } from '../community/MeetupCards';
import { TopicRow } from '../forum/TopicRow';
import { LiveMatchCard } from '../match/MatchParts';
import { HeroSection } from './HeroSection';
import { CategoryTile, FeaturedTopicCard, MatchTeaser } from './HomeParts';
import { LatestMessage, LatestMessageSkeleton } from './LatestMessage';

/** Home = Gündem: hero → match of the day → featured discussion → what's hot → categories → community. */
export function HomeScreen() {
  const { width, isWide, isDesktop, gutter } = useResponsive();
  const [refreshing, setRefreshing] = useState(false);

  const latest = useForumQuery('forum:latest-post', () => forum.getLatestPost(), { staleTime: 15_000 });
  const trending = useForumQuery('forum:trending', () => forum.getTrendingTopics(6));
  const categories = useForumQuery('forum:categories', () => forum.getCategories());
  const fixtures = useForumQuery('match:list', () => matches.listMatches(), { staleTime: 20_000 });
  const meetups = useForumQuery('community:meetups:', () => community.listMeetups());
  const topId = trending.data?.[0]?.id;
  const featured = useForumQuery(`forum:topic:${topId}:featured`, () => forum.getTopic(topId!, 0, 12), { enabled: Boolean(topId) });

  const liveMatch = (fixtures.data ?? []).find((m) => isLive(m.status));
  const upcoming = nextMatch(fixtures.data ?? []);
  const rest = (trending.data ?? []).slice(1, 6);
  const meetup = meetups.data?.[0];

  const refetchAll = [latest.refetch, trending.refetch, categories.refetch, fixtures.refetch, meetups.refetch];
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    invalidateQueries('forum:');
    invalidateQueries('match:');
    invalidateQueries('community:');
    await Promise.all(refetchAll.map((r) => r()));
    setRefreshing(false);
  }, refetchAll);

  // Category grid: 2 columns on phones, 3 on tablets, 4 on desktop.
  const inner = Math.min(width, layout.maxContentWidth) - gutter * 2;
  const cols = isDesktop ? 4 : isWide ? 3 : 2;
  const tileW = Math.floor((inner - spacing.md * (cols - 1)) / cols);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor={colors.gold} />}
    >
      <HeroSection isDemo={forum.mode === 'demo'} />

      {liveMatch || upcoming ? (
        <Container style={{ marginTop: spacing.lg }}>
          {liveMatch ? <LiveMatchCard match={liveMatch} /> : upcoming ? <MatchTeaser match={upcoming} /> : null}
        </Container>
      ) : null}

      <Container style={{ marginTop: spacing.lg }}>
        {latest.isLoading ? <LatestMessageSkeleton /> : latest.data ? <LatestMessage data={latest.data} /> : null}
      </Container>

      <Container style={styles.section}>
        <SectionHeader title="Şu an konuşulanlar" />
        {trending.isLoading ? (
          <Skeleton height={220} rounded={radius.xl} />
        ) : trending.error ? (
          <ErrorState compact message={trending.error.message} onRetry={trending.refetch} />
        ) : (trending.data ?? []).length === 0 ? (
          <EmptyState compact title="Gündem şu an sakin." message="Bir tartışma başlat, gündemi sen belirle." actionLabel="Konu Aç" onAction={() => router.push('/konu-ac')} />
        ) : (
          <View style={[styles.split, isDesktop && styles.splitWide]}>
            <View style={isDesktop ? { flex: 1 } : undefined}>
              {featured.data ? <FeaturedTopicCard topic={featured.data} /> : <Skeleton height={220} rounded={radius.xl} />}
            </View>
            <View style={[styles.list, isDesktop ? { flex: 1 } : { marginTop: spacing.md }]}>
              {rest.map((t) => (
                <TopicRow key={t.id} topic={t} />
              ))}
            </View>
          </View>
        )}
      </Container>

      <Container style={styles.section}>
        <SectionHeader title="Kategoriler" />
        {categories.isLoading ? (
          <SkeletonRow />
        ) : categories.error ? (
          <ErrorState compact message={categories.error.message} onRetry={categories.refetch} />
        ) : (
          <View style={styles.grid}>
            {(categories.data ?? []).map((c) => (
              <CategoryTile key={c.id} category={c} width={tileW} />
            ))}
          </View>
        )}
      </Container>

      {meetup ? (
        <Container style={styles.section}>
          <SectionHeader title="Topluluktan" actionLabel="Tümü" onAction={() => router.push('/topluluk')} />
          <MeetupCard meetup={meetup} />
        </Container>
      ) : null}

      <Container style={styles.footer}>
        <PressableScale accessibilityRole="link" onPress={() => router.push('/konu-ac')} style={styles.footerCta}>
          <Ionicons name="add-circle-outline" size={18} color={colors.gold} />
          <AppText variant="small" tone="gold" style={{ fontWeight: '800' }}>
            Aklındaki konuyu aç
          </AppText>
        </PressableScale>
        <AppText variant="tagline" tone="gold" style={{ textAlign: 'center', marginTop: spacing.xl }}>
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
  split: {},
  splitWide: { flexDirection: 'row', gap: spacing.xl, alignItems: 'flex-start' },
  list: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  footer: { marginTop: spacing.huge, alignItems: 'center' },
  footerCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 48,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderGold,
  },
});
