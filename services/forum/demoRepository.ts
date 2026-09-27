import { CATEGORY_BY_SLUG, DEFAULT_CATEGORIES } from '../../constants/categories';
import { matchesAll, MIN_QUERY_LENGTH, queryTerms } from '../../lib/search';
import { hasErrors, validateTopicInput } from '../../lib/validation';
import type {
  AuthorSummary,
  CategoryWithStats,
  CreateTopicInput,
  LatestPost,
  Post,
  SearchResults,
  TopicDetail,
  TopicSummary,
} from '../../types/forum';
import { DEMO_POSTS, DEMO_TOPICS, DEMO_USERS } from './demoData';
import type { DemoPostSeed, DemoTopicSeed } from './demoData';
import { ForumError } from './repository';
import type { ForumRepository, Page } from './repository';

interface StoredPost {
  id: string;
  topicId: string;
  authorId: string;
  body: string;
  createdAt: string;
}

interface StoredTopic {
  id: string;
  categorySlug: string;
  title: string;
  authorId: string;
  views: number;
  pinned: boolean;
  locked: boolean;
}

export interface DemoState {
  users: AuthorSummary[];
  topics: StoredTopic[];
  posts: StoredPost[];
}

/** Guest identity used for topics created in demo mode (no authentication yet). */
export const DEMO_GUEST: AuthorSummary = { id: 'u-guest', username: 'misafir_taraftar', role: 'user' };

export function buildDemoState(now: number = Date.now()): DemoState {
  return {
    users: [...DEMO_USERS, DEMO_GUEST],
    topics: DEMO_TOPICS.map((t: DemoTopicSeed) => ({
      id: t.id,
      categorySlug: t.categorySlug,
      title: t.title,
      authorId: t.authorId,
      views: t.views,
      pinned: Boolean(t.pinned),
      locked: Boolean(t.locked),
    })),
    posts: DEMO_POSTS.map((p: DemoPostSeed) => ({
      id: p.id,
      topicId: p.topicId,
      authorId: p.authorId,
      body: p.body,
      createdAt: new Date(now - p.minutesAgo * 60_000).toISOString(),
    })),
  };
}

const byDateAsc = (a: { createdAt: string }, b: { createdAt: string }) => a.createdAt.localeCompare(b.createdAt);

export function createDemoRepository(state: DemoState = buildDemoState()): ForumRepository {
  const userById = (id: string): AuthorSummary =>
    state.users.find((u) => u.id === id) ?? { id, username: 'silinmiş_üye', role: 'user' };

  const postsOf = (topicId: string) => state.posts.filter((p) => p.topicId === topicId).sort(byDateAsc);

  const categoryRef = (slug: string) => {
    const c = CATEGORY_BY_SLUG[slug];
    return { id: c?.id ?? slug, slug, name: c?.name ?? slug };
  };

  const summarize = (t: StoredTopic): TopicSummary => {
    const posts = postsOf(t.id);
    const first = posts[0];
    const last = posts[posts.length - 1];
    return {
      id: t.id,
      title: t.title,
      category: categoryRef(t.categorySlug),
      author: userById(t.authorId),
      createdAt: first?.createdAt ?? new Date(0).toISOString(),
      lastActivityAt: last?.createdAt ?? first?.createdAt ?? new Date(0).toISOString(),
      replyCount: Math.max(0, posts.length - 1),
      viewCount: t.views,
      isPinned: t.pinned,
      isLocked: t.locked,
      lastReplier: posts.length > 1 && last ? userById(last.authorId) : null,
    };
  };

  const toPost = (p: StoredPost, openingId: string | undefined): Post => ({
    id: p.id,
    topicId: p.topicId,
    author: userById(p.authorId),
    body: p.body,
    createdAt: p.createdAt,
    isOpeningPost: p.id === openingId,
  });

  const allSummaries = () => state.topics.map(summarize);

  const repo: ForumRepository = {
    mode: 'demo',

    async getCategories(): Promise<CategoryWithStats[]> {
      const summaries = allSummaries();
      return DEFAULT_CATEGORIES.map((c) => {
        const topics = summaries.filter((t) => t.category.slug === c.slug);
        const postCount = topics.reduce((sum, t) => sum + t.replyCount + 1, 0);
        const latest = [...topics].sort((a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt))[0];
        return {
          ...c,
          stats: {
            topicCount: topics.length,
            postCount,
            lastActivityAt: latest?.lastActivityAt ?? null,
            lastTopic: latest ? { id: latest.id, title: latest.title } : null,
          },
        };
      });
    },

    async getOverview() {
      const authors = new Set(state.posts.map((p) => p.authorId));
      return { topicCount: state.topics.length, postCount: state.posts.length, memberCount: authors.size };
    },

    async getLatestPost(): Promise<LatestPost | null> {
      const latest = [...state.posts].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
      if (!latest) return null;
      const topic = state.topics.find((t) => t.id === latest.topicId);
      if (!topic) return null;
      const summary = summarize(topic);
      const openingId = postsOf(topic.id)[0]?.id;
      return {
        post: {
          id: latest.id,
          body: latest.body,
          createdAt: latest.createdAt,
          author: userById(latest.authorId),
          isOpeningPost: latest.id === openingId,
        },
        topic: { id: summary.id, title: summary.title, replyCount: summary.replyCount },
        category: summary.category,
      };
    },

    async getTrendingTopics(limit = 6) {
      // "Gündem": recent activity weighted by conversation size, pinned/locked housekeeping excluded.
      const now = Date.now();
      return allSummaries()
        .filter((t) => !t.isLocked)
        .map((t) => {
          const hours = Math.max(1, (now - new Date(t.lastActivityAt).getTime()) / 3_600_000);
          const score = (t.replyCount * 3 + Math.log10(t.viewCount + 10) * 2) / Math.pow(hours + 2, 0.8);
          return { t, score };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map(({ t }) => t);
    },

    async getCategoryTopics(slug, cursor = 0, pageSize = 20): Promise<Page<TopicSummary>> {
      if (!CATEGORY_BY_SLUG[slug]) throw new ForumError('Kategori bulunamadı.', 'not_found');
      const sorted = allSummaries()
        .filter((t) => t.category.slug === slug)
        .sort((a, b) => Number(b.isPinned) - Number(a.isPinned) || b.lastActivityAt.localeCompare(a.lastActivityAt));
      const items = sorted.slice(cursor, cursor + pageSize);
      const next = cursor + pageSize;
      return { items, nextCursor: next < sorted.length ? next : null };
    },

    async getTopic(id): Promise<TopicDetail | null> {
      const topic = state.topics.find((t) => t.id === id);
      if (!topic) return null;
      const posts = postsOf(id);
      const openingId = posts[0]?.id;
      return { ...summarize(topic), posts: posts.map((p) => toPost(p, openingId)) };
    },

    async search(query, limit = 20): Promise<SearchResults> {
      const terms = queryTerms(query);
      const empty: SearchResults = { query, topics: [], posts: [], categories: [], users: [] };
      if (query.trim().length < MIN_QUERY_LENGTH || terms.length === 0) return empty;

      const summaries = allSummaries();
      const topics = summaries
        .filter((t) => matchesAll(t.title, terms))
        .sort((a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt))
        .slice(0, limit);

      const posts = [...state.posts]
        .filter((p) => matchesAll(p.body, terms))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, limit)
        .map((p) => {
          const t = summaries.find((s) => s.id === p.topicId)!;
          const openingId = postsOf(p.topicId)[0]?.id;
          return {
            post: toPost(p, openingId),
            topic: { id: t.id, title: t.title },
            category: { slug: t.category.slug, name: t.category.name },
          };
        });

      const categories = DEFAULT_CATEGORIES.filter((c) => matchesAll(`${c.name} ${c.description}`, terms));
      const users = state.users.filter((u) => u.id !== DEMO_GUEST.id && matchesAll(u.username, terms));
      return { query, topics, posts, categories, users };
    },

    async createTopic(input: CreateTopicInput) {
      const errors = validateTopicInput(input);
      if (hasErrors(errors)) throw new ForumError(Object.values(errors).filter(Boolean)[0]!, 'validation');
      const stamp = Date.now();
      const id = `t-local-${stamp.toString(36)}`;
      state.topics.push({
        id,
        categorySlug: input.categorySlug,
        title: input.title.trim(),
        authorId: DEMO_GUEST.id,
        views: 0,
        pinned: false,
        locked: false,
      });
      state.posts.push({
        id: `p-local-${stamp.toString(36)}`,
        topicId: id,
        authorId: DEMO_GUEST.id,
        body: input.body.trim(),
        createdAt: new Date(stamp).toISOString(),
      });
      return { id };
    },
  };

  return repo;
}
