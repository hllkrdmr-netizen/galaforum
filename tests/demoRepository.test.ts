import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildDemoState, createDemoRepository } from '../services/forum/demoRepository';

test('categories expose stats for all 12 categories', async () => {
  const repo = createDemoRepository(buildDemoState());
  const cats = await repo.getCategories();
  assert.equal(cats.length, 12);
  const taktik = cats.find((c) => c.slug === 'mac-taktik')!;
  assert.equal(taktik.stats.topicCount, 2);
  assert.ok(taktik.stats.postCount >= taktik.stats.topicCount);
  assert.ok(taktik.stats.lastTopic);
});

test('latest post is the newest post, not merely the newest topic', async () => {
  const state = buildDemoState();
  const repo = createDemoRepository(state);
  const latest = await repo.getLatestPost();
  const newest = [...state.posts].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  assert.equal(latest?.post.id, newest.id);
  assert.equal(latest?.topic.id, newest.topicId);
  assert.equal(latest?.post.isOpeningPost, false);
});

test('search covers titles, post content, categories and users', async () => {
  const repo = createDemoRepository(buildDemoState());
  const byTitle = await repo.search('pivot');
  assert.ok(byTitle.topics.some((t) => t.id === 't-cift-pivot'));
  const byBody = await repo.search('Kopenhag final');
  assert.ok(byBody.posts.some((p) => p.topic.id === 't-2000'));
  assert.ok((await repo.search('basketbol')).categories.some((c) => c.slug === 'basketbol'));
  assert.ok((await repo.search('tribun')).users.some((u) => u.username === 'tribun_1905'));
  assert.equal((await repo.search('a')).topics.length, 0);
});

test('category topics put pinned first and paginate', async () => {
  const repo = createDemoRepository(buildDemoState());
  const page = await repo.getCategoryTopics('transfer', 0, 1);
  assert.equal(page.items[0].isPinned, true);
  assert.equal(page.nextCursor, 1);
  await assert.rejects(() => repo.getCategoryTopics('yok-boyle-kategori'));
});

test('createTopic validates input and becomes the latest post', async () => {
  const repo = createDemoRepository(buildDemoState());
  await assert.rejects(() => repo.createTopic({ categorySlug: 'transfer', title: 'kıs', body: 'kısa' }));
  const { id } = await repo.createTopic({
    categorySlug: 'basketbol',
    title: 'Yeni sezon basketbol beklentileri',
    body: 'Bu sezon Avrupa’da nereye kadar gidebiliriz?',
  });
  const topic = await repo.getTopic(id);
  assert.equal(topic?.posts.length, 1);
  assert.equal(topic?.posts[0].isOpeningPost, true);
  const latest = await repo.getLatestPost();
  assert.equal(latest?.topic.id, id);
  assert.equal(latest?.post.isOpeningPost, true);
});
