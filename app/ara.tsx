import { router, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AppText, Avatar, Container, EmptyState, ErrorState, PressableScale, ScreenHeader, SectionHeader, SkeletonRow } from '../components/ui';
import { colors, radius, spacing } from '../constants/theme';
import { CategoryIcon } from '../features/forum/CategoryIcon';
import { SearchBar } from '../features/forum/SearchBar';
import { TopicRow } from '../features/forum/TopicRow';
import { useForumQuery } from '../hooks/useForumQuery';
import { formatRelativeTime, toPreview } from '../lib/format';
import { MIN_QUERY_LENGTH } from '../lib/search';
import { forum } from '../services/forum';

export default function SearchScreen() {
  const { q = '' } = useLocalSearchParams<{ q?: string }>();
  const query = String(q).trim();
  const enabled = query.length >= MIN_QUERY_LENGTH;
  const results = useForumQuery(`forum:search:${query}`, () => forum.search(query), { enabled });
  const r = results.data;
  const total = r ? r.topics.length + r.posts.length + r.categories.length + r.users.length : 0;

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Ara" />
      <ScrollView contentContainerStyle={{ paddingBottom: 80 }} keyboardShouldPersistTaps="handled">
        <Container style={{ paddingTop: spacing.xl }}>
          <SearchBar key={query} initialValue={query} autoFocus={!enabled} onSubmit={(v) => router.setParams({ q: v })} />
          {enabled && r ? (
            <AppText variant="caption" tone="subtle" style={{ marginTop: spacing.md }}>
              “{query}” için {total} sonuç · konu başlıkları, mesajlar, kategoriler ve üyeler
            </AppText>
          ) : null}
        </Container>

        {!enabled ? (
          <EmptyState icon="search-outline" title="Ne aramak istersin?" message={`En az ${MIN_QUERY_LENGTH} karakter yaz. Konu başlıklarında, mesajlarda, kategorilerde ve üye adlarında arar.`} />
        ) : results.isLoading ? (
          <Container style={{ marginTop: spacing.xl }}>
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </Container>
        ) : results.error ? (
          <ErrorState message={results.error.message} onRetry={results.refetch} />
        ) : total === 0 ? (
          <EmptyState icon="search-outline" title="Sonuç bulunamadı." message="Farklı kelimeler dene ya da bu konuyu sen aç." actionLabel="Konu Aç" onAction={() => router.push('/konu-ac')} />
        ) : r ? (
          <>
            {r.categories.length > 0 ? (
              <Container style={styles.section}>
                <SectionHeader title="Kategoriler" />
                <View style={styles.chips}>
                  {r.categories.map((c) => (
                    <PressableScale key={c.slug} accessibilityRole="link" onPress={() => router.push(`/kategori/${c.slug}`)} style={styles.chip}>
                      <CategoryIcon icon={c.icon} size={28} />
                      <AppText variant="small" style={{ fontWeight: '600' }}>{c.name}</AppText>
                    </PressableScale>
                  ))}
                </View>
              </Container>
            ) : null}
            {r.topics.length > 0 ? (
              <Container style={styles.section}>
                <SectionHeader title="Konular" />
                <View style={styles.group}>
                  {r.topics.map((t) => <TopicRow key={t.id} topic={t} />)}
                </View>
              </Container>
            ) : null}
            {r.posts.length > 0 ? (
              <Container style={styles.section}>
                <SectionHeader title="Mesajlar" />
                <View style={styles.group}>
                  {r.posts.map(({ post, topic, category }) => (
                    <PressableScale
                      key={post.id}
                      accessibilityRole="link"
                      onPress={() => router.push(`/konu/${topic.id}`)}
                      style={({ hovered }) => [styles.postRow, hovered && { backgroundColor: colors.surfaceHover }]}
                    >
                      <AppText variant="bodyStrong" numberOfLines={1}>{topic.title}</AppText>
                      <AppText variant="small" tone="muted" numberOfLines={2}>{toPreview(post.body, 200)}</AppText>
                      <AppText variant="caption" tone="subtle">
                        {post.author.username} · {category.name} · {formatRelativeTime(post.createdAt)}
                      </AppText>
                    </PressableScale>
                  ))}
                </View>
              </Container>
            ) : null}
            {r.users.length > 0 ? (
              <Container style={styles.section}>
                <SectionHeader title="Üyeler" />
                <View style={styles.chips}>
                  {r.users.map((u) => (
                    <View key={u.id} style={styles.chip}>
                      <Avatar name={u.username} uri={u.avatarUrl} size={28} />
                      <AppText variant="small" style={{ fontWeight: '600' }}>{u.username}</AppText>
                    </View>
                  ))}
                </View>
              </Container>
            ) : null}
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  section: { marginTop: spacing.xxxl },
  group: { borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, overflow: 'hidden' },
  postRow: { padding: spacing.lg, gap: 4, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 6,
    paddingLeft: 6,
    paddingRight: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    minHeight: 44,
  },
});
