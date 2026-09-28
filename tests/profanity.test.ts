import assert from 'node:assert/strict';
import { test } from 'node:test';

import { findProfanity, profanityWarning } from '../lib/profanity';

test('flags common Turkish profanity, including disguised spellings', () => {
  for (const text of ['amk ya', 'Siktir git', 's.i.k.t.i.r', 'siiiiktir', '0r0spu', 'orospuçocuğu', 'yavşak herif', 'göt', 'Şerefsiz adam', 'aq hakem', 'pezevenkler']) {
    assert.ok(findProfanity(text).length > 0, text);
  }
});

test('does not flag everyday football language', () => {
  for (const text of [
    'Sıkı savunma yaptık, orta sahada rakibi sıkıştırdık.',
    'Topu götürdü ve sık sık şut çekti.',
    'Got it, thanks',
    'Osmanlı sikkesi koleksiyonu',
    'Amatör ligden gelen oyuncu',
    'İbn-i Sina hastanesi',
    'Amino asit takviyesi',
    'Kulübün mal varlığı',
    'A B D turnesi',
    'Piccolo pas',
  ]) {
    assert.deepEqual(findProfanity(text), [], text);
  }
});

test('warning lists the words once', () => {
  const hits = findProfanity('amk amk siktir');
  assert.deepEqual(hits, ['amk', 'siktir']);
  assert.match(profanityWarning(hits), /“amk”, “siktir”/);
});
