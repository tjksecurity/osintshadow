import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { Auth, skipCSRFCheck } from '@auth/core';
import Credentials from '@auth/core/providers/credentials';

// Exercise real Auth.js with the application's actual configuration. Only
// persistence and password hashing are synthetic; no provider/database is used.
const source = await readFile(new URL('../__create/index.ts', import.meta.url), 'utf8');
const configSource = source.match(/initAuthConfig\(\(\) => \(([\s\S]*?)\)\)\s*\n\s*\);/)?.[1];
assert.ok(configSource, 'The server auth configuration must remain bound to this regression.');
const previousFetch = globalThis.fetch;
globalThis.fetch = async () => { throw new Error('External requests are forbidden in CSRF regressions.'); };
after(() => { globalThis.fetch = previousFetch; });
const origin = 'https://shadowtrace.example.invalid';

function fixture({ signup = false } = {}) {
  const calls = { lookup: 0, verify: 0, create: 0 };
  const errors = [];
  const config = runInNewContext(`(${configSource})`, {
    process: { env: { AUTH_SECRET: 'synthetic-csrf-secret-for-isolated-tests-only' } },
    Credentials,
    // Keep the old symbol available so a regression reintroducing the bypass
    // fails behavioral assertions instead of merely failing configuration load.
    skipCSRFCheck,
    adapter: {
      async getUserByEmail() {
        calls.lookup++;
        return signup ? null : { id: 'synthetic-user', email: 'synthetic@example.invalid', accounts: [{ provider: 'credentials', password: 'synthetic-hash' }] };
      },
      async createCredentialsUser() { calls.create++; return { id: 'synthetic-user', email: 'synthetic@example.invalid' }; },
    },
    verify: async () => { calls.verify++; return true; },
    hash: async () => 'synthetic-hash',
  });
  config.trustHost = true;
  config.logger = { error: (error) => errors.push(error.type), warn() {}, debug() {} };
  const request = (path, options) => Auth(new Request(`${origin}/api/auth/${path}`, options), config);
  return { calls, errors, config, request };
}

async function tokenPair(app) {
  const response = await app.request('csrf');
  assert.equal(response.status, 200, 'Auth.js must serve its CSRF endpoint, not disable it.');
  const { csrfToken } = await response.json();
  assert.equal(typeof csrfToken, 'string');
  assert.ok(csrfToken.length > 0);
  const cookies = response.headers.getSetCookie();
  const csrfCookie = cookies.find((value) => value.startsWith('__Host-authjs.csrf-token='));
  assert.ok(csrfCookie, 'A secure CSRF cookie must accompany the token.');
  assert.match(csrfCookie, /; HttpOnly/i);
  assert.match(csrfCookie, /; Secure/i);
  return { csrfToken, cookie: cookies.map((value) => value.split(';')[0]).join('; ') };
}

async function submit(app, path, pair = {}) {
  const response = await app.request(path, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', 'X-Auth-Return-Redirect': '1', ...(pair.cookie ? { cookie: pair.cookie } : {}) },
    body: new URLSearchParams({ email: 'synthetic@example.invalid', password: 'synthetic-password', callbackUrl: origin, ...(pair.csrfToken ? { csrfToken: pair.csrfToken } : {}) }),
  });
  const body = await response.json();
  return { response, destination: new URL(body.url) };
}

test('actual server configuration enables Auth.js CSRF protection', async () => {
  const app = fixture();
  assert.equal(app.config.skipCSRFCheck, undefined);
  await tokenPair(app);
  assert.deepEqual(app.calls, { lookup: 0, verify: 0, create: 0 });
});

for (const provider of ['credentials-signin', 'credentials-signup']) {
  for (const scenario of ['missing-both', 'missing-cookie', 'missing-token', 'mismatched-token', 'tampered-cookie']) {
    test(`${provider} rejects ${scenario} before any synthetic persistence`, async () => {
      const app = fixture({ signup: provider === 'credentials-signup' });
      const valid = await tokenPair(app);
      const pair = {
        'missing-both': {},
        'missing-cookie': { csrfToken: valid.csrfToken },
        'missing-token': { cookie: valid.cookie },
        'mismatched-token': { ...valid, csrfToken: 'not-the-issued-token' },
        'tampered-cookie': { ...valid, cookie: '__Host-authjs.csrf-token=forged' },
      }[scenario];
      const { destination } = await submit(app, `callback/${provider}`, pair);
      assert.equal(destination.searchParams.get('error'), 'MissingCSRF');
      assert.ok(app.errors.includes('MissingCSRF'));
      assert.deepEqual(app.calls, { lookup: 0, verify: 0, create: 0 });
    });
  }

  test(`${provider} accepts a matching issued cookie-token pair`, async () => {
    const signup = provider === 'credentials-signup';
    const app = fixture({ signup });
    const { response, destination } = await submit(app, `callback/${provider}`, await tokenPair(app));
    assert.equal(destination.origin, origin);
    assert.equal(destination.searchParams.get('error'), null);
    assert.deepEqual(app.errors, []);
    assert.deepEqual(app.calls, { lookup: 1, verify: signup ? 0 : 1, create: signup ? 1 : 0 });
    assert.ok(response.headers.getSetCookie().some((cookie) => /^__Secure-authjs\.session-token=[^;]/.test(cookie)));
  });
}

test('sign-out rejects missing CSRF and accepts the matching pair', async () => {
  const rejected = fixture();
  const { destination } = await submit(rejected, 'signout');
  assert.equal(destination.searchParams.get('error'), 'MissingCSRF');
  assert.deepEqual(rejected.calls, { lookup: 0, verify: 0, create: 0 });
  const accepted = fixture();
  const pair = await tokenPair(accepted);
  const signedIn = await submit(accepted, 'callback/credentials-signin', pair);
  const sessionCookies = signedIn.response.headers.getSetCookie()
    .filter((cookie) => cookie.startsWith('__Secure-authjs.session-token='))
    .map((cookie) => cookie.split(';')[0]);
  assert.ok(sessionCookies.length > 0);
  const result = await submit(accepted, 'signout', {
    ...pair, cookie: [pair.cookie, ...sessionCookies].join('; '),
  });
  assert.equal(result.destination.searchParams.get('error'), null);
  assert.deepEqual(accepted.errors, []);
  assert.ok(result.response.headers.getSetCookie().some((cookie) => cookie.startsWith('__Secure-authjs.session-token=;')));
});

test('React client alias continues using the Auth.js cookie-token flow', async () => {
  const vite = await readFile(new URL('../vite.config.ts', import.meta.url), 'utf8');
  assert.match(vite, /'@auth\/create\/react':\s*'@hono\/auth-js\/react'/);
});
