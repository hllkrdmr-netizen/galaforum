import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, Container, EmptyState, ErrorState, Pill, PressableScale, SectionHeader, SkeletonRow } from '../../components/ui';
import { colors, radius, spacing } from '../../constants/theme';
import { invalidateQueries, useForumQuery } from '../../hooks/useForumQuery';
import { isLive, nextMatch } from '../../lib/match';
import { forum } from '../../services/forum';
import { matches } from '../../services/match';
import { TopicRow } from '../forum/TopicRow';
import { LiveMatchBanner, MatchRow, NextMatchCard } from './MatchParts';

export function MatchHubScreen() {
  const insets = useSafeAreaInsets();
  const list = useForumQuery('match:list', () => matches.listMatches(), { staleTime: 20_000 });
  const talk = useForumQuery('forum:category:mac-taktik:hub', () => forum.getCategoryTopics('mac-taktik', 0, 6));
  const [refreshing, setRefreshing] = useState(false);

  const all = list.data ?? [];
  const live = all.filter((m) => isLive(m.status));
  const next = nextMatch(all);
  const upcoming = all.filter((m) => m.status === 'scheduled' && m.id !== next?.id);
  const results = all.filter((m) => m.status === 'finished').reverse().slice(0, 5);

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
      <View style={[styles.header, { paddingTop: insets.top + spacing.xxl }]}>
        <LinearGradient colors={['#0B0507', '#1E060D', '#2E0812']} style={StyleSheet.absoluteFill} />
        <Container>
          <View style={styles.overlineRow}>
            <Ionicons name="football-outline" size={16} color={colors.gold} />
            <AppText variant="overline" tone="gold" uppercase>
              Maç merkezi
            </AppText>
            {matches.mode === 'demo' ? <Pill label="Demo fikstür" /> : null}
          </View>
          <AppText variant="displaySm" accessibilityRole="header">
            Maç
          </AppText>
          <AppText variant="body" tone="muted" style={{ marginTop: spacing.sm, maxWidth: 560 }}>
            Sıradaki maç, canlı maç odası, önemli anlar ve ilk 11 tahminlerin — hepsi forum tartışmasıyla bağlantılı.
          </AppText>
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
              <LiveMatchBanner key={m.id} match={m} />
            ))}
            {next ? <NextMatchCard match={next} /> : null}
          </>
        )}

        <PressableScale
          accessibilityRole="link"
          accessibilityLabel="İlk 11 kurucu: dizilişini seç, oyuncularını yerleştir ve paylaş"
          onPress={() => router.push({ pathname: '/ilk-11', params: next ? { mac: next.id } : {} })}
          style={({ hovered }) => [styles.lineupCta, hovered && { borderColor: colors.gold }]}
        >
          <View style={styles.ctaIcon}>
            <Ionicons name="grid-outline" size={22} color={colors.gold} />
          </View>
          <View style={{ flex: 1 }}>
            <AppText variant="h3">İlk 11’ini kur</AppText>
            <AppText variant="small" tone="muted">
              4-2-3-1, 4-3-3, 3-4-3 ya da 4-4-2 seç; oyuncuları sahaya sürükle ve maç konusunda paylaş.
            </AppText>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textSubtle} />
        </PressableScale>
      </Container>

      {upcoming.length > 0 ? (
        <Container style={styles.section}>
          <SectionHeader overline="Fikstür" title="Yaklaşan maçlar" />
          <View style={styles.group}>
            {upcoming.map((m, i) => (
              <MatchRow key={m.id} match={m} isLast={i === upcoming.length - 1} />
            ))}
          </View>
        </Container>
      ) : null}

      {results.length > 0 ? (
        <Container style={styles.section}>
          <SectionHeader overline="Sonuçlar" title="Son maçlar" />
          <View style={styles.group}>
            {results.map((m, i) => (
              <MatchRow key={m.id} match={m} isLast={i === results.length - 1} />
            ))}
          </View>
        </Container>
      ) : null}

      <Container style={styles.section}>
        <SectionHeader
          overline="Maç & Taktik"
          title="Son tartışmalar"
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
          ) : (talk.data?.items ?? []).length === 0 ? (
            <EmptyState compact title="Bu kategoride henüz konu yok." actionLabel="İlk konuyu sen aç" onAction={() => router.push({ pathname: '/konu-ac', params: { kategori: 'mac-taktik' } })} />
          ) : (
            (talk.data?.items ?? []).map((t) => <TopicRow key={t.id} topic={t} showCategory={false} />)
          )}
        </View>
      </Container>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: { paddingBottom: spacing.xxl, overflow: 'hidden', borderBottomWidth: 1, borderBottomColor: colors.border },
  overlineRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  section: { marginTop: spacing.xxxl },
  group: { borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  lineupCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  ctaIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(107,20,38,0.45)',
    borderWidth: 1,
    borderColor: 'rgba(217,164,65,0.22)',
  },
});
