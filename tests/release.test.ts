import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

import { isLegalSlug, LEGAL_PAGES, legalPage } from '../lib/legal';

const root = new URL('../', import.meta.url);
const read = (p: string) => readFileSync(new URL(p, root), 'utf8');

// ---------------------------------------------------------------- colour contrast (WCAG 2.1 AA)
type RGB = [number, number, number];
const hex = (h: string): RGB => [0, 2, 4].map((i) => parseInt(h.replace('#', '').slice(i, i + 2), 16)) as RGB;
const blend = (fg: RGB, a: number, bg: RGB): RGB => fg.map((f, i) => Math.round(f * a + bg[i]! * (1 - a))) as RGB;
const luminance = (c: RGB) => {
  const [r, g, b] = c.map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  }) as RGB;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: RGB, b: RGB) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
};

test('text colours meet WCAG AA (4.5:1) on the app background and surfaces', () => {
  const theme = read('constants/theme.ts');
  const token = (name: string) => {
    const m = new RegExp(`\\b${name}: '([^']+)'`).exec(theme);
    assert.ok(m, `token ${name}`);
    return m![1]!;
  };
  const rgba = (v: string, bg: RGB): RGB => {
    if (v.startsWith('#')) return hex(v);
    const [r, g, b, a] = v.match(/[\d.]+/g)!.map(Number) as [number, number, number, number];
    return blend([r, g, b], a, bg);
  };
  const bg = hex(token('bg'));
  const surface = rgba(token('surface'), bg);
  for (const name of ['text', 'textMuted', 'textSubtle', 'gold', 'goldSoft', 'danger', 'success']) {
    for (const [label, base] of [['bg', bg], ['surface', surface]] as const) {
      const ratio = contrast(rgba(token(name), base), base);
      assert.ok(ratio >= 4.5, `${name} on ${label}: ${ratio.toFixed(2)}`);
    }
  }
  assert.ok(contrast(hex(token('textOnGold')), hex(token('gold'))) >= 4.5, 'text on gold buttons');
});

// ---------------------------------------------------------------- app config
test('app config is ready for store builds', () => {
  const app = JSON.parse(read('app.json')).expo;
  const pkg = JSON.parse(read('package.json'));
  assert.match(app.version, /^\d+\.\d+\.\d+$/);
  assert.equal(app.version, pkg.version, 'app.json and package.json versions match');
  assert.equal(app.scheme, 'galaforum', 'auth deep links use galaforum://');
  assert.match(app.ios.bundleIdentifier, /^[a-z0-9.]+$/);
  assert.equal(app.ios.bundleIdentifier, app.android.package);
  assert.ok(Number(app.ios.buildNumber) >= 1 && app.android.versionCode >= 1);
  for (const f of [app.icon, app.android.adaptiveIcon.foregroundImage, app.web.favicon]) {
    assert.ok(existsSync(new URL(f.replace('./', ''), root)), `${f} exists`);
  }
  const eas = JSON.parse(read('eas.json'));
  assert.ok(eas.build.production && eas.build.preview);
});

test('no secrets or service-role keys in the client config', () => {
  const example = read('.env.example');
  assert.ok(!/service_role|SERVICE_ROLE_KEY=/.test(example.split('\n').filter((l) => !l.startsWith('#')).join('\n')));
  const env = read('lib/env.ts');
  assert.ok(!/SERVICE_ROLE/i.test(env.replace(/\/\*[\s\S]*?\*\//g, '')), 'only EXPO_PUBLIC_* values in lib/env.ts');
});

// ---------------------------------------------------------------- migrations
test('migrations are ordered and additive', () => {
  const files = readdirSync(new URL('supabase/migrations/', root)).filter((f) => f.endsWith('.sql')).sort();
  assert.ok(files.length >= 8);
  const stamps = files.map((f) => f.slice(0, 14));
  assert.deepEqual([...stamps].sort(), stamps);
  assert.equal(new Set(stamps).size, stamps.length, 'unique timestamps');
  for (const f of files.slice(1)) {
    const sql = read(`supabase/migrations/${f}`);
    assert.ok(!/\bdrop table\b/i.test(sql), `${f} must not drop tables`);
  }
});

// ---------------------------------------------------------------- legal pages
test('legal pages render with and without operator details', () => {
  assert.ok(isLegalSlug('gizlilik') && !isLegalSlug('x'));
  for (const { slug } of LEGAL_PAGES) {
    const bare = legalPage(slug, { operatorName: '', contactEmail: '' });
    assert.ok(bare.sections.length >= 5, slug);
    assert.ok(bare.sections.every((s) => s.paragraphs.every((p) => p.length > 20)));
    const text = JSON.stringify(bare);
    assert.ok(!/lorem|TODO|undefined/i.test(text), `${slug} has no placeholders`);
  }
  const filled = JSON.stringify(legalPage('gizlilik', { operatorName: 'Örnek Ltd.', contactEmail: 'kvkk@example.com' }));
  assert.ok(filled.includes('Örnek Ltd.') && filled.includes('kvkk@example.com'));
});
