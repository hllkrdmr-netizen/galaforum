import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import {
  actorLabel,
  changeSetting,
  compareNewestFirst,
  cursorOf,
  DEFAULT_SETTINGS,
  describeNotification,
  EXPO_TOKEN_PATTERN,
  groupOf,
  mergeSettings,
  NOTIFICATION_GROUPS,
  notificationText,
  parseCursor,
  pushHref,
  sectionByDay,
  unreadLabel,
} from '../lib/notifications';
import { buildDemoNotifications, createDemoNotificationRepository } from '../services/notifications/demoNotificationRepository';
import type { AppNotification, NotificationKind } from '../types/notification';

const NOW = new Date(2026, 8, 27, 18, 0).getTime();
const u = (username: string) => ({ id: `u-${username}`, username });
const make = (kind: NotificationKind, patch: Partial<AppNotification> = {}): AppNotification => ({
  id: `n-${kind}`,
  kind,
  actor: u('burak_gs'),
  actorCount: 1,
  topicId: 't1',
  postId: 'p1',
  meetupId: null,
  matchId: null,
  badgeId: null,
  data: { topic_title: 'Derbi için ideal orta saha' },
  createdAt: new Date(NOW - 60_000).toISOString(),
  readAt: null,
  ...patch,
});

test('groups and defaults match the Phase 7 migration', () => {
  const sql = readFileSync(new URL('../supabase/migrations/20260927230000_notifications.sql', import.meta.url), 'utf8');
  const pushDefaults = /else p_group in \(([^)]*)\)/.exec(sql)?.[1]?.match(/'([a-z_]+)'/g)?.map((s) => s.slice(1, -1)) ?? [];
  assert.deepEqual(
    DEFAULT_SETTINGS.filter((s) => s.push).map((s) => s.group).sort(),
    [...pushDefaults].sort(),
  );
  const groupCheck = /grp text not null check \(grp in \(([^)]*)\)\)/.exec(sql)?.[1]?.match(/'([a-z_]+)'/g)?.map((s) => s.slice(1, -1)) ?? [];
  assert.deepEqual(NOTIFICATION_GROUPS.map((g) => g.group).sort(), [...groupCheck].sort());
  assert.ok(DEFAULT_SETTINGS.every((s) => s.inApp));
});

test('kinds map to settings groups', () => {
  assert.equal(groupOf('meetup_join'), 'meetup');
  assert.equal(groupOf('meetup_cancelled'), 'meetup');
  assert.equal(groupOf('match_goal'), 'match');
  assert.equal(groupOf('reply'), 'reply');
});

test('settings: push needs in-app; merge fills defaults in display order', () => {
  const base = { group: 'like' as const, inApp: true, push: false };
  assert.deepEqual(changeSetting(base, { push: true }), { group: 'like', inApp: true, push: true });
  assert.deepEqual(changeSetting({ ...base, push: true }, { inApp: false }), { group: 'like', inApp: false, push: false });
  assert.deepEqual(changeSetting({ ...base, inApp: false }, { push: true }), { group: 'like', inApp: true, push: true });
  const merged = mergeSettings([{ group: 'match', inApp: false, push: true }]);
  assert.equal(merged.length, NOTIFICATION_GROUPS.length);
  assert.deepEqual(merged.find((s) => s.group === 'match'), { group: 'match', inApp: false, push: false });
  assert.equal(merged[0]!.group, 'reply');
});

test('labels', () => {
  assert.equal(unreadLabel(0), '');
  assert.equal(unreadLabel(7), '7');
  assert.equal(unreadLabel(250), '99+');
  assert.equal(actorLabel(u('burak_gs'), 1), 'burak_gs');
  assert.equal(actorLabel(u('burak_gs'), 4), 'burak_gs ve 3 kişi daha');
  assert.equal(actorLabel(null, 1), 'GalaForum');
});

test('every kind has a sentence and a destination', () => {
  const kinds: NotificationKind[] = [
    'reply', 'quote', 'mention', 'like', 'follow', 'category_topic',
    'meetup_join', 'meetup_cancelled', 'match_start', 'match_goal', 'match_end', 'badge',
  ];
  for (const kind of kinds) {
    const system = kind.startsWith('match_') || kind === 'badge' || kind === 'meetup_cancelled';
    const v = describeNotification(make(kind, { meetupId: 'bm1', matchId: 'm1', actor: system ? null : u('burak_gs') }), 'ayse_gs');
    assert.ok(v.lead.length > 0, kind);
    assert.ok(v.href, `${kind} has a link`);
  }
  assert.equal(describeNotification(make('follow')).href, '/uye/burak_gs');
  assert.equal(describeNotification(make('badge', { actor: null }), 'ayse_gs').href, '/uye/ayse_gs');
  assert.equal(describeNotification(make('match_goal', { matchId: 'm1', actor: null })).href, '/mac/m1');
  assert.equal(describeNotification(make('meetup_join', { meetupId: 'bm1' })).href, '/bulusma/bm1');
  assert.equal(describeNotification(make('reply')).href, '/konu/t1?mesaj=p1', 'replies open at the post');
  assert.equal(describeNotification(make('reply', { postId: null })).href, '/konu/t1');
});

test('match texts use the snapshot data', () => {
  const goal = make('match_goal', {
    actor: null,
    matchId: 'm1',
    data: { match_title: 'Galatasaray – Trabzonspor', minute: 45, extra_minute: 2, event_type: 'penalty_goal', team: 'Galatasaray' },
  });
  assert.equal(notificationText(goal), "Penaltı golü! 45+2' (Galatasaray) Galatasaray – Trabzonspor");
  const end = make('match_end', { actor: null, matchId: 'm1', data: { match_title: 'Galatasaray – Kasımpaşa', home_score: 2, away_score: 1 } });
  assert.equal(describeNotification(end).subject, 'Galatasaray 2 – 1 Kasımpaşa');
  const grouped = make('reply', { actorCount: 3 });
  assert.equal(notificationText(grouped), 'burak_gs ve 2 kişi daha yanıt yazdı: Derbi için ideal orta saha');
});

test('inbox sections by day keep newest-first order', () => {
  const at = (minutesAgo: number, id: string) => make('reply', { id, createdAt: new Date(NOW - minutesAgo * 60_000).toISOString() });
  const items = [at(5, 'a'), at(60, 'b'), at(24 * 60, 'c'), at(3 * 24 * 60, 'd'), at(20 * 24 * 60, 'e')];
  const sections = sectionByDay(items, NOW);
  assert.deepEqual(
    sections.map((s) => [s.title, s.items.map((n) => n.id).join('')]),
    [['Bugün', 'ab'], ['Dün', 'c'], ['Bu hafta', 'd'], ['Daha önce', 'e']],
  );
});

test('keyset cursor round-trips and breaks ties by id', () => {
  const a = { id: 'b', createdAt: '2026-09-27T10:00:00.000Z' };
  const b = { id: 'a', createdAt: '2026-09-27T10:00:00.000Z' };
  assert.deepEqual(parseCursor(cursorOf(a)), a);
  assert.equal(parseCursor('garbage'), null);
  assert.equal(parseCursor('not-a-date|x'), null);
  assert.ok(compareNewestFirst(a, b) < 0, 'same time: larger id first');
});

test('push taps open the right screen', () => {
  assert.equal(pushHref(null), '/bildirimler');
  assert.equal(pushHref({ kind: 'match_goal', matchId: 'm1', topicId: 't1' }), '/mac/m1');
  assert.equal(pushHref({ kind: 'reply', topicId: 't1' }), '/konu/t1');
  assert.equal(pushHref({ kind: 'mention', topicId: 't1', postId: 'p9' }), '/konu/t1?mesaj=p9');
  assert.equal(pushHref({ kind: 'follow', actorUsername: 'burak_gs' }), '/uye/burak_gs');
  assert.equal(pushHref({ kind: 'meetup_cancelled', meetupId: 'bm1' }), '/bulusma/bm1');
  assert.ok(EXPO_TOKEN_PATTERN.test('ExponentPushToken[abcdefghij123456]'));
  assert.ok(!EXPO_TOKEN_PATTERN.test('ExponentPushToken[short]'));
});

test('demo inbox: paging, unread filter, mark read, settings hide groups', async () => {
  const seed = buildDemoNotifications(NOW);
  const repo = createDemoNotificationRepository(seed, () => NOW);
  const unread = seed.filter((n) => !n.readAt).length;
  assert.equal(await repo.unreadCount(), unread);

  const p1 = await repo.list({ limit: 4 });
  assert.equal(p1.items.length, 4);
  assert.ok(p1.nextCursor);
  const p2 = await repo.list({ limit: 4, before: p1.nextCursor });
  const p3 = await repo.list({ limit: 100, before: p2.nextCursor });
  const all = [...p1.items, ...p2.items, ...p3.items].map((n) => n.id);
  assert.equal(new Set(all).size, seed.length, 'pages neither overlap nor skip');
  assert.equal(p3.nextCursor, null);

  let changes = 0;
  const off = repo.subscribe(() => (changes += 1));
  const onlyUnread = await repo.list({ unreadOnly: true });
  assert.equal(onlyUnread.items.length, unread);
  assert.equal(await repo.markRead([onlyUnread.items[0]!.id]), 1);
  assert.equal(await repo.unreadCount(), unread - 1);
  await repo.markRead();
  assert.equal(await repo.unreadCount(), 0);
  assert.equal(changes, 2);
  off();

  await repo.setSetting({ group: 'match', inApp: false, push: true });
  const settings = await repo.getSettings();
  assert.deepEqual(settings.find((s) => s.group === 'match'), { group: 'match', inApp: false, push: false });
  const visible = await repo.list({ limit: 100 });
  assert.ok(visible.items.every((n) => groupOf(n.kind) !== 'match'));

  await assert.rejects(repo.registerPushToken('nope', 'ios'));
  await repo.registerPushToken('ExponentPushToken[abcdefghij123456]', 'ios');
});
