import assert from 'node:assert/strict';
import { test } from 'node:test';

import { levelFor } from '../lib/badges';
import { mapsLink, tilesFor, worldPixel } from '../lib/maps';
import { parseCoords, parseDateTime, suggestFromKickoff, validateMeetup } from '../lib/meetups';
import { buildDemoMeetups, createDemoCommunityRepository } from '../services/community/demoCommunityRepository';
import type { MeetupForm } from '../types/community';

const NOW = new Date(2026, 8, 27, 12, 0).getTime();
const form = (patch: Partial<MeetupForm> = {}): MeetupForm => ({
  title: 'Derbi öncesi buluşma',
  description: '',
  date: '30.09.2026',
  time: '17:00',
  city: 'İstanbul',
  placeName: 'Metro çıkışı',
  address: '',
  location: '',
  capacity: '',
  matchId: null,
  ...patch,
});

test('date/time parsing rejects impossible values', () => {
  assert.equal(parseDateTime('30.09.2026', '17:00')?.getHours(), 17);
  assert.equal(parseDateTime('31.02.2026', '17:00'), null);
  assert.equal(parseDateTime('30.09.2026', '25:00'), null);
  assert.equal(parseDateTime('2026-09-30', '17:00'), null);
});

test('coordinates from plain text and map links', () => {
  assert.deepEqual(parseCoords('41.0082, 28.9784'), { lat: 41.0082, lng: 28.9784 });
  assert.deepEqual(parseCoords('https://www.google.com/maps/place/X/@41.1036,28.9908,17z'), { lat: 41.1036, lng: 28.9908 });
  assert.deepEqual(parseCoords('https://maps.apple.com/?ll=38.4369,27.1437&q=Alsancak'), { lat: 38.4369, lng: 27.1437 });
  assert.equal(parseCoords('Kadıköy iskelesi'), null);
  assert.equal(parseCoords('95.0, 10.0'), null);
});

test('meetup validation', () => {
  const ok = validateMeetup(form({ location: '41.0, 29.0', capacity: '40' }), NOW);
  assert.ok(ok.input);
  assert.equal(ok.input!.capacity, 40);
  assert.equal(ok.input!.lat, 41);
  const past = validateMeetup(form({ date: '26.09.2026' }), NOW);
  assert.equal(past.input, null);
  assert.match(past.errors.date!, /10 dakika/);
  const bad = validateMeetup(form({ title: 'x', city: '', placeName: '', capacity: '1', location: 'bir yer' }), NOW);
  assert.deepEqual(Object.keys(bad.errors).sort(), ['capacity', 'city', 'location', 'placeName', 'title']);
});

test('suggested meet-up time is 3 hours before kickoff', () => {
  const s = suggestFromKickoff(new Date(2026, 8, 30, 20, 0).toISOString());
  assert.deepEqual(s, { date: '30.09.2026', time: '17:00' });
});

test('levels grow with contribution', () => {
  assert.equal(levelFor(0, 0).level, 1);
  assert.equal(levelFor(10, 0).level, 2);
  assert.equal(levelFor(20, 10).level, 3);
  assert.ok(levelFor(5, 0).progress > 0 && levelFor(5, 0).progress < 1);
});

test('map tiles cover the viewport around the point', () => {
  const p = worldPixel(0, 0, 1);
  assert.deepEqual(p, { x: 256, y: 256 });
  const tiles = tilesFor(41.1036, 28.9908, 15, 400, 180, 'https://t/{z}/{x}/{y}.png');
  assert.ok(tiles.length >= 2 && tiles.length <= 9);
  for (const t of tiles) {
    assert.match(t.url, /^https:\/\/t\/15\/\d+\/\d+\.png$/);
    assert.ok(t.left > -256 && t.left < 400 && t.top > -256 && t.top < 180);
  }
  assert.match(mapsLink(41, 29, 'Buluşma', 'ios'), /^https:\/\/maps\.apple\.com/);
  assert.match(mapsLink(41, 29, 'Buluşma', 'android'), /^geo:41,29/);
});

test('demo community: follows, attendance rules, cancel, create', async () => {
  const now = Date.now();
  const repo = createDemoCommunityRepository(buildDemoMeetups(now), () => now);
  assert.equal(await repo.setFollow('user', 'taktikdefteri', true), true);
  const p = await repo.getProfileExtras('taktikdefteri');
  assert.equal(p!.isFollowing, true);
  assert.ok(p!.badges.some((b) => b.id === 'taktikci'));
  await assert.rejects(() => repo.setFollow('user', 'misafir_taraftar', true), /Kendini/);
  await repo.setFollow('category', 'transfer', true);
  assert.deepEqual((await repo.getMyFollows()).categories, ['transfer']);

  const list = await repo.listMeetups();
  assert.equal(list.length, 3);
  assert.equal((await repo.listMeetups('izmir')).length, 1);
  assert.equal(await repo.setAttendance('bm-izmir', true), 3);
  assert.equal(await repo.setAttendance('bm-izmir', true), 3, 'idempotent');
  assert.equal(await repo.setAttendance('bm-izmir', false), 2);

  const { id } = await repo.createMeetup({
    title: 'Test buluşması', description: '', startsAt: new Date(now + 2 * 86_400_000).toISOString(),
    city: 'Bursa', placeName: 'Meydan', address: '', lat: null, lng: null, capacity: 2, matchId: null,
  });
  await assert.rejects(() => repo.setAttendance(id, false), /Düzenleyen/);
  await repo.cancelMeetup(id);
  assert.equal((await repo.listMeetups('Bursa')).length, 0);
  await assert.rejects(() => repo.cancelMeetup('bm-ankara'), /Yalnızca düzenleyen/);
});
