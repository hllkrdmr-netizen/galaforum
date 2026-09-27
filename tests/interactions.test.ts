import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildDemoState, createDemoRepository } from '../services/forum/demoRepository';
import { mentionNames, validatePoll } from '../lib/interactions';
import { createSupabaseRepository } from '../services/forum/supabaseRepository';
import type { TopicDetail } from '../types/forum';
import type { SupabaseClient } from '@supabase/supabase-js';

const input = { categorySlug: 'serbest', title: 'Phase three test topic', body: 'A sufficiently long opening message' };
test('replies update latest post, category totals and search; quotes and mentions resolve', async () => {
  const state = buildDemoState(); const repo = createDemoRepository(state);
  const { id } = await repo.createTopic(input);
  const opening = (await repo.getTopic(id))!.posts[0];
  const before = (await repo.getCategories()).find(c => c.slug === 'serbest')!.stats.postCount;
  const reply = await repo.reply({ topicId: id, body: 'Hello @tribun_1905 @tribun_1905 @unknown_user', quotePostId: opening.id });
  const topic = (await repo.getTopic(id))!;
  assert.equal(topic.replyCount, 1);
  assert.equal(topic.posts[1].quote?.id, opening.id);
  assert.deepEqual(topic.posts[1].mentions?.map(u => u.username), ['tribun_1905']);
  assert.equal((await repo.getLatestPost())?.post.id, reply.id);
  assert.equal((await repo.getCategories()).find(c => c.slug === 'serbest')!.stats.postCount, before + 1);
  assert.ok((await repo.search('Hello')).posts.some(p => p.post.id === reply.id));
});
test('reply validation rejects missing, locked and cross-topic quotes without mutation', async () => {
  const state = buildDemoState(); const repo = createDemoRepository(state);
  const a = await repo.createTopic(input); const b = await repo.createTopic(input);
  const quote = (await repo.getTopic(b.id))!.posts[0].id;
  for (const body of ['', ' '.repeat(10), 'x'.repeat(10001)]) await assert.rejects(repo.reply({ topicId: a.id, body }));
  await assert.rejects(repo.reply({ topicId: a.id, body: 'hello', quotePostId: quote }));
  await assert.rejects(repo.reply({ topicId: a.id, body: 'hello', quotePostId: 'missing' }));
  await assert.rejects(repo.reply({ topicId: 'missing', body: 'hello' }));
  state.topics.find(t => t.id === a.id)!.locked = true;
  await assert.rejects(repo.reply({ topicId: a.id, body: 'hello' }));
  assert.equal((await repo.getTopic(a.id))!.replyCount, 0);
});
test('paging handles tied timestamps and >200 posts without omissions', async () => {
  const state = buildDemoState(); const repo = createDemoRepository(state); const { id } = await repo.createTopic(input);
  for (let n = 0; n < 205; n++) await repo.reply({ topicId: id, body: `message ${n}` });
  state.posts.filter(p => p.topicId === id).forEach(p => { p.createdAt = '2026-09-27T00:00:00.000Z'; });
  const ids: string[] = []; let cursor: number | null = 0;
  while (cursor !== null) { const page: TopicDetail = (await repo.getTopic(id, cursor, 20))!; ids.push(...page.posts.map(p => p.id)); cursor = page.nextCursor; }
  assert.equal(ids.length, 206); assert.equal(new Set(ids).size, 206);
  assert.deepEqual((await repo.getTopic(id, 500))!.posts, []);
  for (const [offset, size] of [[-1, 20], [0, 0], [0, 101], [0.5, 20]]) await assert.rejects(repo.getTopic(id, offset, size));
});
test('likes are idempotent, reversible and isolated; reporting validates', async () => {
  const repo = createDemoRepository(); const { id } = await repo.createTopic(input);
  const p = (await repo.getTopic(id))!.posts[0].id;
  await repo.setLike(p, true); await repo.setLike(p, true);
  assert.equal((await repo.getTopic(id))!.posts[0].likeCount, 1);
  await repo.setLike(p, false); await repo.setLike(p, false);
  assert.equal((await repo.getTopic(id))!.posts[0].likedByMe, false);
  await assert.rejects(repo.setLike('missing', true));
  await assert.rejects(repo.report(p, 'bad'));
  await assert.rejects(repo.report(p, 'x'.repeat(1001)));
  await repo.report(p, 'Spam content'); await repo.report(p, 'Updated reason');
});
test('polls validate atomically; votes replace rather than accumulate and locks apply', async () => {
  const state = buildDemoState(); const repo = createDemoRepository(state);
  const count = state.topics.length;
  await assert.rejects(repo.createTopic({ ...input, poll: { question: 'Question', options: ['same', ' SAME '] } }));
  assert.equal(state.topics.length, count);
  const { id } = await repo.createTopic({ ...input, poll: { question: 'Who wins?', options: ['Home', 'Away'] } });
  const poll = (await repo.getPoll(id))!;
  await repo.vote(poll.id, poll.options[0].id); await repo.vote(poll.id, poll.options[0].id);
  await repo.vote(poll.id, poll.options[1].id);
  const result = (await repo.getPoll(id))!;
  assert.equal(result.totalVotes, 1); assert.deepEqual(result.options.map(o => o.votes), [0, 1]);
  assert.equal(result.myOptionId, poll.options[1].id);
  assert.equal(poll.totalVotes, 0, 'returned values are not mutable state references');
  await assert.rejects(repo.vote(poll.id, 'foreign-option'));
  state.topics.find(t => t.id === id)!.locked = true;
  await assert.rejects(repo.vote(poll.id, poll.options[0].id));
  assert.equal(await repo.getPoll('missing'), null);
});
test('mention parser ignores email addresses, overlong names and duplicates', () => {
  assert.deepEqual(mentionNames('mail@someone.com @ABC_123 @abc_123 @xy @abcdefghijklmnopqrstuvwxyz @@nested'), ['abc_123']);
  assert.throws(() => validatePoll({ question: 'ok?', options: ['a'] }));
});
test('Supabase mutations require auth and send bounded, server-owned RPC arguments', async () => {
  let signedIn = false;
  const calls: { name: string; args: unknown }[] = [];
  const sb = {
    auth: { getSession: async () => ({ data: { session: signedIn ? {} : null }, error: null }) },
    rpc: async (name: string, args: unknown) => { calls.push({ name, args }); return { data: 'new-id', error: null }; },
  } as unknown as SupabaseClient;
  const repo = createSupabaseRepository(sb);
  await assert.rejects(repo.reply({ topicId: 'topic', body: 'hello' }), { code: 'auth_required' });
  await assert.rejects(repo.setLike('post', true), { code: 'auth_required' });
  await assert.rejects(repo.vote('poll', 'option'), { code: 'auth_required' });
  await assert.rejects(repo.report('post', 'Spam content'), { code: 'auth_required' });
  assert.equal(calls.length, 0);
  signedIn = true;
  await repo.reply({ topicId: 'topic', body: ' hello ', quotePostId: 'quote' });
  assert.deepEqual(calls[0], { name: 'forum_reply', args: { p_topic_id: 'topic', p_body: 'hello', p_quote_id: 'quote' } });
  await repo.createTopic({ ...input, poll: { question: 'Who wins?', options: ['Home', 'Away'] } });
  assert.equal(calls[1].name, 'forum_create_topic');
});
