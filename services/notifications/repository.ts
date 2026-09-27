import type { NotificationPage, NotificationSetting, PushPlatform } from '../../types/notification';

export interface ListOptions {
  /** Cursor from a previous page. */
  before?: string | null;
  limit?: number;
  unreadOnly?: boolean;
}

/** In-app notification inbox, preferences and push-token registration (demo and Supabase implementations). */
export interface NotificationRepository {
  readonly mode: 'demo' | 'supabase';
  /** Newest first. Empty page when signed out. */
  list(options?: ListOptions): Promise<NotificationPage>;
  /** 0 when signed out. */
  unreadCount(): Promise<number>;
  /** Marks the given ids (or everything, when omitted) as read. Returns how many changed. */
  markRead(ids?: string[]): Promise<number>;
  /** Ordered like NOTIFICATION_GROUPS; defaults when nothing is saved. */
  getSettings(): Promise<NotificationSetting[]>;
  setSetting(setting: NotificationSetting): Promise<void>;
  registerPushToken(token: string, platform: PushPlatform): Promise<void>;
  unregisterPushToken(token: string): Promise<void>;
  /** Calls `onChange` when the signed-in member's inbox changes (realtime). Returns an unsubscribe function. */
  subscribe(onChange: () => void): () => void;
}
