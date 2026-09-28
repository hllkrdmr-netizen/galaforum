import type {
  Poll,
  PublicProfile,
  SearchOptions,
  ReplyInput,
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
  getTopic(id: string, cursor?: number, pageSize?: number): Promise<TopicDetail | null>;
  reply(input: ReplyInput): Promise<{ id: string }>;
  setLike(postId: string, liked: boolean): Promise<void>;
  report(postId: string, reason: string): Promise<void>;
  getPoll(topicId: string): Promise<Poll | null>;
  vote(pollId: string, optionId: string): Promise<void>;
  /**
   * Searches topic titles, post bodies, categories and usernames.
   * An empty query is allowed when `options.author` is set (lists that member's content).
   */
  search(query: string, options?: SearchOptions): Promise<SearchResults>;
  /** Public member profile; null when the member does not exist or deleted the account. */
  getProfile(username: string): Promise<PublicProfile | null>;
  createTopic(input: CreateTopicInput): Promise<{ id: string }>;
  /** 0-based position of a post in its topic (for deep links); null when not visible. */
  getPostPosition(topicId: string, postId: string): Promise<number | null>;
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
