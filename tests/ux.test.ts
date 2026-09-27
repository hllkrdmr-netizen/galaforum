import assert from 'node:assert/strict';
import { test } from 'node:test';

import { formatPostTime } from '../lib/format';

const NOW = new Date(2026, 8, 27, 18, 0, 0).getTime();
const at = (d: Date) => d.toISOString();

test('post time is a single compact label', () => {
  assert.equal(formatPostTime(at(new Date(NOW - 30_000)), NOW), 'az önce');
  assert.equal(formatPostTime(at(new Date(NOW - 14 * 60_000)), NOW), '14 dk önce');
  assert.equal(formatPostTime(at(new Date(NOW - 3 * 3_600_000)), NOW), '3 sa önce');
  assert.equal(formatPostTime(at(new Date(2026, 8, 26, 16, 23)), NOW), 'dün 16:23');
  assert.equal(formatPostTime(at(new Date(NOW - 4 * 86_400_000)), NOW), '4 gün önce');
  assert.equal(formatPostTime(at(new Date(2026, 7, 2, 9, 5)), NOW), '2 Ağu 09:05');
  assert.equal(formatPostTime('bozuk', NOW), '');
});
