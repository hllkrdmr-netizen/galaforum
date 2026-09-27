import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  mapAuthError,
  parseAuthCallback,
  safeNextRoute,
  safeReturnPath,
  validateEmail,
  validatePassword,
  validateSignUp,
  validateUsername,
} from '../lib/auth/validation';

test('email validation', () => {
  assert.equal(validateEmail('taraftar@example.com'), null);
  assert.equal(validateEmail('  Taraftar@Example.COM '), null);
  assert.ok(validateEmail(''));
  assert.ok(validateEmail('yok@'));
  assert.ok(validateEmail('a b@example.com'));
});

test('password rules: length, letter and digit', () => {
  assert.equal(validatePassword('cimbom1905'), null);
  assert.ok(validatePassword('kisa1'));
  assert.ok(validatePassword('sadeceharf'));
  assert.ok(validatePassword('12345678'));
  assert.ok(validatePassword('a1'.repeat(40)));
});

test('username rules mirror the database constraint and reserve tombstones', () => {
  assert.equal(validateUsername('aslan_1905'), null);
  assert.equal(validateUsername('Aslan_1905'), null, 'normalised to lowercase');
  assert.ok(validateUsername('ab'));
  assert.ok(validateUsername('çimbom'));
  assert.ok(validateUsername('a'.repeat(25)));
  assert.ok(validateUsername('silinmis_abc'));
});

test('sign-up form collects every error', () => {
  const e = validateSignUp({ username: 'x', email: 'bad', password: 'short', passwordConfirm: 'other', acceptedTerms: false });
  assert.deepEqual(Object.keys(e).sort(), ['acceptedTerms', 'email', 'password', 'passwordConfirm', 'username']);
  assert.deepEqual(validateSignUp({ username: 'gs_1905', email: 'a@b.co', password: 'cimbom1905', passwordConfirm: 'cimbom1905', acceptedTerms: true }), {});
});

test('auth errors map to Turkish messages without leaking account existence', () => {
  assert.equal(mapAuthError({ code: 'invalid_credentials' }).code, 'invalid_credentials');
  assert.equal(mapAuthError({ message: 'Email not confirmed' }).code, 'email_not_confirmed');
  assert.equal(mapAuthError({ code: 'over_email_send_rate_limit' }).code, 'rate_limited');
  assert.equal(mapAuthError({ status: 429 }).code, 'rate_limited');
  assert.equal(mapAuthError({ message: 'Failed to fetch' }).code, 'network');
  assert.equal(mapAuthError({ code: 'user_already_exists' }).code, 'unknown');
  assert.equal(mapAuthError(null).code, 'unknown');
});

test('auth callback parsing handles PKCE query and implicit hash', () => {
  assert.deepEqual(parseAuthCallback('galaforum://auth-callback?code=abc&next=yeni-sifre'), { code: 'abc', next: 'yeni-sifre' });
  const implicit = parseAuthCallback('https://x.test/auth-callback#access_token=t1&refresh_token=r1&type=recovery');
  assert.equal(implicit.accessToken, 't1');
  assert.equal(implicit.refreshToken, 'r1');
  assert.equal(parseAuthCallback('https://x.test/auth-callback?error=access_denied&error_description=expired').errorDescription, 'expired');
});

test('redirect targets are restricted to in-app routes', () => {
  assert.equal(safeNextRoute('yeni-sifre'), '/yeni-sifre');
  assert.equal(safeNextRoute('https://evil.example'), '/hesap');
  assert.equal(safeReturnPath('/konu/t-1'), '/konu/t-1');
  assert.equal(safeReturnPath('//evil.example'), '/hesap');
  assert.equal(safeReturnPath('https://evil.example'), '/hesap');
  assert.equal(safeReturnPath('/giris'), '/hesap');
  assert.equal(safeReturnPath(undefined), '/hesap');
});
