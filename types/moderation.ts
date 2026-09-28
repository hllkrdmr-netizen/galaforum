import type { AuthorSummary, UserRole } from './forum';

export type SanctionKind = 'mute' | 'ban';
export type ReportStatus = 'open' | 'resolved' | 'dismissed';
export type TopicFlag = 'pinned' | 'locked' | 'hidden';

export type ModAction =
  | 'post_remove'
  | 'post_restore'
  | 'topic_pin'
  | 'topic_unpin'
  | 'topic_lock'
  | 'topic_unlock'
  | 'topic_move'
  | 'topic_hide'
  | 'topic_unhide'
  | 'report_dismiss'
  | 'user_mute'
  | 'user_ban'
  | 'sanction_revoke'
  | 'role_change'
  | 'match_create'
  | 'match_update'
  | 'match_event_add'
  | 'match_event_delete';

export interface ReportEntry {
  reporter: string | null;
  reason: string;
  createdAt: string;
  status: ReportStatus;
}

/** All reports about one post, as the moderation queue shows them. */
export interface ReportCase {
  postId: string;
  topicId: string;
  topicTitle: string;
  topicHidden: boolean;
  body: string;
  isOpeningPost: boolean;
  postRemoved: boolean;
  postCreatedAt: string;
  author: AuthorSummary;
  authorSanction: SanctionKind | null;
  status: ReportStatus;
  reportCount: number;
  firstReportedAt: string;
  lastReportedAt: string;
  reports: ReportEntry[];
}

export interface Sanction {
  id: string;
  kind: SanctionKind;
  reason: string;
  createdAt: string;
  endsAt: string | null;
  revokedAt?: string | null;
  by?: string | null;
}

export interface MemberModeration {
  author: AuthorSummary;
  joinedAt: string;
  postCount: number;
  removedPostCount: number;
  openReportCount: number;
  activeSanction: Sanction | null;
  sanctions: Sanction[];
}

export interface HiddenTopic {
  id: string;
  title: string;
  hiddenAt: string;
  reason: string | null;
  author: string;
  hiddenBy: string | null;
  category: string;
}

export interface ModLogEntry {
  id: number;
  action: ModAction;
  targetType: 'post' | 'topic' | 'user' | 'match';
  targetId: string;
  targetLabel: string;
  reason: string;
  meta: {
    from?: string;
    to?: string;
    hours?: number | null;
    endsAt?: string | null;
    kind?: SanctionKind;
    topicId?: string;
    reports?: number;
    /** match_update: changed fields and resulting score; match_event_*: the event. */
    fields?: string[];
    score?: string | null;
    type?: string;
    minute?: number;
    side?: 'home' | 'away' | null;
    player?: string | null;
  };
  createdAt: string;
  actor: AuthorSummary | null;
}

/** The signed-in member's own active restriction. */
export interface Restriction {
  kind: SanctionKind;
  reason: string;
  endsAt: string | null;
}

export type AssignableRole = UserRole;
