import assert from 'node:assert/strict';
import { test } from 'node:test';

import { formatCount, formatRelativeTime, initials, toPreview } from '../lib/format';

const NOW = Date.UTC(2026, 8, 27, 12, 0, 0);
const ago = (ms: number) => new Date(NOW - ms).toISOString();

test('formatRelativeTime produces compact Turkish labels', () => {
  assert.equal(formatRelativeTime(ago(20_000), NOW), 'az önce');
  assert.equal(formatRelativeTime(ago(5 * 60_000), NOW), '5 dk önce');
  assert.equal(formatRelativeTime(ago(3 * 3_600_000), NOW), '3 sa önce');
  assert.equal(formatRelativeTime(ago(30 * 3_600_000), NOW), 'dün');
  assert.equal(formatRelativeTime(ago(4 * 86_400_000), NOW), '4 gün önce');
  assert.equal(formatRelativeTime(null, NOW), '—');
  assert.equal(formatRelativeTime('not-a-date', NOW), '—');
});

test('formatCount compacts large numbers with Turkish decimal comma', () => {
  assert.equal(formatCount(0), '0');
  assert.equal(formatCount(950), '950');
  assert.equal(formatCount(1000), '1 B');
  assert.equal(formatCount(1250), '1,2 B');
  assert.equal(formatCount(2_400_000), '2,4 Mn');
});

test('toPreview drops quoted lines and truncates on a word boundary', () => {
  assert.equal(toPreview('> alıntı\n\nAsıl mesaj burada.'), 'Asıl mesaj burada.');
  const long = 'kelime '.repeat(60);
  const p = toPreview(long, 50);
  assert.ok(p.endsWith('…'));
  assert.ok(p.length <= 51);
});

test('initials handles underscores and Turkish casing', () => {
  assert.equal(initials('tribun_1905'), 'T1');
  assert.equal(initials('istanbul'), 'İS');
});
