import assert from 'node:assert/strict';
import { test } from 'node:test';

import { canSearch, sinceToDate } from '../lib/search';
import { buildDemoState, createDemoRepository } from '../services/forum/demoRepository';

test('canSearch: query length or author-only', () => {
  assert.equal(canSearch('a'), false);
  assert.equal(canSearch('ab'), true);
  assert.equal(canSearch('', { author: 'tribun_1905' }), true);
  assert.equal(canSearch('x'.repeat(101)), false);
});

test('sinceToDate', () => {
  const now = Date.UTC(2026, 8, 27);
  assert.equal(sinceToDate('all', now), null);
  assert.equal(sinceToDate(undefined, now), null);
  assert.equal(sinceToDate('24h', now)?.getTime(), now - 86_400_000);
});

test('category filter narrows topics and posts', async () => {
  const repo = createDemoRepository(buildDemoState());
  const all = await repo.search('derbi');
  const onlyTransfer = await repo.search('derbi', { category: 'transfer' });
  assert.ok(all.topics.length + all.posts.length > 0);
  assert.equal(onlyTransfer.topics.length, 0);
  assert.ok(onlyTransfer.posts.every((p) => p.category.slug === 'transfer'));
  assert.equal(onlyTransfer.categories.length, 0, 'category/user suggestions only for broad searches');
});

test('author-only search lists that member’s content', async () => {
  const repo = createDemoRepository(buildDemoState());
  const r = await repo.search('', { author: 'Kopenhag2000' });
  assert.ok(r.topics.length >= 1);
  assert.ok(r.topics.every((t) => t.author.username === 'kopenhag2000'));
  assert.ok(r.posts.every((p) => p.post.author.username === 'kopenhag2000'));
});

test('since filter excludes older activity', async () => {
  const repo = createDemoRepository(buildDemoState());
  const recent = await repo.search('', { author: 'galaforum_mod', since: '24h' });
  assert.equal(recent.posts.length, 0, 'moderator seed posts are older than 24h');
  const ever = await repo.search('', { author: 'galaforum_mod', since: 'all' });
  assert.ok(ever.posts.length >= 1);
});

test('sort by replies puts the busiest topic first', async () => {
  const repo = createDemoRepository(buildDemoState());
  const r = await repo.search('', { author: 'kopenhag2000', sort: 'replies' });
  for (let i = 1; i < r.topics.length; i++) assert.ok(r.topics[i - 1].replyCount >= r.topics[i].replyCount);
  const n = await repo.search('', { author: 'kopenhag2000', sort: 'newest' });
  for (let i = 1; i < n.posts.length; i++) assert.ok(n.posts[i - 1].post.createdAt >= n.posts[i].post.createdAt);
});

test('public profile summarises a member and hides unknown users', async () => {
  const repo = createDemoRepository(buildDemoState());
  const p = await repo.getProfile('TaktikDefteri');
  assert.ok(p);
  assert.equal(p!.author.username, 'taktikdefteri');
  assert.ok(p!.topicCount >= 1);
  assert.ok(p!.postCount >= p!.topicCount);
  assert.ok(p!.recentTopics.every((t) => t.title.length > 0));
  assert.equal(await repo.getProfile('boyle_biri_yok'), null);
});
