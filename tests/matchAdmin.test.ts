import assert from 'node:assert/strict';
import { test } from 'node:test';

import { applyMatchPatch, goalSide, milestoneEvent, validateMatchInput, validateNewEvent } from '../lib/match';
import { buildDemoMatches, createDemoMatchRepository } from '../services/match/demoMatchRepository';
import type { Match } from '../types/match';

const NOW = new Date(2026, 8, 28, 20, 0).getTime();
const base: Match = {
  id: 'm1', competition: 'Süper Lig', homeTeam: 'Galatasaray', awayTeam: 'Trabzonspor', kickoffAt: new Date(NOW).toISOString(),
  venue: 'RAMS Park', status: 'scheduled', minute: null, homeScore: null, awayScore: null, topicId: null,
};

test('status rules mirror the server', () => {
  const live = applyMatchPatch(base, { status: 'live' });
  assert.deepEqual([live.minute, live.homeScore, live.awayScore], [1, 0, 0]);
  const ht = applyMatchPatch({ ...live, minute: 44 }, { status: 'halftime' });
  assert.equal(ht.minute, 45);
  assert.equal(applyMatchPatch(ht, { status: 'live' }).minute, 46, 'second half starts at 46');
  assert.equal(applyMatchPatch(ht, { status: 'live', minute: 50 }).minute, 50);
  const ft = applyMatchPatch({ ...live, homeScore: 2 }, { status: 'finished' });
  assert.deepEqual([ft.minute, ft.homeScore], [null, 2]);
  const back = applyMatchPatch(ft, { status: 'postponed' });
  assert.deepEqual([back.minute, back.homeScore, back.awayScore], [null, null, null]);
  assert.deepEqual(milestoneEvent('scheduled', 'live', null), { type: 'kickoff', minute: 1 });
  assert.equal(milestoneEvent('halftime', 'live', 45), null);
  assert.deepEqual(milestoneEvent('live', 'finished', 93), { type: 'fulltime', minute: 93 });
});

test('goal sides: own goal counts for the other team', () => {
  assert.equal(goalSide('goal', 'home'), 'home');
  assert.equal(goalSide('penalty_goal', 'away'), 'away');
  assert.equal(goalSide('own_goal', 'home'), 'away');
  assert.equal(goalSide('penalty_miss', 'home'), null);
  assert.equal(goalSide('yellow', 'away'), null);
});

test('form validation', () => {
  const input = { competition: 'Süper Lig', homeTeam: 'Galatasaray', awayTeam: 'Fenerbahçe', kickoffAt: new Date(NOW).toISOString(), venue: '' };
  assert.equal(validateMatchInput(input), null);
  assert.ok(validateMatchInput({ ...input, awayTeam: ' galatasaray ' }));
  assert.ok(validateMatchInput({ ...input, kickoffAt: 'yarın' }));
  const ev = { minute: 23, extraMinute: null, type: 'goal' as const, side: 'home' as const, player: null, detail: null };
  assert.equal(validateNewEvent(ev), null);
  assert.ok(validateNewEvent({ ...ev, side: null }));
  assert.equal(validateNewEvent({ ...ev, type: 'var', side: null }), null, 'VAR needs no side');
  assert.ok(validateNewEvent({ ...ev, minute: 131 }));
  assert.ok(validateNewEvent({ ...ev, extraMinute: 0 }));
});

test('demo match administration: create, kick off, score, delete, finish', async () => {
  const repo = createDemoMatchRepository(buildDemoMatches(NOW), () => NOW);
  const { id } = await repo.createMatch({ competition: 'Türkiye Kupası', homeTeam: 'Galatasaray', awayTeam: 'Göztepe', kickoffAt: new Date(NOW + 3_600_000).toISOString(), venue: 'RAMS Park' });
  assert.ok((await repo.listMatches()).some((m) => m.id === id));
  await assert.rejects(repo.addEvent(id, { minute: 5, extraMinute: null, type: 'goal', side: 'home', player: null, detail: null }), /başlat/);

  await repo.updateMatch(id, { status: 'live' });
  const g = await repo.addEvent(id, { minute: 12, extraMinute: null, type: 'goal', side: 'home', player: 'Oyuncu A', detail: null });
  const og = await repo.addEvent(id, { minute: 30, extraMinute: null, type: 'own_goal', side: 'home', player: null, detail: null });
  let d = (await repo.getMatch(id))!;
  assert.deepEqual([d.match.homeScore, d.match.awayScore], [1, 1]);
  assert.equal(d.events[d.events.length - 1]!.type, 'kickoff', 'kickoff event added, newest first');

  await repo.deleteEvent(og.id);
  await repo.updateMatch(id, { status: 'finished' });
  d = (await repo.getMatch(id))!;
  assert.deepEqual([d.match.status, d.match.homeScore, d.match.awayScore], ['finished', 1, 0]);
  assert.equal(d.events[0]!.type, 'fulltime');
  assert.ok(d.events.some((e) => e.id === g.id));
  await assert.rejects(repo.deleteEvent('yok'));

  // A seeded, clock-driven match keeps its current state when a moderator takes over.
  const live = (await repo.getMatch('m-canli'))!;
  await repo.updateMatch('m-canli', { minute: 70 });
  const taken = (await repo.getMatch('m-canli'))!;
  assert.equal(taken.match.minute, 70);
  assert.equal(taken.match.homeScore, live.match.homeScore);
});
