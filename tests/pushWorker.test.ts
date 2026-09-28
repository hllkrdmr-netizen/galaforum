import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildMessages, dispatch, pushText } from '../supabase/functions/push-dispatch/index.ts';
import type { ClaimedRow, ExpoMessage, ExpoTicket } from '../supabase/functions/push-dispatch/index.ts';
import { pushHref } from '../lib/notifications';
import type { PushPayload } from '../lib/notifications';

const row = (patch: Partial<ClaimedRow> = {}): ClaimedRow => ({
  notification_id: 'n1', user_id: 'u1', kind: 'reply', actor_username: 'burak_gs', actor_count: 1,
  topic_id: 't1', post_id: 'p1', meetup_id: null, match_id: null,
  data: { topic_title: 'Derbi için ideal orta saha', excerpt: 'Bence yüksek pres.' }, tokens: ['ExponentPushToken[aaaaaaaaaaaa]'],
  ...patch,
});

test('every kind has a Turkish title and body without placeholders', () => {
  const kinds = ['reply', 'quote', 'mention', 'like', 'follow', 'category_topic', 'meetup_join', 'meetup_cancelled', 'match_start', 'match_goal', 'match_end', 'badge', 'moderation', 'unknown'];
  for (const kind of kinds) {
    const t = pushText(row({ kind, data: {} }));
    assert.ok(t.title.length > 0 && t.body.length > 0, kind);
    assert.ok(!/undefined|null/.test(t.title + t.body), `${kind}: ${t.title} / ${t.body}`);
  }
  assert.deepEqual(pushText(row({ actor_count: 3 })), { title: 'Derbi için ideal orta saha', body: 'burak_gs ve 2 kişi daha yanıt yazdı: Bence yüksek pres.' });
  assert.equal(pushText(row({ kind: 'match_goal', data: { minute: 45, extra_minute: 2, team: 'Galatasaray', match_title: 'Galatasaray – Trabzonspor' } })).title, "GOL! 45+2' Galatasaray");
  assert.equal(pushText(row({ kind: 'match_end', data: { match_title: 'Galatasaray – Kasımpaşa', home_score: 2, away_score: 1 } })).body, 'Galatasaray 2 – 1 Kasımpaşa');
  assert.ok(pushText(row({ data: { excerpt: 'a'.repeat(400) } })).body.length <= 178);
});

test('one message per device token; tapping opens the right screen', () => {
  const msgs = buildMessages([row({ tokens: ['ExponentPushToken[a1a1a1a1a1a1]', 'ExponentPushToken[b2b2b2b2b2b2]'] }), row({ notification_id: 'n2', tokens: [] })]);
  assert.equal(msgs.length, 2);
  // The worker's `kind` is a plain string on the wire; the app narrows it when a push is tapped.
  assert.equal(pushHref(msgs[0]!.data as PushPayload), '/konu/t1?mesaj=p1');
  assert.equal(pushHref(buildMessages([row({ kind: 'match_goal', match_id: 'm1' })])[0]!.data as PushPayload), '/mac/m1');
});

test('dispatch: chunks of 100, disables unregistered devices, marks fully failed notifications', async () => {
  const rows = Array.from({ length: 150 }, (_, i) => row({ notification_id: `n${i}`, tokens: [`ExponentPushToken[tok${String(i).padStart(9, '0')}]`] }));
  rows[0]!.tokens.push('ExponentPushToken[secondtoken01]');
  const calls: Array<[string, Record<string, unknown>]> = [];
  const sent: number[] = [];
  const result = await dispatch({
    async rpc(name, args) {
      calls.push([name, args]);
      return name === 'claim_push_batch' ? rows : null;
    },
    async send(messages: ExpoMessage[]): Promise<ExpoTicket[]> {
      sent.push(messages.length);
      if (sent.length === 2) throw new Error('503');
      return messages.map((m) =>
        m.to.includes('tok000000000') ? { status: 'error', details: { error: 'DeviceNotRegistered' } } : { status: 'ok', id: 'x' },
      );
    },
  });
  assert.deepEqual(sent, [100, 51]);
  assert.equal(result.claimed, 150);
  assert.equal(result.accepted, 99, 'first chunk minus the unregistered token');
  assert.deepEqual(result.disabledTokens, ['ExponentPushToken[tok000000000]']);
  assert.ok(!result.failedNotifications.includes('n0'), 'n0 still reached its second device');
  assert.equal(result.failedNotifications.length, 51, 'whole second chunk failed');
  assert.deepEqual(calls.map(([n]) => n), ['claim_push_batch', 'disable_push_tokens', 'mark_push_failed']);
});
