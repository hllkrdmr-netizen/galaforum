import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { test } from 'node:test';

import { DEFAULT_CATEGORIES } from '../constants/categories';

const EXPECTED = [
  'Maç & Taktik',
  'Transfer',
  'Takım & Oyuncular',
  'Yönetim & Kulüp',
  'Avrupa',
  'Galatasaray Tarihi',
  'Maç Öncesi Buluşmalar',
  'Basketbol',
  'Diğer Branşlar',
  'Altyapı / Akademi',
  'Taraftar & Tribün',
  'Serbest',
];

test('exactly the 12 approved categories, in order', () => {
  assert.deepEqual(DEFAULT_CATEGORIES.map((c) => c.name), EXPECTED);
});

test('slugs are unique and URL-safe', () => {
  const slugs = DEFAULT_CATEGORIES.map((c) => c.slug);
  assert.equal(new Set(slugs).size, slugs.length);
  for (const s of slugs) assert.match(s, /^[a-z0-9-]+$/);
});

test('every category icon exists in the Ionicons glyph map', () => {
  const pkg = createRequire(import.meta.url).resolve('@expo/vector-icons/package.json');
  const glyphs = JSON.parse(
    readFileSync(join(dirname(pkg), 'build/vendor/react-native-vector-icons/glyphmaps/Ionicons.json'), 'utf8'),
  );
  for (const c of DEFAULT_CATEGORIES) assert.ok(c.icon in glyphs, `missing icon ${c.icon}`);
});

test('database seed matches the app category slugs', () => {
  const directory = new URL('../supabase/migrations/', import.meta.url);
  const sql = readdirSync(directory).filter(name => name.endsWith('.sql')).map(name => readFileSync(new URL(name, directory), 'utf8')).join('\n');
  for (const c of DEFAULT_CATEGORIES) assert.ok(sql.includes(`('${c.slug}', '${c.name}'`), `seed missing ${c.slug}`);
});
