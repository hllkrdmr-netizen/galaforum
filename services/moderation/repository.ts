import type { AuthorSummary, UserRole } from '../../types/forum';
import type { HiddenTopic, MemberModeration, ModLogEntry, ReportCase, Restriction, SanctionKind, TopicFlag } from '../../types/moderation';

/**
 * Moderation (staff) and member-safety (blocks, own restriction) operations.
 * Staff methods fail with "yetkin yok" for members; the server is the authority.
 */
export interface ModerationRepository {
  readonly mode: 'demo' | 'supabase';
  reportQueue(status: 'open' | 'closed'): Promise<ReportCase[]>;
  openReportCount(): Promise<number>;
  dismissReports(postId: string, note?: string): Promise<void>;
  removePost(postId: string, reason: string): Promise<void>;
  restorePost(postId: string, reason?: string): Promise<void>;
  setTopicFlag(topicId: string, flag: TopicFlag, on: boolean, reason?: string): Promise<void>;
  moveTopic(topicId: string, categorySlug: string, reason?: string): Promise<void>;
  hiddenTopics(): Promise<HiddenTopic[]>;
  member(username: string): Promise<MemberModeration | null>;
  /** hours null = until revoked. Returns the sanction id. */
  sanction(username: string, kind: SanctionKind, hours: number | null, reason: string): Promise<string>;
  revokeSanction(id: string, reason?: string): Promise<void>;
  /** Admins only. */
  setRole(username: string, role: UserRole): Promise<void>;
  /** Newest first; pass the last id as `before` for older entries. */
  log(options?: { before?: number | null; limit?: number }): Promise<ModLogEntry[]>;

  /** The signed-in member's active mute/ban, null when none (or signed out). */
  myRestriction(): Promise<Restriction | null>;
  setBlock(username: string, on: boolean): Promise<boolean>;
  myBlocks(): Promise<AuthorSummary[]>;
}
