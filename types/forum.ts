export type UserRole = 'user' | 'verified' | 'moderator' | 'admin';

export interface Category {
  id: string;
  slug: string;
  name: string;
  description: string;
  /** Ionicons glyph name */
  icon: string;
  sortOrder: number;
}

export interface AuthorSummary {
  id: string;
  username: string;
  avatarUrl?: string | null;
  role?: UserRole;
}

export interface CategoryStats {
  topicCount: number;
  postCount: number;
  lastActivityAt: string | null;
  lastTopic: { id: string; title: string } | null;
}

export interface CategoryWithStats extends Category {
  stats: CategoryStats;
}

export interface TopicSummary {
  id: string;
  title: string;
  category: Pick<Category, 'id' | 'slug' | 'name'>;
  author: AuthorSummary;
  createdAt: string;
  lastActivityAt: string;
  /** Number of replies (posts excluding the opening post). */
  replyCount: number;
  viewCount: number;
  isPinned: boolean;
  isLocked: boolean;
  lastReplier: AuthorSummary | null;
}

export interface Post {
  id: string;
  topicId: string;
  author: AuthorSummary;
  body: string;
  createdAt: string;
  isOpeningPost: boolean;
  quote?: { id: string; body: string; username: string } | null;
  likeCount?: number;
  likedByMe?: boolean;
  mentions?: AuthorSummary[];
  /** Removed by a moderator: shown as a placeholder (no body or author). */
  removed?: boolean;
}

export interface TopicDetail extends TopicSummary {
  posts: Post[];
  nextCursor: number | null;
}

/** The most recent post anywhere on the forum (real post, not just the newest topic). */
export interface LatestPost {
  post: Pick<Post, 'id' | 'body' | 'createdAt' | 'author' | 'isOpeningPost'>;
  topic: Pick<TopicSummary, 'id' | 'title' | 'replyCount'>;
  category: Pick<Category, 'id' | 'slug' | 'name'>;
}

export interface SearchResults {
  query: string;
  topics: TopicSummary[];
  posts: Array<{ post: Post; topic: Pick<TopicSummary, 'id' | 'title'>; category: Pick<Category, 'slug' | 'name'> }>;
  categories: Category[];
  users: AuthorSummary[];
}

export interface CreateTopicInput {
  poll?: PollInput;
  categorySlug: string;
  title: string;
  body: string;
}

export interface ForumOverview {
  topicCount: number;
  postCount: number;
  memberCount: number;
}

export interface PollInput { question: string; options: string[] }
export interface Poll { id: string; question: string; options: { id: string; label: string; votes: number }[]; myOptionId: string | null; totalVotes: number }
export interface ReplyInput { topicId: string; body: string; quotePostId?: string }

export type SearchSort = 'relevance' | 'newest' | 'replies';
export type SearchSince = 'all' | '24h' | '7d' | '30d';

export interface SearchOptions {
  /** Category slug */
  category?: string;
  /** Author username (exact) */
  author?: string;
  since?: SearchSince;
  sort?: SearchSort;
  limit?: number;
}

export interface PublicProfile {
  author: AuthorSummary;
  joinedAt: string;
  topicCount: number;
  postCount: number;
  likesReceived: number;
  recentTopics: Array<{
    id: string;
    title: string;
    replyCount: number;
    lastActivityAt: string;
    category: Pick<Category, 'slug' | 'name'>;
  }>;
}
