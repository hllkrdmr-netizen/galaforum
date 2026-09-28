import { useEffect, useRef, useState } from 'react';
import type { Post } from '../../types/forum';
import { ReplyComposer, TopicPoll } from '../../features/forum/Interactions';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { FlatList, StyleSheet, View } from 'react-native';

import { AppText, Button, Container, EmptyState, ErrorState, Pill, PressableScale, ScreenHeader, Skeleton, SkeletonRow } from '../../components/ui';
import { colors, layout, spacing } from '../../constants/theme';
import { useForumQuery } from '../../hooks/useForumQuery';
import { useResponsive } from '../../hooks/useResponsive';
import { formatCount } from '../../lib/format';
import { PostItem } from '../../features/forum/PostItem';
import { topicBadges } from '../../features/forum/TopicRow';
import { SignInPrompt } from '../../features/auth/SignInPrompt';
import { FollowTopicButton } from '../../features/community/FollowButtons';
import { forum } from '../../services/forum';
import { RestrictionNotice } from '../../features/moderation/ModParts';
import { TopicModTools } from '../../features/moderation/TopicModTools';
import { BlockedPost, RemovedPost } from '../../features/moderation/BlockedPost';
import { useBlocks, useMyRestriction } from '../../hooks/useModeration';

export default function TopicScreen() {
  const { id = '', mesaj } = useLocalSearchParams<{ id: string; mesaj?: string }>();
  return <TopicContent key={`${id}:${mesaj ?? ''}`} id={id} target={mesaj ? String(mesaj) : null} />;
}

const PAGE = 20;

/** `target`: a post id from a deep link (?mesaj=…); the thread opens on its page and scrolls to it. */
function TopicContent({ id, target }: { id: string; target: string | null }) {
  const [cursor, setCursor] = useState(0);
  const [quote, setQuote] = useState<Post | null>(null);
  const list = useRef<FlatList<Post>>(null);
  const { gutter } = useResponsive();
  const topic = useForumQuery(`forum:topic:${id}:${cursor}`, () => forum.getTopic(id, cursor), { staleTime: 10_000 });
  const { isBlocked } = useBlocks();
  const restriction = useMyRestriction();
  const [revealed, setRevealed] = useState<ReadonlySet<string>>(new Set());
  const position = useForumQuery(`forum:pos:${id}:${target ?? ''}`, () => forum.getPostPosition(id, target!), { enabled: Boolean(target), staleTime: 60_000 });
  const [jumpState, setJumpState] = useState<'page' | 'scroll' | 'done'>(target ? 'page' : 'done');
  const [highlight, setHighlight] = useState<string | null>(target);

  // 1) open the page that contains the post
  useEffect(() => {
    if (jumpState !== 'page' || position.isLoading) return;
    if (position.data == null) {
      setJumpState('done');
      setHighlight(null);
      return;
    }
    setCursor(Math.floor(position.data / PAGE) * PAGE);
    setJumpState('scroll');
  }, [jumpState, position.isLoading, position.data]);

  // 2) scroll to it once that page is on screen, then fade the highlight
  // (timers live in a ref so the state change below does not cancel them)
  const loadedPosts = topic.data?.posts;
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  useEffect(() => {
    if (jumpState !== 'scroll' || !loadedPosts || !target) return;
    const index = loadedPosts.findIndex((p) => p.id === target);
    if (index < 0) return;
    setJumpState('done');
    timers.current.push(
      setTimeout(() => list.current?.scrollToIndex({ index, viewPosition: 0.15, animated: true }), 250),
      setTimeout(() => setHighlight(null), 4500),
    );
  }, [jumpState, loadedPosts, target]);

  if (topic.isLoading) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Konu" />
        <Container style={{ paddingTop: spacing.xxl, gap: spacing.md }}>
          <Skeleton width="80%" height={26} />
          <Skeleton width="40%" height={14} />
          <SkeletonRow />
          <SkeletonRow />
        </Container>
      </View>
    );
  }
  if (topic.error) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Konu" />
        <ErrorState message={topic.error.message} onRetry={topic.refetch} />
      </View>
    );
  }
  const t = topic.data;
  if (!t) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Konu" />
        <EmptyState icon="document-outline" title="Konu bulunamadı." message="Kaldırılmış ya da taşınmış olabilir." actionLabel="Ana sayfaya dön" onAction={() => router.replace('/')} />
      </View>
    );
  }
  const b = topicBadges(t);

  return (
    <View style={styles.screen}>
      <ScreenHeader title={t.category.name} right={<FollowTopicButton topicId={t.id} />} />
      <FlatList
        ref={list}
        keyboardShouldPersistTaps="handled"
        data={t.posts}
        keyExtractor={(p) => p.id}
        contentContainerStyle={{ paddingBottom: 80 }}
        initialNumToRender={8}
        ListHeaderComponent={
          <Container style={styles.head}>
            <PressableScale accessibilityRole="link" onPress={() => router.push(`/kategori/${t.category.slug}`)} style={{ alignSelf: 'flex-start' }}>
              <Pill label={t.category.name} tone="gold" />
            </PressableScale>
            <AppText variant="h1" accessibilityRole="header" style={styles.title}>
              {t.title}
            </AppText>
            <View style={styles.metaRow}>
              {b.pinned ? <Pill label="Sabit" tone="gold" icon="pin" /> : null}
              {b.locked ? <Pill label="Kilitli" icon="lock-closed" /> : null}
              {b.popular ? <Pill label="Popüler" tone="wine" icon="flame" /> : null}
              <View style={styles.stat}>
                <Ionicons name="chatbubble-outline" size={14} color={colors.textSubtle} />
                <AppText variant="caption" tone="muted">{formatCount(t.replyCount)} yanıt</AppText>
              </View>
              <View style={styles.stat}>
                <Ionicons name="eye-outline" size={14} color={colors.textSubtle} />
                <AppText variant="caption" tone="muted">{formatCount(t.viewCount)} görüntülenme</AppText>
              </View>
            </View>
            <TopicModTools topic={t} />
            <TopicPoll topicId={id} locked={t.isLocked} />
          </Container>
        }
        onScrollToIndexFailed={(info) => {
          list.current?.scrollToOffset({ offset: info.averageItemLength * info.index, animated: false });
          setTimeout(() => list.current?.scrollToIndex({ index: info.index, viewPosition: 0.15, animated: true }), 300);
        }}
        renderItem={({ item, index }) => (
          <View
            style={[
              { width: '100%', maxWidth: layout.maxContentWidth, alignSelf: 'center', paddingHorizontal: gutter },
              highlight === item.id && styles.highlight,
            ]}
          >
            {item.removed ? (
              <RemovedPost index={cursor + index} />
            ) : isBlocked(item.author.id) && !revealed.has(item.id) ? (
              <BlockedPost username={item.author.username} onReveal={() => setRevealed((r) => new Set(r).add(item.id))} />
            ) : (
              <PostItem post={item} index={cursor + index} onQuote={t.isLocked || restriction ? undefined : (post) => { setQuote(post); list.current?.scrollToEnd({ animated: true }); }} />
            )}
          </View>
        )}
        ListFooterComponent={<Container>
          {cursor > 0 || t.nextCursor !== null ? <View style={[styles.metaRow, { paddingVertical: spacing.lg }]}>
            <Button label="Önceki sayfa" variant="secondary" disabled={cursor === 0} onPress={() => { setCursor(Math.max(0, cursor - 20)); list.current?.scrollToOffset({ offset: 0 }); }} />
            <AppText>Sayfa {Math.floor(cursor / 20) + 1}</AppText>
            <Button label="Sonraki sayfa" variant="secondary" disabled={t.nextCursor === null} onPress={() => { if (t.nextCursor !== null) setCursor(t.nextCursor); list.current?.scrollToOffset({ offset: 0 }); }} />
          </View> : null}
          {t.isLocked ? <View style={styles.locked}><AppText tone="subtle">Bu konu yanıtlara kapatılmıştır.</AppText></View> :
            restriction ? <RestrictionNotice restriction={restriction} /> : <><SignInPrompt /><ReplyComposer topicId={id} quote={quote} clearQuote={() => setQuote(null)} onSent={() => { setCursor(Math.floor((t.replyCount + 1) / 20) * 20); }} /></>}
        </Container>}

      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  head: { paddingTop: spacing.xxl, paddingBottom: spacing.lg },
  title: { marginTop: spacing.md },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.md, marginTop: spacing.md },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  locked: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl },
  highlight: { backgroundColor: 'rgba(217,164,65,0.08)', borderLeftWidth: 3, borderLeftColor: colors.gold },
});
