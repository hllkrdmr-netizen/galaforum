import type { SupabaseClient } from '@supabase/supabase-js';

import { CATEGORY_BY_SLUG, DEFAULT_CATEGORIES } from '../../constants/categories';
import { escapeLike, MIN_QUERY_LENGTH } from '../../lib/search';
import { hasErrors, validateTopicInput } from '../../lib/validation';
import type {
  AuthorSummary,
  Category,
  CategoryWithStats,
  LatestPost,
  Post,
  SearchResults,
  TopicDetail,
  TopicSummary,
  UserRole,
} from '../../types/forum';
import { ForumError } from './repository';
import type { ForumRepository, Page } from './repository';

// ---- Row shapes returned by PostgREST (see supabase/migrations) -------------------------------
interface ProfileRow {
  id: string;
  username: string;
  avatar_url: string | null;
  role: UserRole;
}
interface CategoryRef {
  id: string;
  slug: string;
  name: string;
}
interface TopicRow {
  id: string;
  title: string;
  created_at: string;
  last_activity_at: string;
  reply_count: number;
  view_count: number;
  is_pinned: boolean;
  is_locked: boolean;
  category: CategoryRef | null;
  author: ProfileRow | null;
  last_poster: ProfileRow | null;
}
interface PostRow {
  id: string;
  topic_id: string;
  body: string;
  created_at: string;
  is_opening_post: boolean;
  author: ProfileRow | null;
}
interface CategoryStatsRow {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon: string;
  sort_order: number;
  topic_count: number;
  post_count: number;
  last_activity_at: string | null;
  last_topic_id: string | null;
  last_topic_title: string | null;
}

const PROFILE_FIELDS = 'id, username, avatar_url, role';
const TOPIC_SELECT = `id, title, created_at, last_activity_at, reply_count, view_count, is_pinned, is_locked,
  category:categories(id, slug, name),
  author:profiles!topics_author_id_fkey(${PROFILE_FIELDS}),
  last_poster:profiles!topics_last_poster_id_fkey(${PROFILE_FIELDS})`;
const POST_SELECT = `id, topic_id, body, created_at, is_opening_post, author:profiles!posts_author_id_fkey(${PROFILE_FIELDS})`;

const ghost: AuthorSummary = { id: 'deleted', username: 'silinmiş_üye', role: 'user' };

const toAuthor = (p: ProfileRow | null): AuthorSummary =>
  p ? { id: p.id, username: p.username, avatarUrl: p.avatar_url, role: p.role } : ghost;

const toCategoryRef = (c: CategoryRef | null): Pick<Category, 'id' | 'slug' | 'name'> =>
  c ?? { id: 'unknown', slug: 'serbest', name: 'Serbest' };

const toTopic = (r: TopicRow): TopicSummary => ({
  id: r.id,
  title: r.title,
  category: toCategoryRef(r.category),
  author: toAuthor(r.author),
  createdAt: r.created_at,
  lastActivityAt: r.last_activity_at,
  replyCount: r.reply_count,
  viewCount: r.view_count,
  isPinned: r.is_pinned,
  isLocked: r.is_locked,
  lastReplier: r.reply_count > 0 && r.last_poster ? toAuthor(r.last_poster) : null,
});

const toPost = (r: PostRow): Post => ({
  id: r.id,
  topicId: r.topic_id,
  author: toAuthor(r.author),
  body: r.body,
  createdAt: r.created_at,
  isOpeningPost: r.is_opening_post,
});

function fail(error: { message: string; code?: string } | null, fallback: string): never {
  const msg = error?.message ?? fallback;
  const network = /fetch|network|failed to fetch|timeout/i.test(msg);
  throw new ForumError(network ? 'Bağlantı kurulamadı. İnternetini kontrol edip tekrar dene.' : fallback, network ? 'network' : 'unknown');
}

export function createSupabaseRepository(sb: SupabaseClient): ForumRepository {
  return {
    mode: 'supabase',

    async getCategories(): Promise<CategoryWithStats[]> {
      const { data, error } = await sb.from('category_stats').select('*').order('sort_order');
      if (error) fail(error, 'Kategoriler yüklenemedi.');
      const rows = (data ?? []) as CategoryStatsRow[];
      if (rows.length === 0) {
        // Schema not seeded yet: show the default structure with zeroed stats instead of a blank page.
        return DEFAULT_CATEGORIES.map((c) => ({
          ...c,
          stats: { topicCount: 0, postCount: 0, lastActivityAt: null, lastTopic: null },
        }));
      }
      return rows.map((r) => ({
        id: r.id,
        slug: r.slug,
        name: r.name,
        description: r.description,
        icon: r.icon || CATEGORY_BY_SLUG[r.slug]?.icon || 'chatbubbles-outline',
        sortOrder: r.sort_order,
        stats: {
          topicCount: r.topic_count,
          postCount: r.post_count,
          lastActivityAt: r.last_activity_at,
          lastTopic: r.last_topic_id ? { id: r.last_topic_id, title: r.last_topic_title ?? '' } : null,
        },
      }));
    },

    async getOverview() {
      const [topics, posts, members] = await Promise.all([
        sb.from('topics').select('id', { count: 'exact', head: true }),
        sb.from('posts').select('id', { count: 'exact', head: true }).eq('is_deleted', false),
        sb.from('profiles').select('id', { count: 'exact', head: true }),
      ]);
      const err = topics.error ?? posts.error ?? members.error;
      if (err) fail(err, 'Forum istatistikleri yüklenemedi.');
      return { topicCount: topics.count ?? 0, postCount: posts.count ?? 0, memberCount: members.count ?? 0 };
    },

    async getLatestPost(): Promise<LatestPost | null> {
      const { data, error } = await sb
        .from('posts')
        .select(
          `id, body, created_at, is_opening_post, author:profiles!posts_author_id_fkey(${PROFILE_FIELDS}),
           topic:topics!inner(id, title, reply_count, category:categories(id, slug, name))`,
        )
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) fail(error, 'Son mesaj yüklenemedi.');
      if (!data) return null;
      const row = data as unknown as PostRow & {
        topic: { id: string; title: string; reply_count: number; category: CategoryRef | null };
      };
      return {
        post: {
          id: row.id,
          body: row.body,
          createdAt: row.created_at,
          author: toAuthor(row.author),
          isOpeningPost: row.is_opening_post,
        },
        topic: { id: row.topic.id, title: row.topic.title, replyCount: row.topic.reply_count },
        category: toCategoryRef(row.topic.category),
      };
    },

    async getTrendingTopics(limit = 6) {
      const { data, error } = await sb
        .from('topics')
        .select(TOPIC_SELECT)
        .eq('is_locked', false)
        .order('last_activity_at', { ascending: false })
        .limit(limit);
      if (error) fail(error, 'Gündem yüklenemedi.');
      return ((data ?? []) as unknown as TopicRow[]).map(toTopic);
    },

    async getCategoryTopics(slug, cursor = 0, pageSize = 20): Promise<Page<TopicSummary>> {
      const { data: cat, error: catErr } = await sb.from('categories').select('id').eq('slug', slug).maybeSingle();
      if (catErr) fail(catErr, 'Kategori yüklenemedi.');
      if (!cat) throw new ForumError('Kategori bulunamadı.', 'not_found');
      const { data, error } = await sb
        .from('topics')
        .select(TOPIC_SELECT)
        .eq('category_id', (cat as { id: string }).id)
        .order('is_pinned', { ascending: false })
        .order('last_activity_at', { ascending: false })
        .range(cursor, cursor + pageSize); // one extra row tells us whether another page exists
      if (error) fail(error, 'Konular yüklenemedi.');
      const rows = ((data ?? []) as unknown as TopicRow[]).map(toTopic);
      const hasMore = rows.length > pageSize;
      return { items: rows.slice(0, pageSize), nextCursor: hasMore ? cursor + pageSize : null };
    },

    async getTopic(id): Promise<TopicDetail | null> {
      const { data, error } = await sb.from('topics').select(TOPIC_SELECT).eq('id', id).maybeSingle();
      if (error) fail(error, 'Konu yüklenemedi.');
      if (!data) return null;
      const { data: posts, error: postErr } = await sb
        .from('posts')
        .select(POST_SELECT)
        .eq('topic_id', id)
        .eq('is_deleted', false)
        .order('created_at', { ascending: true })
        .limit(200);
      if (postErr) fail(postErr, 'Mesajlar yüklenemedi.');
      void sb.rpc('increment_topic_view', { p_topic_id: id });
      return { ...toTopic(data as unknown as TopicRow), posts: ((posts ?? []) as unknown as PostRow[]).map(toPost) };
    },

    async search(query, limit = 20): Promise<SearchResults> {
      const q = query.trim();
      const empty: SearchResults = { query, topics: [], posts: [], categories: [], users: [] };
      if (q.length < MIN_QUERY_LENGTH) return empty;
      const pattern = `%${escapeLike(q)}%`;
      const [topics, posts, users] = await Promise.all([
        sb.from('topics').select(TOPIC_SELECT).ilike('title', pattern).order('last_activity_at', { ascending: false }).limit(limit),
        sb
          .from('posts')
          .select(`${POST_SELECT}, topic:topics!inner(id, title, category:categories(slug, name))`)
          .eq('is_deleted', false)
          .ilike('body', pattern)
          .order('created_at', { ascending: false })
          .limit(limit),
        sb.from('profiles').select(PROFILE_FIELDS).ilike('username', pattern).limit(10),
      ]);
      const err = topics.error ?? posts.error ?? users.error;
      if (err) fail(err, 'Arama yapılamadı.');
      const lower = q.toLocaleLowerCase('tr-TR');
      return {
        query,
        topics: ((topics.data ?? []) as unknown as TopicRow[]).map(toTopic),
        posts: ((posts.data ?? []) as unknown as Array<PostRow & { topic: { id: string; title: string; category: { slug: string; name: string } | null } }>).map(
          (r) => ({
            post: toPost(r),
            topic: { id: r.topic.id, title: r.topic.title },
            category: r.topic.category ?? { slug: 'serbest', name: 'Serbest' },
          }),
        ),
        categories: DEFAULT_CATEGORIES.filter((c) => c.name.toLocaleLowerCase('tr-TR').includes(lower)),
        users: ((users.data ?? []) as ProfileRow[]).map(toAuthor),
      };
    },

    async createTopic(input) {
      const errors = validateTopicInput(input);
      if (hasErrors(errors)) throw new ForumError(Object.values(errors).filter(Boolean)[0]!, 'validation');
      const { data: session } = await sb.auth.getSession();
      if (!session.session) throw new ForumError('Konu açmak için giriş yapmalısın.', 'auth_required');
      const { data, error } = await sb.rpc('create_topic', {
        p_category_slug: input.categorySlug,
        p_title: input.title.trim(),
        p_body: input.body.trim(),
      });
      if (error) fail(error, 'Konu oluşturulamadı.');
      return { id: String(data) };
    },
  };
}
