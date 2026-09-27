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
}

export interface TopicDetail extends TopicSummary {
  posts: Post[];
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
  categorySlug: string;
  title: string;
  body: string;
}

export interface ForumOverview {
  topicCount: number;
  postCount: number;
  memberCount: number;
}
