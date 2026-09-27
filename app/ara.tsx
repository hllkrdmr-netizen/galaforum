import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import {
  AppText,
  Avatar,
  Container,
  EmptyState,
  ErrorState,
  PressableScale,
  ScreenHeader,
  SectionHeader,
  SkeletonRow,
} from '../components/ui';
import { CATEGORY_BY_SLUG, DEFAULT_CATEGORIES } from '../constants/categories';
import { colors, radius, spacing } from '../constants/theme';
import { CategoryIcon } from '../features/forum/CategoryIcon';
import { SearchBar } from '../features/forum/SearchBar';
import { TopicRow } from '../features/forum/TopicRow';
import { useForumQuery } from '../hooks/useForumQuery';
import { formatRelativeTime, toPreview } from '../lib/format';
import { canSearch, MIN_QUERY_LENGTH } from '../lib/search';
import { forum } from '../services/forum';
import type { SearchOptions, SearchSince, SearchSort } from '../types/forum';

const SORTS: { value: SearchSort; label: string }[] = [
  { value: 'relevance', label: 'En ilgili' },
  { value: 'newest', label: 'En yeni' },
  { value: 'replies', label: 'En çok yanıt' },
];
const SINCES: { value: SearchSince; label: string }[] = [
  { value: 'all', label: 'Tüm zamanlar' },
  { value: '24h', label: 'Son 24 saat' },
  { value: '7d', label: 'Son 7 gün' },
  { value: '30d', label: 'Son 30 gün' },
];

type Params = { q?: string; kategori?: string; uye?: string; zaman?: string; sirala?: string };

function Chip({ label, selected, onPress, icon }: { label: string; selected: boolean; onPress: () => void; icon?: keyof typeof Ionicons.glyphMap }) {
  return (
    <PressableScale
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={label}
      onPress={onPress}
      style={[styles.chip, selected && styles.chipOn]}
    >
      {icon ? <Ionicons name={icon} size={14} color={selected ? colors.goldSoft : colors.textSubtle} /> : null}
      <AppText variant="caption" style={{ fontWeight: '700', color: selected ? colors.goldSoft : colors.textMuted }}>
        {label}
      </AppText>
    </PressableScale>
  );
}

export default function SearchScreen() {
  const params = useLocalSearchParams<Params>();
  const query = String(params.q ?? '').trim();
  const category = params.kategori && CATEGORY_BY_SLUG[params.kategori] ? params.kategori : undefined;
  const author = params.uye ? String(params.uye).toLowerCase() : undefined;
  const since = (SINCES.find((s) => s.value === params.zaman)?.value ?? 'all') as SearchSince;
  const sort = (SORTS.find((s) => s.value === params.sirala)?.value ?? 'relevance') as SearchSort;
  const options: SearchOptions = { category, author, since, sort };
  const enabled = canSearch(query, options);
  const key = `forum:search:${JSON.stringify([query, category, author, since, sort])}`;
  const results = useForumQuery(key, () => forum.search(query, options), { enabled });
  const r = results.data;
  const total = r ? r.topics.length + r.posts.length + r.categories.length + r.users.length : 0;

  const setParam = (patch: Partial<Params>) => router.setParams(patch as Record<string, string>);

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Ara" />
      <ScrollView contentContainerStyle={{ paddingBottom: 80 }} keyboardShouldPersistTaps="handled">
        <Container style={{ paddingTop: spacing.xl, gap: spacing.md }}>
          <SearchBar key={query} initialValue={query} autoFocus={!enabled} onSubmit={(v) => setParam({ q: v })} />

          {author ? (
            <View style={styles.row}>
              <AppText variant="caption" tone="subtle">
                Üye:
              </AppText>
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel={`${author} filtresini kaldır`}
                onPress={() => setParam({ uye: '' })}
                style={[styles.chip, styles.chipOn]}
              >
                <AppText variant="caption" style={{ fontWeight: '700', color: colors.goldSoft }}>
                  @{author}
                </AppText>
                <Ionicons name="close" size={14} color={colors.goldSoft} />
              </PressableScale>
            </View>
          ) : null}

          <View style={styles.row} accessibilityRole="radiogroup" accessibilityLabel="Sıralama">
            {SORTS.map((s) => (
              <Chip key={s.value} label={s.label} selected={sort === s.value} onPress={() => setParam({ sirala: s.value })} />
            ))}
          </View>
          <View style={styles.row} accessibilityRole="radiogroup" accessibilityLabel="Tarih">
            {SINCES.map((s) => (
              <Chip key={s.value} label={s.label} selected={since === s.value} onPress={() => setParam({ zaman: s.value })} />
            ))}
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row} accessibilityRole="radiogroup" accessibilityLabel="Kategori">
            <Chip label="Tüm kategoriler" selected={!category} onPress={() => setParam({ kategori: '' })} />
            {DEFAULT_CATEGORIES.map((c) => (
              <Chip key={c.slug} label={c.name} selected={category === c.slug} onPress={() => setParam({ kategori: c.slug })} />
            ))}
          </ScrollView>

          {enabled && r ? (
            <AppText variant="caption" tone="subtle">
              {query ? `“${query}” için ` : ''}
              {total} sonuç · konu başlıkları, mesajlar{author || category ? '' : ', kategoriler ve üyeler'}
            </AppText>
          ) : null}
        </Container>

        {!enabled ? (
          <EmptyState
            icon="search-outline"
            title="Ne aramak istersin?"
            message={`En az ${MIN_QUERY_LENGTH} karakter yaz. Konu başlıklarında, mesajlarda, kategorilerde ve üye adlarında arar.`}
          />
        ) : results.isLoading ? (
          <Container style={{ marginTop: spacing.xl }}>
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </Container>
        ) : results.error ? (
          <ErrorState message={results.error.message} onRetry={results.refetch} />
        ) : total === 0 ? (
          <EmptyState
            icon="search-outline"
            title="Sonuç bulunamadı."
            message="Farklı kelimeler dene, filtreleri gevşet ya da bu konuyu sen aç."
            actionLabel="Konu Aç"
            onAction={() => router.push({ pathname: '/konu-ac', params: category ? { kategori: category } : {} })}
          />
        ) : r ? (
          <>
            {r.users.length > 0 ? (
              <Container style={styles.section}>
                <SectionHeader title="Üyeler" />
                <View style={styles.row}>
                  {r.users.map((u) => (
                    <PressableScale key={u.id} accessibilityRole="link" onPress={() => router.push(`/uye/${u.username}`)} style={styles.person}>
                      <Avatar name={u.username} uri={u.avatarUrl} size={28} />
                      <AppText variant="small" style={{ fontWeight: '600' }}>
                        {u.username}
                      </AppText>
                    </PressableScale>
                  ))}
                </View>
              </Container>
            ) : null}
            {r.categories.length > 0 ? (
              <Container style={styles.section}>
                <SectionHeader title="Kategoriler" />
                <View style={styles.row}>
                  {r.categories.map((c) => (
                    <PressableScale key={c.slug} accessibilityRole="link" onPress={() => router.push(`/kategori/${c.slug}`)} style={styles.person}>
                      <CategoryIcon icon={c.icon} size={28} />
                      <AppText variant="small" style={{ fontWeight: '600' }}>
                        {c.name}
                      </AppText>
                    </PressableScale>
                  ))}
                </View>
              </Container>
            ) : null}
            {r.topics.length > 0 ? (
              <Container style={styles.section}>
                <SectionHeader title="Konular" />
                <View style={styles.group}>
                  {r.topics.map((t) => (
                    <TopicRow key={t.id} topic={t} />
                  ))}
                </View>
              </Container>
            ) : null}
            {r.posts.length > 0 ? (
              <Container style={styles.section}>
                <SectionHeader title="Mesajlar" />
                <View style={styles.group}>
                  {r.posts.map(({ post, topic, category: cat }) => (
                    <PressableScale
                      key={post.id}
                      accessibilityRole="link"
                      onPress={() => router.push(`/konu/${topic.id}`)}
                      style={({ hovered }) => [styles.postRow, hovered && { backgroundColor: colors.surfaceHover }]}
                    >
                      <AppText variant="bodyStrong" numberOfLines={1}>
                        {topic.title}
                      </AppText>
                      <AppText variant="small" tone="muted" numberOfLines={2}>
                        {toPreview(post.body, 200)}
                      </AppText>
                      <AppText variant="caption" tone="subtle">
                        {post.author.username} · {cat.name} · {formatRelativeTime(post.createdAt)}
                      </AppText>
                    </PressableScale>
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
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 36,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipOn: { borderColor: colors.gold, backgroundColor: 'rgba(217,164,65,0.12)' },
  group: { borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, overflow: 'hidden' },
  postRow: { padding: spacing.lg, gap: 4, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  person: {
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
