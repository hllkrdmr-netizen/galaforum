import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import {
  AppText,
  Button,
  IconButton,
  Container,
  EmptyState,
  ErrorState,
  PressableScale,
  ScreenHeader,
  SectionHeader,
  Skeleton,
  SkeletonRow,
} from '../../components/ui';
import { colors, radius, spacing } from '../../constants/theme';
import { SignInPrompt } from '../../features/auth/SignInPrompt';
import { ReplyComposer, TopicPoll } from '../../features/forum/Interactions';
import { PostItem } from '../../features/forum/PostItem';
import { CountdownBlocks, EventTimeline, Scoreboard } from '../../features/match/MatchParts';
import { invalidateQueries, useForumQuery } from '../../hooks/useForumQuery';
import { isLive, matchTitle, REACTIONS } from '../../lib/match';
import { forum } from '../../services/forum';
import { matches } from '../../services/match';
import type { ReactionCounts, ReactionType } from '../../types/match';

const ROOM_PAGE = 20;

export default function MatchRoomScreen() {
  const { id = '' } = useLocalSearchParams<{ id: string }>();
  const { width } = useWindowDimensions();
  const [tab, setTab] = useState<'akis' | 'yorumlar'>('akis');
  const detail = useForumQuery(`match:detail:${id}`, () => matches.getMatch(id), { staleTime: 10_000 });
  const match = detail.data?.match;
  const topicId = match?.topicId ?? null;

  // Room = the newest page of the auto-generated match topic (chronological, latest at the bottom).
  const room = useForumQuery(
    `forum:topic:${topicId}:room`,
    async () => {
      const head = await forum.getTopic(topicId!, 0, 1);
      if (!head) return null;
      const total = head.replyCount + 1;
      const cursor = Math.max(0, total - ROOM_PAGE);
      return forum.getTopic(topicId!, cursor, ROOM_PAGE);
    },
    { enabled: Boolean(topicId), staleTime: 5_000 },
  );

  const refetchDetail = detail.refetch;
  const refetchRoom = room.refetch;
  useEffect(() => {
    if (!match) return;
    return matches.subscribe(match.id, topicId, () => {
      void refetchDetail();
      if (topicId) void refetchRoom();
    });
  }, [match?.id, topicId, refetchDetail, refetchRoom]);

  if (detail.isLoading) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Maç" />
        <Container style={{ paddingTop: spacing.xxl, gap: spacing.md }}>
          <Skeleton height={180} rounded={radius.xl} />
          <SkeletonRow />
        </Container>
      </View>
    );
  }
  if (detail.error) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Maç" />
        <ErrorState message={detail.error.message} onRetry={detail.refetch} />
      </View>
    );
  }
  if (!match || !detail.data) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Maç" />
        <EmptyState icon="football-outline" title="Maç bulunamadı." actionLabel="Maç merkezine dön" onAction={() => router.replace('/mac')} />
      </View>
    );
  }

  const live = isLive(match.status);
  const t = room.data;
  // Narrow screens: timeline and comments as tabs instead of one long scroll.
  const tabbed = width < 760 && match.status !== 'scheduled';

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title={live ? 'Canlı Maç Odası' : 'Maç Detayı'}
        right={topicId ? <IconButton icon="open-outline" label="Tüm maç konusunu aç" onPress={() => router.push(`/konu/${topicId}`)} /> : null}
      />
      <ScrollView contentContainerStyle={{ paddingBottom: 80 }} keyboardShouldPersistTaps="handled">
        <Container style={{ paddingTop: spacing.xl, gap: spacing.xl, maxWidth: 860 }}>
          <Scoreboard match={match} />

          {match.status === 'scheduled' ? (
            <View style={{ gap: spacing.md }}>
              <CountdownBlocks kickoffAt={match.kickoffAt} />
              <AppText variant="small" tone="muted">
                Maç başladığında bu sayfa canlı odaya dönüşür: skor, dakika ve önemli anlar anlık güncellenir.
              </AppText>
            </View>
          ) : null}

          {live ? <Reactions matchId={match.id} initial={detail.data.reactions} /> : null}

          {match.status === 'scheduled' ? (
            <Button
              label="İlk 11’ini kur"
              variant="secondary"
              icon="grid-outline"
              onPress={() => router.push({ pathname: '/ilk-11', params: { mac: match.id } })}
            />
          ) : null}

          {tabbed ? (
            <View style={styles.tabs} accessibilityRole="tablist">
              {(['akis', 'yorumlar'] as const).map((k) => (
                <PressableScale
                  key={k}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: tab === k }}
                  onPress={() => setTab(k)}
                  style={[styles.tab, tab === k && styles.tabOn]}
                >
                  <AppText variant="small" style={{ fontWeight: '800', color: tab === k ? colors.goldSoft : colors.textMuted }}>
                    {k === 'akis' ? 'Akış' : `Yorumlar${t ? ` (${t.replyCount})` : ''}`}
                  </AppText>
                </PressableScale>
              ))}
            </View>
          ) : null}

          {match.status !== 'scheduled' && (!tabbed || tab === 'akis') ? (
            <View>
              {tabbed ? null : <SectionHeader title="Önemli anlar" />}
              <View style={styles.group}>
                <View style={{ paddingHorizontal: spacing.lg }}>
                  <EventTimeline events={detail.data.events} match={match} />
                </View>
              </View>
            </View>
          ) : null}

          {!tabbed || tab === 'yorumlar' ? (
          <View>
            {tabbed ? null : <SectionHeader title="Taraftar yorumları" />}
            {!topicId ? (
              <EmptyState compact title="Bu maç için konu henüz açılmadı." />
            ) : room.isLoading ? (
              <View>
                <SkeletonRow />
                <SkeletonRow />
              </View>
            ) : room.error ? (
              <ErrorState compact message={room.error.message} onRetry={room.refetch} />
            ) : !t ? (
              <EmptyState compact title="Maç konusu bulunamadı." />
            ) : (
              <>
                <TopicPoll topicId={t.id} locked={t.isLocked} />
                {t.posts.length > 0 && t.posts[0].isOpeningPost === false ? (
                  <PressableScale accessibilityRole="link" onPress={() => router.push(`/konu/${t.id}`)} style={styles.older}>
                    <Ionicons name="time-outline" size={14} color={colors.gold} />
                    <AppText variant="small" tone="gold" style={{ fontWeight: '700' }}>
                      Önceki yorumlar
                    </AppText>
                  </PressableScale>
                ) : null}
                {t.posts.map((p, i) => (
                  <PostItem key={p.id} post={p} index={Math.max(0, t.replyCount + 1 - t.posts.length) + i} />
                ))}
                {t.isLocked ? (
                  <AppText variant="small" tone="subtle" style={{ paddingVertical: spacing.lg }}>
                    Bu maç konusu yanıtlara kapatıldı.
                  </AppText>
                ) : (
                  <>
                    <SignInPrompt message="Maç odasına yazmak ve tepki vermek için giriş yap." />
                    <ReplyComposer
                      topicId={t.id}
                      quote={null}
                      clearQuote={() => undefined}
                      onSent={() => {
                        invalidateQueries(`forum:topic:${t.id}`);
                        void room.refetch();
                      }}
                    />
                  </>
                )}
              </>
            )}
          </View>
          ) : null}

          <AppText variant="caption" tone="subtle">
            {matchTitle(match)} · {matches.mode === 'demo' ? 'Demo verisi — gerçek maç bilgisi değildir.' : 'Skor ve dakika maç yönetimi tarafından güncellenir.'}
          </AppText>
        </Container>
      </ScrollView>
    </View>
  );
}

function Reactions({ matchId, initial }: { matchId: string; initial: ReactionCounts }) {
  const [counts, setCounts] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<ReactionType | null>(null);
  useEffect(() => setCounts(initial), [initial]);
  const react = async (type: ReactionType) => {
    setBusy(type);
    setError(null);
    try {
      setCounts(await matches.react(matchId, type));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Tepki kaydedilemedi.');
    } finally {
      setBusy(null);
    }
  };
  return (
    <View style={{ gap: spacing.sm }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.reactions} accessibilityLabel="Maç tepkileri">
        {REACTIONS.map((r) => (
          <PressableScale
            key={r.type}
            accessibilityRole="button"
            accessibilityLabel={`${r.label}, ${counts[r.type]}`}
            disabled={busy !== null}
            onPress={() => void react(r.type)}
            style={({ hovered }) => [styles.reaction, hovered && { borderColor: colors.gold }]}
          >
            <AppText variant="small" style={{ fontWeight: '800' }}>
              {r.label}
            </AppText>
            <AppText variant="small" tone="gold">
              {counts[r.type]}
            </AppText>
          </PressableScale>
        ))}
      </ScrollView>
      {error ? (
        <AppText variant="caption" tone="danger" accessibilityRole="alert">
          {error}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, alignItems: 'center' },
  group: { borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  reactions: { flexDirection: 'row', gap: spacing.xs },
  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border },
  tab: { flex: 1, alignItems: 'center', minHeight: 44, justifyContent: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabOn: { borderBottomColor: colors.gold },
  reaction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 40,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  older: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: spacing.md, minHeight: 44 },
});
