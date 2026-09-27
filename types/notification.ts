import type { AuthorSummary } from './forum';

/** What happened. Stored on each notification row. */
export type NotificationKind =
  | 'reply'
  | 'quote'
  | 'mention'
  | 'like'
  | 'follow'
  | 'category_topic'
  | 'meetup_join'
  | 'meetup_cancelled'
  | 'match_start'
  | 'match_goal'
  | 'match_end'
  | 'badge';

/** What the member toggles in settings (several kinds can share a group). */
export type NotificationGroup = 'reply' | 'quote' | 'mention' | 'like' | 'follow' | 'category_topic' | 'meetup' | 'match' | 'badge';

/** Display snapshot written by the server when the notification is created. All fields optional. */
export interface NotificationData {
  topic_title?: string;
  excerpt?: string;
  category_name?: string;
  category_slug?: string;
  meetup_title?: string;
  starts_at?: string;
  city?: string;
  match_title?: string;
  competition?: string;
  home_score?: number | null;
  away_score?: number | null;
  minute?: number;
  extra_minute?: number | null;
  event_type?: string;
  player?: string | null;
  team?: string | null;
  badge_name?: string;
  badge_icon?: string;
}

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  /** Latest actor (null for system notifications: matches, badges). */
  actor: AuthorSummary | null;
  /** Distinct people behind a grouped notification (reply, like, meetup_join). */
  actorCount: number;
  topicId: string | null;
  postId: string | null;
  meetupId: string | null;
  matchId: string | null;
  badgeId: string | null;
  data: NotificationData;
  createdAt: string;
  readAt: string | null;
}

export interface NotificationSetting {
  group: NotificationGroup;
  inApp: boolean;
  push: boolean;
}

export interface NotificationPage {
  items: AppNotification[];
  /** Pass as `before` to load older items; null when there is nothing older. */
  nextCursor: string | null;
}

export type PushPlatform = 'ios' | 'android' | 'web';
