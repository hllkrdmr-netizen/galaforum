import type { SupabaseClient } from '@supabase/supabase-js';

import { MODERATION_MESSAGES, validateReason } from '../../lib/moderation';
import type { AuthorSummary } from '../../types/forum';
import type { HiddenTopic, MemberModeration, ModLogEntry, ReportCase, Restriction } from '../../types/moderation';
import { ForumError } from '../forum/repository';
import type { ModerationRepository } from './repository';

function fail(error: { message: string; code?: string }, fallback: string): never {
  if (/fetch|network|timeout/i.test(error.message)) throw new ForumError('Bağlantı kurulamadı. İnternetini kontrol edip tekrar dene.', 'network');
  if (error.code === '28000') throw new ForumError('Bu işlem için giriş yapmalısın.', 'auth_required');
  const known = MODERATION_MESSAGES.find(([k]) => error.message.includes(k));
  if (known) throw new ForumError(known[1], 'validation');
  if (error.code === 'P0002') throw new ForumError('Kayıt bulunamadı.', 'not_found');
  throw new ForumError(fallback, 'unknown');
}

function checked(reason: string | undefined, required: boolean): string {
  const problem = validateReason(reason ?? '', required);
  if (problem) throw new ForumError(problem, 'validation');
  return (reason ?? '').trim();
}

export function createSupabaseModerationRepository(sb: SupabaseClient): ModerationRepository {
  const signedIn = async () => Boolean((await sb.auth.getSession()).data.session);

  async function call<T>(name: string, args: Record<string, unknown>, fallback: string): Promise<T> {
    const { data, error } = await sb.rpc(name, args);
    if (error) fail(error, fallback);
    return data as T;
  }

  return {
    mode: 'supabase',

    async reportQueue(status) {
      return (await call<ReportCase[] | null>('mod_report_queue', { p_status: status, p_limit: 100 }, 'Şikâyetler yüklenemedi.')) ?? [];
    },

    async openReportCount() {
      return (await call<number | null>('mod_open_report_count', {}, 'Şikâyet sayısı alınamadı.')) ?? 0;
    },

    async dismissReports(postId, note) {
      await call('mod_dismiss_reports', { p_post_id: postId, p_note: checked(note, false) || null }, 'Şikâyet kapatılamadı.');
    },

    async removePost(postId, reason) {
      await call('mod_remove_post', { p_post_id: postId, p_reason: checked(reason, true) }, 'Mesaj kaldırılamadı.');
    },

    async restorePost(postId, reason) {
      await call('mod_restore_post', { p_post_id: postId, p_reason: checked(reason, false) || null }, 'Mesaj geri getirilemedi.');
    },

    async setTopicFlag(topicId, flag, on, reason) {
      await call(
        'mod_set_topic_flag',
        { p_topic_id: topicId, p_flag: flag, p_on: on, p_reason: checked(reason, flag === 'hidden' && on) || null },
        'Konu güncellenemedi.',
      );
    },

    async moveTopic(topicId, categorySlug, reason) {
      await call('mod_move_topic', { p_topic_id: topicId, p_category_slug: categorySlug, p_reason: checked(reason, false) || null }, 'Konu taşınamadı.');
    },

    async hiddenTopics() {
      return (await call<HiddenTopic[] | null>('mod_hidden_topics', { p_limit: 100 }, 'Gizlenen konular yüklenemedi.')) ?? [];
    },

    async member(username) {
      return call<MemberModeration | null>('mod_member', { p_username: username }, 'Üye bilgisi yüklenemedi.');
    },

    async sanction(username, kind, hours, reason) {
      return String(
        await call('mod_sanction', { p_username: username, p_kind: kind, p_hours: hours, p_reason: checked(reason, true) }, 'Yaptırım uygulanamadı.'),
      );
    },

    async revokeSanction(id, reason) {
      await call('mod_revoke_sanction', { p_sanction_id: id, p_reason: checked(reason, false) || null }, 'Yaptırım kaldırılamadı.');
    },

    async setRole(username, role) {
      await call('mod_set_role', { p_username: username, p_role: role }, 'Rol değiştirilemedi.');
    },

    async log({ before = null, limit = 50 } = {}) {
      return (await call<ModLogEntry[] | null>('mod_log', { p_before: before, p_limit: limit }, 'Kayıtlar yüklenemedi.')) ?? [];
    },

    async myRestriction() {
      if (!(await signedIn())) return null;
      return call<Restriction | null>('my_restriction', {}, 'Hesap durumu alınamadı.');
    },

    async setBlock(username, on) {
      return Boolean(await call('set_block', { p_username: username, p_on: on }, 'Engelleme güncellenemedi.'));
    },

    async myBlocks() {
      if (!(await signedIn())) return [];
      return (await call<AuthorSummary[] | null>('my_blocks', {}, 'Engellenenler yüklenemedi.')) ?? [];
    },
  };
}
