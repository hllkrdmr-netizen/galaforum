import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';

import { cursorOf, mergeSettings, normalizeSetting, parseCursor } from '../../lib/notifications';
import type { UserRole } from '../../types/forum';
import type { AppNotification, NotificationData, NotificationGroup, NotificationKind } from '../../types/notification';
import { ForumError } from '../forum/repository';
import type { NotificationRepository } from './repository';

interface Row {
  id: string;
  kind: NotificationKind;
  actor_count: number;
  topic_id: string | null;
  post_id: string | null;
  meetup_id: string | null;
  match_id: string | null;
  badge_id: string | null;
  data: NotificationData | null;
  created_at: string;
  read_at: string | null;
  actor: { id: string; username: string; avatar_url: string | null; role: UserRole } | null;
}

const SELECT =
  'id, kind, actor_count, topic_id, post_id, meetup_id, match_id, badge_id, data, created_at, read_at, actor:profiles!notifications_actor_id_fkey(id, username, avatar_url, role)';

function fail(error: { message: string; code?: string }, fallback: string): never {
  if (/fetch|network|timeout/i.test(error.message)) throw new ForumError('Bağlantı kurulamadı. İnternetini kontrol edip tekrar dene.', 'network');
  if (error.code === '28000') throw new ForumError('Bu işlem için giriş yapmalısın.', 'auth_required');
  if (error.message.includes('invalid_token')) throw new ForumError('Geçersiz bildirim anahtarı.', 'validation');
  if (error.message.includes('invalid_group') || error.message.includes('invalid_platform')) throw new ForumError('Geçersiz bildirim ayarı.', 'validation');
  throw new ForumError(fallback, 'unknown');
}

const toNotification = (r: Row): AppNotification => ({
  id: r.id,
  kind: r.kind,
  actor: r.actor ? { id: r.actor.id, username: r.actor.username, avatarUrl: r.actor.avatar_url, role: r.actor.role } : null,
  actorCount: r.actor_count,
  topicId: r.topic_id,
  postId: r.post_id,
  meetupId: r.meetup_id,
  matchId: r.match_id,
  badgeId: r.badge_id,
  data: r.data ?? {},
  createdAt: r.created_at,
  readAt: r.read_at,
});

export function createSupabaseNotificationRepository(sb: SupabaseClient): NotificationRepository {
  const uid = async () => (await sb.auth.getSession()).data.session?.user.id ?? null;

  return {
    mode: 'supabase',

    async list({ before, limit = 30, unreadOnly = false } = {}) {
      const me = await uid();
      if (!me) return { items: [], nextCursor: null };
      const size = Math.min(Math.max(limit, 1), 100);
      let q = sb
        .from('notifications')
        .select(SELECT)
        .eq('user_id', me)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(size + 1);
      if (unreadOnly) q = q.is('read_at', null);
      const cursor = parseCursor(before);
      // Keyset paging; the timestamp is quoted because it contains ":" and "+" (PostgREST reserved characters).
      if (cursor) q = q.or(`created_at.lt."${cursor.createdAt}",and(created_at.eq."${cursor.createdAt}",id.lt.${cursor.id})`);
      const { data, error } = await q;
      if (error) fail(error, 'Bildirimler yüklenemedi.');
      const rows = (data ?? []) as unknown as Row[];
      const items = rows.slice(0, size).map(toNotification);
      return { items, nextCursor: rows.length > size ? cursorOf(items[items.length - 1]!) : null };
    },

    async unreadCount() {
      if (!(await uid())) return 0;
      const { data, error } = await sb.rpc('unread_notification_count');
      if (error) fail(error, 'Bildirim sayısı alınamadı.');
      return typeof data === 'number' ? data : 0;
    },

    async markRead(ids) {
      if (ids && ids.length === 0) return 0;
      const { data, error } = await sb.rpc('mark_notifications_read', { p_ids: ids ?? null });
      if (error) fail(error, 'Bildirimler güncellenemedi.');
      return typeof data === 'number' ? data : 0;
    },

    async getSettings() {
      if (!(await uid())) return mergeSettings([]);
      const { data, error } = await sb.rpc('get_notification_settings');
      if (error) fail(error, 'Bildirim ayarları yüklenemedi.');
      const rows = (data ?? []) as Array<{ grp: NotificationGroup; in_app: boolean; push: boolean }>;
      return mergeSettings(rows.map((r) => ({ group: r.grp, inApp: r.in_app, push: r.push })));
    },

    async setSetting(setting) {
      const s = normalizeSetting(setting);
      const { error } = await sb.rpc('set_notification_setting', { p_group: s.group, p_in_app: s.inApp, p_push: s.push });
      if (error) fail(error, 'Ayar kaydedilemedi.');
    },

    async registerPushToken(token, platform) {
      const { error } = await sb.rpc('register_push_token', { p_token: token, p_platform: platform });
      if (error) fail(error, 'Cihaz bildirime kaydedilemedi.');
    },

    async unregisterPushToken(token) {
      const { error } = await sb.rpc('unregister_push_token', { p_token: token });
      if (error) fail(error, 'Cihaz kaydı silinemedi.');
    },

    subscribe(onChange) {
      let channel: RealtimeChannel | null = null;
      let closed = false;
      void uid().then((me) => {
        if (!me || closed) return;
        channel = sb
          .channel(`notifications:${me}`)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${me}` }, () => onChange())
          .subscribe();
      });
      return () => {
        closed = true;
        if (channel) void sb.removeChannel(channel);
      };
    },
  };
}
