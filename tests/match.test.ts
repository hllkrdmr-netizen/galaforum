import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  assignPlayer,
  changeFormation,
  countdown,
  eventMinuteLabel,
  FORMATIONS,
  lineupToText,
  matchTopicTitle,
  nextMatch,
  scoreLabel,
  statusLabel,
  validateLineup,
} from '../lib/match';
import { buildDemoMatches, createDemoMatchRepository, demoClock } from '../services/match/demoMatchRepository';
import type { Lineup } from '../types/match';

const full = (formation: Lineup['formation']): Lineup => ({
  matchId: null,
  formation,
  players: Object.fromEntries(FORMATIONS[formation].map((s, i) => [s.key, `Oyuncu ${i + 1}`])),
});

test('every formation has 11 unique slots inside the pitch', () => {
  for (const [name, slots] of Object.entries(FORMATIONS)) {
    assert.equal(slots.length, 11, name);
    assert.equal(new Set(slots.map((s) => s.key)).size, 11, name);
    assert.equal(slots.filter((s) => s.key === 'GK').length, 1, name);
    for (const s of slots) assert.ok(s.x >= 0 && s.x <= 100 && s.y >= 0 && s.y <= 100, `${name} ${s.key}`);
  }
});

test('lineup validation: complete, unique, sane names', () => {
  assert.equal(validateLineup(full('4-3-3')), null);
  assert.match(validateLineup({ matchId: null, formation: '4-3-3', players: {} })!, /11 pozisyon boş/);
  const dup = full('4-4-2');
  dup.players.ST1 = dup.players.GK;
  assert.match(validateLineup(dup)!, /iki kez/);
});

test('a player can only be in one slot; formation change keeps shared slots', () => {
  let l = assignPlayer({ matchId: null, formation: '4-2-3-1', players: {} }, 'ST', 'Forvet A');
  l = assignPlayer(l, 'AM', 'Forvet A');
  assert.deepEqual(l.players, { AM: 'Forvet A' });
  l = assignPlayer(l, 'GK', 'Kaleci B');
  const changed = changeFormation(l, '4-3-3');
  assert.deepEqual(changed.players, { GK: 'Kaleci B' }, 'AM does not exist in 4-3-3');
});

test('lineup text groups lines from defence to attack', () => {
  const text = lineupToText(full('4-4-2'), { homeTeam: 'Galatasaray', awayTeam: 'Rakip' });
  assert.match(text, /^Galatasaray – Rakip için ilk 11’im \(4-4-2\)/);
  assert.match(text, /Kaleci: Oyuncu 1/);
  assert.match(text, /Savunma: /);
  assert.match(text, /Hücum: /);
});

test('labels and countdown', () => {
  assert.equal(matchTopicTitle({ homeTeam: 'Galatasaray', awayTeam: 'Fenerbahçe' }), 'Galatasaray – Fenerbahçe | Canlı Maç Konusu');
  assert.equal(statusLabel({ status: 'live', minute: 67 }), "67'");
  assert.equal(statusLabel({ status: 'halftime', minute: 45 }), 'Devre arası');
  assert.equal(scoreLabel({ status: 'scheduled', homeScore: null, awayScore: null }), '–');
  assert.equal(scoreLabel({ status: 'finished', homeScore: 2, awayScore: 1 }), '2 – 1');
  assert.equal(eventMinuteLabel({ minute: 45, extraMinute: 2 }), "45+2'");
  const now = Date.UTC(2026, 8, 27, 12);
  const c = countdown(new Date(now + (2 * 86_400 + 3 * 3600 + 4 * 60 + 5) * 1000).toISOString(), now);
  assert.deepEqual(c, { days: 2, hours: 3, minutes: 4, seconds: 5, done: false });
  assert.equal(countdown(new Date(now - 1000).toISOString(), now).done, true);
});

test('demo clock: halves, break and full time', () => {
  const k = new Date(Date.UTC(2026, 8, 27, 18)).toISOString();
  const at = (min: number) => demoClock(k, Date.parse(k) + min * 60_000);
  assert.deepEqual(at(-5), { status: 'scheduled', minute: null });
  assert.deepEqual(at(10), { status: 'live', minute: 11 });
  assert.equal(at(50).status, 'halftime');
  assert.deepEqual(at(72), { status: 'live', minute: 56 });
  assert.equal(at(130).status, 'finished');
});

test('demo repository: live score follows events, next match, reactions and lineups', async () => {
  const now = Date.now();
  const repo = createDemoMatchRepository(buildDemoMatches(now), () => now);
  const list = await repo.listMatches();
  const live = list.find((m) => m.id === 'm-canli')!;
  assert.equal(live.status, 'live');
  assert.equal(`${live.homeScore}-${live.awayScore}`, '1-1');
  assert.equal(list.find((m) => m.id === 'm-gecen')!.homeScore, 2);
  assert.equal(nextMatch(list, now)?.id, 'm-deplasman');

  const detail = await repo.getMatch('m-canli');
  assert.ok(detail!.events.every((e) => e.minute <= 56));
  assert.equal(detail!.match.topicId, 't-mac-canli');

  const counts = await repo.react('m-canli', 'gol');
  assert.equal(counts.gol, 1);
  await assert.rejects(() => repo.react('m-canli', 'alkis'), /3 saniyede/);
  await assert.rejects(() => repo.react('m-deplasman', 'gol'), /maç sırasında/);

  await assert.rejects(() => repo.saveLineup({ matchId: 'm-deplasman', formation: '4-3-3', players: {} }));
  await repo.saveLineup({ ...full('3-4-3'), matchId: 'm-deplasman' });
  assert.equal((await repo.getMyLineup('m-deplasman'))?.formation, '3-4-3');
  assert.equal(await repo.getMyLineup(null), null);
});
