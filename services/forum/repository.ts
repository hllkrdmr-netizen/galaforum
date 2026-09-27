import type {
  CategoryWithStats,
  CreateTopicInput,
  ForumOverview,
  LatestPost,
  SearchResults,
  TopicDetail,
  TopicSummary,
} from '../../types/forum';

export interface Page<T> {
  items: T[];
  nextCursor: number | null;
}

/**
 * Data-access contract for the forum. The UI only talks to this interface so the
 * demo (in-memory) and Supabase implementations are interchangeable.
 */
export interface ForumRepository {
  readonly mode: 'demo' | 'supabase';
  getCategories(): Promise<CategoryWithStats[]>;
  getOverview(): Promise<ForumOverview>;
  /** Most recent post across the forum (includes opening posts of new topics). */
  getLatestPost(): Promise<LatestPost | null>;
  getTrendingTopics(limit?: number): Promise<TopicSummary[]>;
  getCategoryTopics(slug: string, cursor?: number, pageSize?: number): Promise<Page<TopicSummary>>;
  getTopic(id: string): Promise<TopicDetail | null>;
  search(query: string, limit?: number): Promise<SearchResults>;
  createTopic(input: CreateTopicInput): Promise<{ id: string }>;
}

export type ForumErrorCode = 'network' | 'auth_required' | 'validation' | 'not_found' | 'unknown';

export class ForumError extends Error {
  readonly code: ForumErrorCode;

  constructor(message: string, code: ForumErrorCode = 'unknown') {
    super(message);
    this.name = 'ForumError';
    this.code = code;
  }
}
