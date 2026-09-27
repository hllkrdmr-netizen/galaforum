import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { describeNotification } from '../lib/notifications';
import {
  actionInfo,
  durationLabel,
  isStaffRole,
  logDetail,
  logTargetHref,
  MODERATION_MESSAGES,
  restrictionText,
  SANCTION_DURATIONS,
  validateReason,
} from '../lib/moderation';
import { buildDemoState, createDemoRepository } from '../services/forum/demoRepository';
import { createDemoModerationRepository } from '../services/moderation/demoModerationRepository';
import type { ModLogEntry } from '../types/moderation';
import type { AppNotification } from '../types/notification';

const NOW = new Date(2026, 8, 28, 12, 0).getTime();

test('reason validation and durations', () => {
  assert.equal(validateReason('', false), null);
  assert.ok(validateReason('', true));
  assert.ok(validateReason('ab', true));
  assert.equal(validateReason('Spam / reklam', true), null);
  assert.ok(validateReason('x'.repeat(501), false));
  assert.equal(durationLabel(null), 'süresiz');
  assert.equal(durationLabel(168), '7 gün');
  assert.equal(durationLabel(48), '2 gün');
  assert.equal(durationLabel(5), '5 saat');
  assert.ok(SANCTION_DURATIONS.every((d) => d.hours === null || (d.hours >= 1 && d.hours <= 8760)), 'server accepts 1–8760 h');
  assert.ok(isStaffRole('moderator') && isStaffRole('admin') && !isStaffRole('verified') && !isStaffRole(undefined));
});

test('restriction banner text', () => {
  const mute = restrictionText({ kind: 'mute', reason: 'Hakaret', endsAt: new Date(2026, 8, 29, 18, 30).toISOString() });
  assert.equal(mute.title, '29 Eyl 18:30’e kadar susturuldun');
  assert.match(mute.body, /Gerekçe: Hakaret/);
  assert.equal(restrictionText({ kind: 'ban', reason: 'Spam', endsAt: null }).title, 'Hesabın süresiz yasaklandı');
});

test('audit log rendering', () => {
  const base: Omit<ModLogEntry, 'action' | 'meta'> = { id: 1, targetType: 'topic', targetId: 't1', targetLabel: 'Konu', reason: '', createdAt: new Date(NOW).toISOString(), actor: null };
  assert.equal(logDetail({ ...base, action: 'topic_move', meta: { from: 'transfer', to: 'mac-taktik' } }), 'Transfer → Maç & Taktik');
  assert.equal(logDetail({ ...base, action: 'role_change', targetType: 'user', meta: { from: 'user', to: 'moderator' } }), 'Üye → Moderatör');
  assert.equal(logDetail({ ...base, action: 'user_mute', targetType: 'user', meta: { hours: 24 } }), '24 saat');
  assert.equal(logTargetHref({ ...base, action: 'topic_pin', meta: {} }), '/konu/t1');
  assert.equal(logTargetHref({ ...base, action: 'topic_hide', meta: {} }), null, 'hidden topics are not linkable');
  assert.equal(logTargetHref({ ...base, action: 'user_ban', targetType: 'user', targetLabel: 'uye_iki', meta: {} }), '/moderasyon/uye/uye_iki');
  assert.equal(actionInfo('post_remove').tone, 'danger');
});

test('every server error code used by the moderation migration has a Turkish message', () => {
  const sql = readFileSync(new URL('../supabase/migrations/20260928090000_moderation.sql', import.meta.url), 'utf8');
  const codes = new Set([...sql.matchAll(/raise exception '([a-z_]+)'/g)].map((m) => m[1]!));
  const known = new Set(MODERATION_MESSAGES.map(([k]) => k));
  // Generic codes mapped by status (auth_required → 28000, *_not_found → P0002) or covered by client validation.
  const generic = ['auth_required', 'post_not_found', 'topic_not_found', 'sanction_not_found', 'category_not_found', 'invalid_status', 'invalid_flag', 'invalid_kind', 'invalid_role'];
  for (const c of codes) if (!generic.includes(c)) assert.ok(known.has(c), `missing message for ${c}`);
});

test('moderation notices come from the team, never a moderator', () => {
  const n: AppNotification = {
    id: 'n1', kind: 'moderation', actor: null, actorCount: 1, topicId: 't1', postId: null, meetupId: null, matchId: null, badgeId: null,
    data: { action: 'post_removed', topic_title: 'Derbi', reason: 'Hakaret' }, createdAt: new Date(NOW).toISOString(), readAt: null,
  };
  const v = describeNotification(n);
  assert.equal(v.lead, 'Mesajın kaldırıldı:');
  assert.equal(v.preview, 'Gerekçe: Hakaret');
  assert.equal(v.href, '/konu/t1');
  assert.equal(describeNotification({ ...n, data: { action: 'role_changed', role: 'moderator' } }).subject, 'Moderatör');
});

test('demo moderation acts on the shared forum state', async () => {
  const state = buildDemoState(NOW);
  const forum = createDemoRepository(state);
  const mod = createDemoModerationRepository(state, () => NOW);

  assert.equal(await mod.openReportCount(), 2);
  const queue = await mod.reportQueue('open');
  assert.equal(queue[0]!.postId, 'p-pivot-3', 'newest report first');
  assert.equal(queue[0]!.reportCount, 2);

  // dismiss
  await mod.dismissReports('p-kis-2', 'Görüş farkı');
  assert.equal(await mod.openReportCount(), 1);
  assert.ok((await mod.reportQueue('closed')).some((c) => c.postId === 'p-kis-2' && c.status === 'dismissed'));
  await assert.rejects(mod.dismissReports('p-kis-2'));

  // remove / restore
  await assert.rejects(mod.removePost('p-pivot-3', ''), /gerekçe/i);
  await mod.removePost('p-pivot-3', 'Konu dışı');
  let topic = await forum.getTopic('t-cift-pivot');
  assert.ok(topic && !topic.posts.some((p) => p.id === 'p-pivot-3'));
  assert.equal(await mod.openReportCount(), 0, 'removing settles the reports');
  await assert.rejects(mod.removePost('p-pivot-1', 'Açılış'), /konuyu gizle/i);
  await mod.restorePost('p-pivot-3');
  topic = await forum.getTopic('t-cift-pivot');
  assert.ok(topic?.posts.some((p) => p.id === 'p-pivot-3'));

  // pin / lock / move / hide
  await mod.setTopicFlag('t-bek-bindirme', 'pinned', true);
  await mod.setTopicFlag('t-bek-bindirme', 'locked', true);
  await assert.rejects(mod.setTopicFlag('t-bek-bindirme', 'locked', true));
  await mod.moveTopic('t-bek-bindirme', 'takim-oyuncular');
  const moved = await forum.getTopic('t-bek-bindirme');
  assert.equal(moved?.isPinned, true);
  assert.equal(moved?.isLocked, true);
  assert.equal(moved?.category.slug, 'takim-oyuncular');
  await assert.rejects(mod.setTopicFlag('t-bek-bindirme', 'hidden', true, ''));
  await mod.setTopicFlag('t-bek-bindirme', 'hidden', true, 'Tekrar eden konu');
  assert.equal(await forum.getTopic('t-bek-bindirme'), null);
  assert.equal((await mod.hiddenTopics())[0]?.id, 't-bek-bindirme');
  await mod.setTopicFlag('t-bek-bindirme', 'hidden', false);
  assert.ok(await forum.getTopic('t-bek-bindirme'));

  // sanctions and roles
  await assert.rejects(mod.sanction('galaforum_mod', 'mute', 24, 'Deneme amaçlı'), /yetkin yok/);
  const id = await mod.sanction('taktikdefteri', 'mute', 24, 'Tekrarlayan hakaret');
  const member = await mod.member('taktikdefteri');
  assert.equal(member?.activeSanction?.kind, 'mute');
  await mod.revokeSanction(id, 'İtiraz kabul');
  assert.equal((await mod.member('taktikdefteri'))?.activeSanction, null);
  await mod.setRole('taktikdefteri', 'verified');
  assert.equal((await mod.member('taktikdefteri'))?.author.role, 'verified');
  await assert.rejects(mod.setRole('taktikdefteri', 'verified'));

  // audit log: newest first, keyset paging
  const log = await mod.log({ limit: 5 });
  assert.equal(log[0]!.action, 'role_change');
  assert.ok(log.every((e, i) => i === 0 || e.id < log[i - 1]!.id));
  const older = await mod.log({ before: log[log.length - 1]!.id, limit: 100 });
  assert.ok(older.every((e) => e.id < log[log.length - 1]!.id));

  // blocks
  await assert.rejects(mod.setBlock('misafir_taraftar', true));
  await mod.setBlock('taktikdefteri', true);
  assert.deepEqual((await mod.myBlocks()).map((u) => u.username), ['taktikdefteri']);
  await mod.setBlock('taktikdefteri', false);
  assert.equal((await mod.myBlocks()).length, 0);
});
