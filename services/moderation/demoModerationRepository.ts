import { CATEGORY_BY_SLUG } from '../../constants/categories';
import { validateReason } from '../../lib/moderation';
import type { AuthorSummary, UserRole } from '../../types/forum';
import type { HiddenTopic, MemberModeration, ModAction, ModLogEntry, ReportCase, ReportStatus, Sanction, SanctionKind } from '../../types/moderation';
import { DEMO_USERS } from '../forum/demoData';
import { buildDemoState, DEMO_GUEST } from '../forum/demoRepository';
import type { DemoState } from '../forum/demoRepository';
import { ForumError } from '../forum/repository';
import type { ModerationRepository } from './repository';

type StoredTopic = DemoState['topics'][number];
type StoredPost = DemoState['posts'][number];

interface StoredReport {
  postId: string;
  reporterId: string;
  reason: string;
  createdAt: string;
  status: ReportStatus;
}

interface StoredSanction extends Sanction {
  userId: string;
}

const MIN = 60_000;

/**
 * In-memory moderation for demo mode. The demo guest acts as a moderator so every tool can be tried;
 * actions change the shared demo forum state (pin, lock, move, hide, remove).
 */
export function createDemoModerationRepository(state: DemoState = buildDemoState(), clock: () => number = Date.now): ModerationRepository {
  const iso = (minutesAgo = 0) => new Date(clock() - minutesAgo * MIN).toISOString();
  const users = (): AuthorSummary[] => [...DEMO_USERS, DEMO_GUEST];
  const byId = (id: string) => users().find((u) => u.id === id) ?? null;
  const byName = (name: string) => users().find((u) => u.username === name.trim().toLowerCase()) ?? null;
  const roles = new Map<string, UserRole>();
  const roleOf = (u: AuthorSummary): UserRole => roles.get(u.id) ?? u.role ?? 'user';

  const reports: StoredReport[] = [
    { postId: 'p-pivot-3', reporterId: 'u-kopenhag', reason: 'Konu dışı: taktik konusunda tribün yorumu.', createdAt: iso(40), status: 'open' },
    { postId: 'p-pivot-3', reporterId: 'u-ankara', reason: 'Tartışmayla ilgisi yok.', createdAt: iso(25), status: 'open' },
    { postId: 'p-kis-2', reporterId: 'u-akademi', reason: 'Kaynak belirtilmeden kesin konuşuyor.', createdAt: iso(180), status: 'open' },
    { postId: 'p-bek-2', reporterId: 'u-pota', reason: 'Bence yanlış bilgi.', createdAt: iso(60 * 30), status: 'dismissed' },
  ];
  const sanctions: StoredSanction[] = [
    { id: 's-demo-1', userId: 'u-pota', kind: 'mute', reason: 'Aynı mesajı birden çok konuya yapıştırma', createdAt: iso(60 * 72), endsAt: iso(60 * 48), revokedAt: null, by: 'galaforum_mod' },
  ];
  const removed = new Map<string, StoredPost>();
  const hidden = new Map<string, { topic: StoredTopic; posts: StoredPost[]; at: string; reason: string; by: string }>();
  const blocks = new Set<string>();
  let logSeq = 3;
  const log: ModLogEntry[] = [
    { id: 3, action: 'topic_pin', targetType: 'topic', targetId: 't-kaynak-rehberi', targetLabel: 'Transfer haberlerinde kaynak güvenilirliği nasıl ölçülür?', reason: '', meta: {}, createdAt: iso(60 * 24 * 6), actor: byId('u-mod') },
    { id: 2, action: 'user_mute', targetType: 'user', targetId: 'u-pota', targetLabel: 'potanin_aslani', reason: 'Aynı mesajı birden çok konuya yapıştırma', meta: { hours: 24 }, createdAt: iso(60 * 72), actor: byId('u-mod') },
    { id: 1, action: 'report_dismiss', targetType: 'post', targetId: 'p-bek-2', targetLabel: 'Bek bindirmeleri ve geride kalan alan: savunma dengesi', reason: 'Görüş farkı, kural ihlali yok.', meta: { reports: 1, topicId: 't-bek-bindirme' }, createdAt: iso(60 * 29), actor: byId('u-mod') },
  ];

  const record = (action: ModAction, targetType: ModLogEntry['targetType'], targetId: string, targetLabel: string, reason = '', meta: ModLogEntry['meta'] = {}) => {
    log.unshift({ id: ++logSeq, action, targetType, targetId, targetLabel, reason: reason.trim(), meta, createdAt: iso(), actor: DEMO_GUEST });
  };
  const need = (reason: string | undefined, required: boolean) => {
    const problem = validateReason(reason ?? '', required);
    if (problem) throw new ForumError(problem, 'validation');
    return (reason ?? '').trim();
  };
  const topicOf = (id: string) => {
    const t = state.topics.find((x) => x.id === id);
    if (!t) throw new ForumError('Konu bulunamadı.', 'not_found');
    return t;
  };
  const postOf = (id: string) => state.posts.find((p) => p.id === id) ?? removed.get(id) ?? null;
  const activeSanction = (userId: string, now = clock()) =>
    sanctions
      .filter((s) => s.userId === userId && !s.revokedAt && (!s.endsAt || new Date(s.endsAt).getTime() > now))
      .sort((a, b) => Number(b.kind === 'ban') - Number(a.kind === 'ban'))[0] ?? null;

  const caseOf = (postId: string, rows: StoredReport[]): ReportCase | null => {
    const post = postOf(postId);
    if (!post) return null;
    const topic = state.topics.find((t) => t.id === post.topicId) ?? hidden.get(post.topicId)?.topic;
    const author = byId(post.authorId) ?? { id: post.authorId, username: 'silinmiş_üye' };
    const sorted = [...rows].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const firstPost = state.posts.filter((p) => p.topicId === post.topicId).sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0];
    return {
      postId,
      topicId: post.topicId,
      topicTitle: topic?.title ?? 'Konu',
      topicHidden: hidden.has(post.topicId),
      body: post.body,
      isOpeningPost: firstPost?.id === postId,
      postRemoved: removed.has(postId),
      postCreatedAt: post.createdAt,
      author: { ...author, role: roleOf(author) },
      authorSanction: activeSanction(author.id)?.kind ?? null,
      status: rows.some((r) => r.status === 'open') ? 'open' : rows.some((r) => r.status === 'resolved') ? 'resolved' : 'dismissed',
      reportCount: rows.length,
      firstReportedAt: sorted[sorted.length - 1]!.createdAt,
      lastReportedAt: sorted[0]!.createdAt,
      reports: sorted.map((r) => ({ reporter: byId(r.reporterId)?.username ?? null, reason: r.reason, createdAt: r.createdAt, status: r.status })),
    };
  };

  const settle = (postIds: string[], status: ReportStatus) => {
    let n = 0;
    for (const r of reports) if (postIds.includes(r.postId) && r.status === 'open') {
      r.status = status;
      n += 1;
    }
    return n;
  };

  return {
    mode: 'demo',

    async reportQueue(status) {
      const ids = [...new Set(reports.map((r) => r.postId))];
      return ids
        .map((id) => caseOf(id, reports.filter((r) => r.postId === id)))
        .filter((c): c is ReportCase => Boolean(c))
        .filter((c) => (status === 'open' ? c.status === 'open' : c.status !== 'open'))
        .sort((a, b) => b.lastReportedAt.localeCompare(a.lastReportedAt));
    },

    async openReportCount() {
      return new Set(reports.filter((r) => r.status === 'open').map((r) => r.postId)).size;
    },

    async dismissReports(postId, note) {
      const reason = need(note, false);
      const n = settle([postId], 'dismissed');
      if (!n) throw new ForumError('Bu işlem zaten uygulanmış.', 'validation');
      const post = postOf(postId);
      record('report_dismiss', 'post', postId, post ? (state.topics.find((t) => t.id === post.topicId)?.title ?? '') : '', reason, { reports: n, topicId: post?.topicId });
    },

    async removePost(postId, reason) {
      const why = need(reason, true);
      const i = state.posts.findIndex((p) => p.id === postId);
      if (i < 0) throw new ForumError('Bu işlem zaten uygulanmış.', 'validation');
      const post = state.posts[i]!;
      const first = state.posts.filter((p) => p.topicId === post.topicId).sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0];
      if (first?.id === postId) throw new ForumError('Açılış mesajı tek başına kaldırılamaz; konuyu gizle.', 'validation');
      state.posts.splice(i, 1);
      removed.set(postId, post);
      settle([postId], 'resolved');
      record('post_remove', 'post', postId, topicOf(post.topicId).title, why, { topicId: post.topicId });
    },

    async restorePost(postId, reason) {
      const why = need(reason, false);
      const post = removed.get(postId);
      if (!post) throw new ForumError('Bu işlem zaten uygulanmış.', 'validation');
      removed.delete(postId);
      state.posts.push(post);
      record('post_restore', 'post', postId, state.topics.find((t) => t.id === post.topicId)?.title ?? '', why, { topicId: post.topicId });
    },

    async setTopicFlag(topicId, flag, on, reason) {
      const why = need(reason, flag === 'hidden' && on);
      if (flag === 'hidden') {
        if (on) {
          const t = topicOf(topicId);
          const posts = state.posts.filter((p) => p.topicId === topicId);
          state.topics.splice(state.topics.indexOf(t), 1);
          state.posts = state.posts.filter((p) => p.topicId !== topicId);
          hidden.set(topicId, { topic: t, posts, at: iso(), reason: why, by: DEMO_GUEST.username });
          settle(posts.map((p) => p.id), 'resolved');
          record('topic_hide', 'topic', topicId, t.title, why);
        } else {
          const h = hidden.get(topicId);
          if (!h) throw new ForumError('Bu işlem zaten uygulanmış.', 'validation');
          hidden.delete(topicId);
          state.topics.push(h.topic);
          state.posts.push(...h.posts);
          record('topic_unhide', 'topic', topicId, h.topic.title, why);
        }
        return;
      }
      const t = topicOf(topicId);
      const key = flag === 'pinned' ? 'pinned' : 'locked';
      if (t[key] === on) throw new ForumError('Bu işlem zaten uygulanmış.', 'validation');
      t[key] = on;
      const action: ModAction = flag === 'pinned' ? (on ? 'topic_pin' : 'topic_unpin') : on ? 'topic_lock' : 'topic_unlock';
      record(action, 'topic', topicId, t.title, why);
    },

    async moveTopic(topicId, categorySlug, reason) {
      const why = need(reason, false);
      if (!CATEGORY_BY_SLUG[categorySlug]) throw new ForumError('Kategori bulunamadı.', 'not_found');
      const t = topicOf(topicId);
      if (t.categorySlug === categorySlug) throw new ForumError('Bu işlem zaten uygulanmış.', 'validation');
      const from = t.categorySlug;
      t.categorySlug = categorySlug;
      record('topic_move', 'topic', topicId, t.title, why, { from, to: categorySlug });
    },

    async hiddenTopics(): Promise<HiddenTopic[]> {
      return [...hidden.values()]
        .sort((a, b) => b.at.localeCompare(a.at))
        .map((h) => ({
          id: h.topic.id,
          title: h.topic.title,
          hiddenAt: h.at,
          reason: h.reason,
          author: byId(h.topic.authorId)?.username ?? 'silinmiş_üye',
          hiddenBy: h.by,
          category: CATEGORY_BY_SLUG[h.topic.categorySlug]?.name ?? h.topic.categorySlug,
        }));
    },

    async member(username): Promise<MemberModeration | null> {
      const u = byName(username);
      if (!u) return null;
      const mine = sanctions.filter((s) => s.userId === u.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      const active = activeSanction(u.id);
      const postIds = new Set(state.posts.filter((p) => p.authorId === u.id).map((p) => p.id));
      return {
        author: { ...u, role: roleOf(u) },
        // Same rule as the demo forum profile: the member's first post marks the join date.
        joinedAt: state.posts.filter((p) => p.authorId === u.id).map((p) => p.createdAt).sort()[0] ?? iso(),
        postCount: postIds.size,
        removedPostCount: [...removed.values()].filter((p) => p.authorId === u.id).length,
        openReportCount: new Set(reports.filter((r) => r.status === 'open' && postIds.has(r.postId)).map((r) => r.postId)).size,
        activeSanction: active ? { ...active } : null,
        sanctions: mine.map(({ userId: _userId, ...s }) => s),
      };
    },

    async sanction(username, kind: SanctionKind, hours, reason) {
      const why = need(reason, true);
      const u = byName(username);
      if (!u) throw new ForumError('Üye bulunamadı.', 'not_found');
      if (u.id === DEMO_GUEST.id || roleOf(u) === 'moderator' || roleOf(u) === 'admin') throw new ForumError('Bu işlem için yetkin yok.', 'validation');
      if (hours !== null && (hours < 1 || hours > 8760)) throw new ForumError('Süre 1 saat ile 1 yıl arasında olmalı.', 'validation');
      const id = `s-demo-${Date.now().toString(36)}`;
      const endsAt = hours === null ? null : new Date(clock() + hours * 3_600_000).toISOString();
      sanctions.push({ id, userId: u.id, kind, reason: why, createdAt: iso(), endsAt, revokedAt: null, by: DEMO_GUEST.username });
      record(kind === 'ban' ? 'user_ban' : 'user_mute', 'user', u.id, u.username, why, { hours, endsAt });
      return id;
    },

    async revokeSanction(id, reason) {
      const why = need(reason, false);
      const s = sanctions.find((x) => x.id === id);
      if (!s) throw new ForumError('Yaptırım bulunamadı.', 'not_found');
      if (s.revokedAt) throw new ForumError('Bu işlem zaten uygulanmış.', 'validation');
      s.revokedAt = iso();
      record('sanction_revoke', 'user', s.userId, byId(s.userId)?.username ?? '', why, { kind: s.kind });
    },

    async setRole(username, role) {
      const u = byName(username);
      if (!u) throw new ForumError('Üye bulunamadı.', 'not_found');
      if (u.id === DEMO_GUEST.id) throw new ForumError('Bu işlem için yetkin yok.', 'validation');
      const from = roleOf(u);
      if (from === role) throw new ForumError('Bu işlem zaten uygulanmış.', 'validation');
      roles.set(u.id, role);
      record('role_change', 'user', u.id, u.username, '', { from, to: role });
    },

    async log({ before = null, limit = 50 } = {}) {
      return log.filter((e) => before == null || e.id < before).slice(0, Math.min(Math.max(limit, 1), 200));
    },

    async myRestriction() {
      return null;
    },

    async setBlock(username, on) {
      const u = byName(username);
      if (!u) throw new ForumError('Üye bulunamadı.', 'not_found');
      if (u.id === DEMO_GUEST.id) throw new ForumError('Kendini engelleyemezsin.', 'validation');
      if (on) blocks.add(u.id);
      else blocks.delete(u.id);
      return on;
    },

    async myBlocks() {
      return [...blocks].map((id) => byId(id)).filter((u): u is AuthorSummary => Boolean(u));
    },
  };
}
