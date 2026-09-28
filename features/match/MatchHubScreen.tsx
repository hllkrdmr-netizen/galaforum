import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, Button, Container, EmptyState, ErrorState, Pill, SectionHeader, SkeletonRow } from '../../components/ui';
import { colors, spacing } from '../../constants/theme';
import { invalidateQueries, useForumQuery } from '../../hooks/useForumQuery';
import { useStaff } from '../../hooks/useModeration';
import { isLive, nextMatch } from '../../lib/match';
import { forum } from '../../services/forum';
import { matches } from '../../services/match';
import { TopicRow } from '../forum/TopicRow';
import { LiveMatchCard, MatchRow, NextMatchCard } from './MatchParts';

export function MatchHubScreen() {
  const insets = useSafeAreaInsets();
  const { isStaff } = useStaff();
  const list = useForumQuery('match:list', () => matches.listMatches(), { staleTime: 20_000 });
  const talk = useForumQuery('forum:category:mac-taktik:hub', () => forum.getCategoryTopics('mac-taktik', 0, 12));
  const [refreshing, setRefreshing] = useState(false);

  const all = list.data ?? [];
  const live = all.filter((m) => isLive(m.status));
  const next = nextMatch(all);
  const upcoming = all.filter((m) => m.status === 'scheduled' && m.id !== next?.id);
  const results = all.filter((m) => m.status === 'finished').reverse().slice(0, 5);
  // Match rooms are reachable from the fixtures above; don't list them twice.
  const roomIds = new Set(all.map((m) => m.topicId).filter(Boolean));
  const talkItems = (talk.data?.items ?? []).filter((t) => !roomIds.has(t.id)).slice(0, 5);

  // Keep scores fresh while a match is live.
  const refetchList = list.refetch;
  useEffect(() => {
    if (live.length === 0) return;
    const t = setInterval(() => void refetchList(), 30_000);
    return () => clearInterval(t);
  }, [live.length, refetchList]);

  const onRefresh = async () => {
    setRefreshing(true);
    invalidateQueries('match:');
    await Promise.all([list.refetch(), talk.refetch()]);
    setRefreshing(false);
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ paddingBottom: 140 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor={colors.gold} />}
    >
      <View style={{ paddingTop: insets.top + spacing.xl }}>
        <Container>
          {matches.mode === 'demo' ? (
            <View style={{ marginBottom: spacing.xs }}>
              <Pill label="Demo fikstür" />
            </View>
          ) : null}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md }}>
            <AppText variant="displaySm" accessibilityRole="header">
              Maç
            </AppText>
            {isStaff ? <Button label="Maç yönetimi" variant="secondary" icon="settings-outline" onPress={() => router.push('/mac-yonetimi')} /> : null}
          </View>
        </Container>
      </View>

      <Container style={{ gap: spacing.lg, marginTop: spacing.xxl }}>
        {list.isLoading ? (
          <View style={styles.group}>
            <View style={{ paddingHorizontal: spacing.lg }}>
              <SkeletonRow />
              <SkeletonRow />
            </View>
          </View>
        ) : list.error ? (
          <ErrorState message={list.error.message} onRetry={list.refetch} />
        ) : all.length === 0 ? (
          <EmptyState
            icon="calendar-outline"
            title="Fikstür henüz eklenmedi."
            message="Maçlar eklendiğinde geri sayım, canlı oda ve maç konuları burada görünecek."
          />
        ) : (
          <>
            {live.map((m) => (
              <LiveMatchCard key={m.id} match={m} />
            ))}
            {next ? <NextMatchCard match={next} /> : null}
          </>
        )}

        {!next && all.length > 0 ? (
          <Button label="İlk 11’ini kur" variant="secondary" icon="grid-outline" onPress={() => router.push('/ilk-11')} />
        ) : null}
      </Container>

      {upcoming.length > 0 ? (
        <Container style={styles.section}>
          <SectionHeader title="Yaklaşan maçlar" />
          <View style={styles.group}>
            {upcoming.map((m, i) => (
              <MatchRow key={m.id} match={m} isLast={i === upcoming.length - 1} />
            ))}
          </View>
        </Container>
      ) : null}

      {results.length > 0 ? (
        <Container style={styles.section}>
          <SectionHeader title="Son maçlar" />
          <View style={styles.group}>
            {results.map((m, i) => (
              <MatchRow key={m.id} match={m} isLast={i === results.length - 1} />
            ))}
          </View>
        </Container>
      ) : null}

      <Container style={styles.section}>
        <SectionHeader
          title="Taktik tartışmaları"
          actionLabel="Tümü"
          onAction={() => router.push('/kategori/mac-taktik')}
        />
        <View style={styles.group}>
          {talk.isLoading ? (
            <View style={{ paddingHorizontal: spacing.lg }}>
              <SkeletonRow />
            </View>
          ) : talk.error ? (
            <ErrorState compact message={talk.error.message} onRetry={talk.refetch} />
          ) : talkItems.length === 0 ? (
            <EmptyState compact title="Bu kategoride henüz konu yok." actionLabel="İlk konuyu sen aç" onAction={() => router.push({ pathname: '/konu-ac', params: { kategori: 'mac-taktik' } })} />
          ) : (
            talkItems.map((t) => <TopicRow key={t.id} topic={t} showCategory={false} />)
          )}
        </View>
      </Container>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  section: { marginTop: spacing.xxl },
  group: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
});
