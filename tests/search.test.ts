import assert from 'node:assert/strict';
import { test } from 'node:test';

import { escapeLike, matchesAll, normalizeTr, queryTerms } from '../lib/search';

test('normalizeTr folds Turkish characters and case', () => {
  assert.equal(normalizeTr('DAİMA GALATASARAY'), 'daima galatasaray');
  assert.equal(normalizeTr('Şampiyonluk Ğ Ü Ö Ç ı'), 'sampiyonluk g u o c i');
});

test('matchesAll requires every term', () => {
  const terms = queryTerms('çift pivot');
  assert.ok(matchesAll('Derbilerde Çift Pivot mu?', terms));
  assert.ok(!matchesAll('Derbilerde tek pivot', terms));
  assert.ok(!matchesAll('anything', []));
});

test('escapeLike neutralises wildcards', () => {
  assert.equal(escapeLike('100%_a\\b'), '100\\%\\_a\\\\b');
});
