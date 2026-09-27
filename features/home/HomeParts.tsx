import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppText, AvatarStack, Button, Card, Pill, PressableScale } from '../../components/ui';
import { colors, fonts, radius, spacing } from '../../constants/theme';
import { useNow } from '../../hooks/useNow';
import { formatCount, formatRelativeTime, toPreview } from '../../lib/format';
import { countdown, kickoffLabel, matchTitle } from '../../lib/match';
import type { AuthorSummary, CategoryWithStats, TopicDetail } from '../../types/forum';
import type { Match } from '../../types/match';
import { CategoryIcon } from '../forum/CategoryIcon';

/** Compact next-match teaser for the home screen (full card lives in the Maç tab). */
export function MatchTeaser({ match }: { match: Match }) {
  const now = useNow(30_000);
  const c = countdown(match.kickoffAt, now);
  const left = c.days > 0 ? `${c.days} gün ${c.hours} saat` : `${c.hours} saat ${c.minutes} dk`;
  return (
    <Card tone="wine" onPress={() => router.push(`/mac/${match.id}`)} accessibilityLabel={`Sıradaki maç: ${matchTitle(match)}, ${kickoffLabel(match.kickoffAt)}`}>
      <View style={styles.teaserRow}>
        <View style={{ flex: 1, gap: 4 }}>
          <AppText variant="overline" tone="gold" uppercase>
            Sıradaki maç · {match.competition}
          </AppText>
          <AppText variant="h2" numberOfLines={1}>
            {matchTitle(match)}
          </AppText>
          <AppText variant="caption" tone="subtle">
            {kickoffLabel(match.kickoffAt)}
            {match.venue ? ` · ${match.venue}` : ''}
          </AppText>
        </View>
        <View style={styles.countBox}>
          <AppText variant="caption" tone="subtle">
            kalan
          </AppText>
          <AppText style={styles.countValue} numberOfLines={1}>
            {left}
          </AppText>
        </View>
      </View>
    </Card>
  );
}

/** The most talked-about topic, with its opening post and the people in the conversation. */
export function FeaturedTopicCard({ topic }: { topic: TopicDetail }) {
  const opening = topic.posts.find((p) => p.isOpeningPost) ?? topic.posts[0];
  const people: AuthorSummary[] = [];
  for (const p of topic.posts) if (!people.some((x) => x.id === p.author.id)) people.push(p.author);
  return (
    <Card tone="default" onPress={() => router.push(`/konu/${topic.id}`)} accessibilityLabel={`Öne çıkan tartışma: ${topic.title}`}>
      <View style={styles.featuredTop}>
        <Pill label={topic.category.name} tone="gold" />
        <View style={styles.hot}>
          <Ionicons name="flame" size={12} color={colors.wineBright} />
          <AppText variant="caption" style={{ color: '#F2B8C0', fontWeight: '700' }}>
            Öne çıkan
          </AppText>
        </View>
      </View>
      <AppText variant="h2" numberOfLines={3}>
        {topic.title}
      </AppText>
      {opening ? (
        <AppText variant="body" tone="muted" numberOfLines={3}>
          {toPreview(opening.body, 220)}
        </AppText>
      ) : null}
      <View style={styles.featuredFoot}>
        <AvatarStack people={people} total={people.length} size={26} />
        <AppText variant="caption" tone="subtle" style={{ flex: 1 }} numberOfLines={1}>
          {formatCount(topic.replyCount)} yanıt · {formatCount(topic.viewCount)} görüntülenme · {formatRelativeTime(topic.lastActivityAt)}
        </AppText>
      </View>
      <Button label="Tartışmaya katıl" icon="chatbubbles-outline" variant="secondary" onPress={() => router.push(`/konu/${topic.id}`)} />
    </Card>
  );
}

/** Category tile for the home grid: icon, name, counts, freshness. */
export function CategoryTile({ category, width }: { category: CategoryWithStats; width: number }) {
  const s = category.stats;
  return (
    <PressableScale
      accessibilityRole="link"
      accessibilityLabel={`${category.name}. ${s.topicCount} konu, ${s.postCount} mesaj.`}
      onPress={() => router.push(`/kategori/${category.slug}`)}
      style={({ hovered }) => [styles.tile, { width }, hovered && styles.tileHover]}
    >
      <View style={styles.tileTop}>
        <CategoryIcon icon={category.icon} size={38} />
        {s.lastActivityAt && Date.now() - new Date(s.lastActivityAt).getTime() < 3 * 3_600_000 ? <View style={styles.fresh} /> : null}
      </View>
      <AppText variant="bodyStrong" numberOfLines={1}>
        {category.name}
      </AppText>
      <AppText variant="caption" tone="subtle" numberOfLines={1}>
        {formatCount(s.topicCount)} konu · {formatCount(s.postCount)} mesaj
      </AppText>
      <AppText variant="caption" tone="subtle" numberOfLines={1} style={{ opacity: 0.8 }}>
        {s.lastActivityAt ? formatRelativeTime(s.lastActivityAt) : 'Henüz konu yok'}
      </AppText>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  teaserRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  countBox: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: 'rgba(11,5,7,0.55)',
    borderWidth: 1,
    borderColor: colors.border,
    minWidth: 92,
  },
  countValue: { fontFamily: fonts.display, fontSize: 17, fontWeight: '800', color: colors.goldSoft },
  featuredTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  hot: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  featuredFoot: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  tile: {
    padding: spacing.md,
    gap: 3,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tileHover: { borderColor: colors.borderGold, backgroundColor: colors.surfaceHover },
  tileTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xs },
  fresh: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success, marginTop: 4 },
});
