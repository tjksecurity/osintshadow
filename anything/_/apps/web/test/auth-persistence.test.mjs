import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { authCookieOptions } from '../src/__create/auth-cookie-options.js';
import NeonAdapter from '../__create/adapter.ts';

const web = new URL('../', import.meta.url);
const readSource = (path) => readFile(new URL(path, web), 'utf8');
const asModule = (source) => import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
const cookieModule = new URL('../src/__create/auth-cookie-options.js', import.meta.url).href;

async function isolated(run, env = {}) {
  const values = { AUTH_SECRET: 'synthetic-secret', AUTH_URL: undefined, APP_URL: undefined, NODE_ENV: 'production', ...env };
  const saved = Object.fromEntries(Object.keys(values).map((name) => [name, process.env[name]]));
  const previousFetch = globalThis.fetch;
  const previousError = console.error;
  for (const [name, value] of Object.entries(values)) {
    if (value === undefined) delete process.env[name]; else process.env[name] = value;
  }
  globalThis.fetch = async () => { throw new Error('Unexpected external request in auth persistence test.'); };
  console.error = () => {};
  try { await run(); }
  finally {
    for (const [name, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
    }
    globalThis.fetch = previousFetch;
    console.error = previousError;
  }
}

async function loadAuth(mocks) {
  const key = '__shadowtraceAuthPersistence_' + randomUUID();
  globalThis[key] = mocks;
  let text = await readSource('src/__create/@auth/create.js');
  text = text.replace("import { getToken } from '@auth/core/jwt';", `const getToken = globalThis[${JSON.stringify(key)}].getToken;`);
  text = text.replace("import { getContext } from 'hono/context-storage';", `const getContext = globalThis[${JSON.stringify(key)}].getContext;`);
  text = text.replace("'../auth-cookie-options.js'", JSON.stringify(cookieModule));
  try { return await asModule(text); } finally { delete globalThis[key]; }
}

async function loadToken(mocks) {
  const key = '__shadowtraceTokenPersistence_' + randomUUID();
  globalThis[key] = mocks;
  let text = await readSource('src/app/api/auth/token/route.js');
  text = text.replace("import { getToken } from '@auth/core/jwt';", `const getToken = globalThis[${JSON.stringify(key)}].getToken;`);
  text = text.replace("'../../../../__create/auth-cookie-options.js'", JSON.stringify(cookieModule));
  try { return await asModule(text); } finally { delete globalThis[key]; }
}

test('cookie selection uses trusted configuration or a secure production default', () => {
  assert.deepEqual(authCookieOptions({ NODE_ENV: 'production' }), { secureCookie: true });
  assert.deepEqual(authCookieOptions({ NODE_ENV: 'development' }), { secureCookie: false });
  assert.deepEqual(authCookieOptions({ AUTH_URL: 'https://accounts.example.invalid/api/auth' }), { secureCookie: true });
  assert.deepEqual(authCookieOptions({ APP_URL: 'https://app.example.invalid' }), { secureCookie: true });
  assert.deepEqual(authCookieOptions({ NODE_ENV: 'development', AUTH_URL: 'http://127.0.0.1:3000' }), { secureCookie: false });
  for (const AUTH_URL of ['not-a-url', 'javascript:synthetic', 'https://user:secret@example.invalid', 'http://accounts.example.invalid']) {
    assert.equal(authCookieOptions({ NODE_ENV: 'production', AUTH_URL }), null);
  }
});

test('protected auth tolerates missing AUTH_URL without trusting request headers', () => isolated(async () => {
  const seen = [];
  const request = new Request('https://untrusted.example.invalid/api/investigations', { headers: { host: 'attacker.example.invalid', 'x-forwarded-proto': 'http' } });
  const { default: CreateAuth } = await loadAuth({ getContext: () => ({ req: { raw: request } }), getToken: async (options) => { seen.push(options); return null; } });
  assert.equal(await CreateAuth().auth(), undefined);
  assert.equal(seen.length, 1);
  assert.equal(seen[0].secureCookie, true);
  assert.equal(seen[0].req, request);
}));

test('protected auth rejects invalid configured cookie origins before decoding', () => isolated(async () => {
  let calls = 0;
  const { default: CreateAuth } = await loadAuth({ getContext: () => { throw new Error('Unexpected context lookup.'); }, getToken: async () => { calls++; } });
  assert.equal(await CreateAuth().auth(), undefined);
  assert.equal(calls, 0);
}, { AUTH_URL: 'invalid-config' }));

test('protected auth rejects missing secrets before context or token access', () => isolated(async () => {
  const { default: CreateAuth } = await loadAuth({ getContext: () => { throw new Error('Unexpected context lookup.'); }, getToken: async () => { throw new Error('Unexpected token decoding.'); } });
  assert.equal(await CreateAuth().auth(), undefined);
}, { AUTH_SECRET: undefined }));

test('protected auth preserves validated session shape and configured secure cookie name', () => isolated(async () => {
  const { default: CreateAuth } = await loadAuth({
    getContext: () => ({ req: { raw: new Request('https://app.example.invalid/') } }),
    getToken: async (options) => { assert.equal(options.secureCookie, true); return { sub: 'user-fixture', email: 'synthetic@example.invalid', name: 'Synthetic', exp: 123 }; },
  });
  assert.deepEqual(await CreateAuth().auth(), { user: { id: 'user-fixture', email: 'synthetic@example.invalid', name: 'Synthetic', image: undefined }, expires: '123' });
}, { AUTH_URL: 'https://accounts.example.invalid/api/auth' }));

test('token endpoint preserves its response and never caches the live session token', () => isolated(async () => {
  const optionsSeen = [];
  const { GET } = await loadToken({ getToken: async (options) => { optionsSeen.push(options); return options.raw ? 'synthetic-jwt' : { sub: 'user-fixture', email: 'synthetic@example.invalid', name: 'Synthetic' }; } });
  const response = await GET(new Request('https://untrusted.example.invalid/api/auth/token'));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.deepEqual(await response.json(), { jwt: 'synthetic-jwt', user: { id: 'user-fixture', email: 'synthetic@example.invalid', name: 'Synthetic' } });
  assert.equal(optionsSeen.length, 2);
  assert.ok(optionsSeen.every((options) => options.secureCookie));
}));

test('token endpoint fails closed for missing secrets, invalid config and decode failures', () => isolated(async () => {
  let calls = 0;
  const { GET } = await loadToken({ getToken: async () => { calls++; throw new Error('Synthetic invalid token.'); } });
  const request = new Request('https://example.invalid/api/auth/token');
  delete process.env.AUTH_SECRET;
  assert.equal((await GET(request)).status, 401);
  assert.equal(calls, 0);
  process.env.AUTH_SECRET = 'synthetic-secret';
  process.env.AUTH_URL = 'invalid-config';
  assert.equal((await GET(request)).status, 401);
  assert.equal(calls, 0);
  delete process.env.AUTH_URL;
  const response = await GET(request);
  assert.equal(response.status, 401);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.deepEqual(await response.json(), { error: 'Unauthorized' });
}));

async function signupAuthorize(adapter, hash) {
  const source = await readSource('__create/index.ts');
  const provider = source.indexOf("id: 'credentials-signup'");
  const start = source.indexOf('async (credentials) => {', provider);
  assert.ok(provider >= 0 && start > provider);
  const open = source.indexOf('{', start);
  let depth = 1;
  let end = open + 1;
  while (depth && end < source.length) {
    if (source[end] === '{') depth++;
    if (source[end] === '}') depth--;
    end++;
  }
  return new Function('adapter', 'hash', 'crypto', 'return (' + source.slice(start, end) + ');')(adapter, hash, { randomUUID });
}

test('signup hashes before its single atomic credential-account operation', async () => {
  const events = [];
  const expected = { id: 'synthetic-user', email: 'synthetic@example.invalid' };
  const authorize = await signupAuthorize({ getUserByEmail: async () => null, createCredentialsUser: async (user, passwordHash) => {
    events.push('persist'); assert.equal(user.email, expected.email); assert.equal(passwordHash, 'synthetic-hash'); return expected;
  } }, async () => { events.push('hash'); return 'synthetic-hash'; });
  assert.equal(await authorize({ email: expected.email, password: 'synthetic-password' }), expected);
  assert.deepEqual(events, ['hash', 'persist']);
});

test('signup hash failure cannot persist a user, and existing users do not create credentials', async () => {
  let persisted = 0;
  const adapter = { getUserByEmail: async () => null, createCredentialsUser: async () => { persisted++; } };
  const authorize = await signupAuthorize(adapter, async () => { throw new Error('Synthetic hash failure.'); });
  await assert.rejects(authorize({ email: 'synthetic@example.invalid', password: 'synthetic-password' }), /Synthetic hash failure/);
  assert.equal(persisted, 0);
  adapter.getUserByEmail = async () => ({ id: 'existing-user' });
  assert.equal(await authorize({ email: 'synthetic@example.invalid', password: 'synthetic-password' }), null);
  assert.equal(persisted, 0);
});

test('credentials adapter issues one statement joining the inserted user and account', async () => {
  const calls = [];
  const expected = { id: 'synthetic-user', email: 'synthetic@example.invalid' };
  const adapter = NeonAdapter({ query: async (query, params) => { calls.push({ query, params }); return { rows: [expected] }; } });
  assert.equal(await adapter.createCredentialsUser({ email: expected.email, emailVerified: null, name: 'Synthetic', image: null }, 'synthetic-hash'), expected);
  assert.equal(calls.length, 1);
  assert.match(calls[0].query, /WITH created_user AS/);
  assert.match(calls[0].query, /INSERT INTO auth_users/);
  assert.match(calls[0].query, /INSERT INTO auth_accounts/);
  assert.match(calls[0].query, /FROM created_user/);
  assert.deepEqual(calls[0].params, ['Synthetic', expected.email, null, null, 'synthetic-hash']);
});

test('credentials adapter propagates atomic statement failures without fallback inserts', async () => {
  let calls = 0;
  const adapter = NeonAdapter({ query: async () => { calls++; throw new Error('Synthetic account constraint failure.'); } });
  await assert.rejects(adapter.createCredentialsUser({ email: 'synthetic@example.invalid', emailVerified: null }, 'synthetic-hash'), /Synthetic account constraint failure/);
  assert.equal(calls, 1);
});

async function resetHarness({ expires = false, expireDuringHash = false, userExists = true, accountExists = true, failWrite = false, failHash = false } = {}) {
  const state = { valid: true, password: 'old-synthetic-hash', writes: 0, calls: 0, reads: 0, hashes: 0, inserts: 0, events: [] };
  let expired = expires;
  const key = '__shadowtraceResetPersistence_' + randomUUID();
  globalThis[key] = {
    argon2: { hash: async () => { state.hashes++; state.events.push('hash'); if (failHash) throw new Error('Synthetic hash failure.'); if (expireDuringHash) expired = true; return 'new-synthetic-hash'; } },
    sql: async (query, params) => {
      const eligible = state.valid && !expired && params[0] === 'synthetic@example.invalid' && params[1] === 'synthetic-token';
      if (query.startsWith('SELECT EXISTS')) {
        state.reads++; state.events.push('preflight');
        return [{ token_exists: eligible, user_exists: userExists }];
      }
      state.calls++; state.events.push('statement');
      assert.match(query, /WITH candidate AS MATERIALIZED/);
      assert.match(query, /claimed AS \(\s*DELETE FROM auth_verification_token/);
      assert.match(query, /expires > NOW\(\)/);
      assert.match(query, /UPDATE auth_accounts/);
      assert.match(query, /INSERT INTO auth_accounts/);
      assert.match(query, /EXISTS \(SELECT 1 FROM claimed\)/);
      if (eligible && userExists && failWrite) throw new Error('Synthetic statement failure; mutation rolled back.');
      if (eligible && userExists) {
        state.valid = false; state.password = params[2]; state.writes++; if (!accountExists) state.inserts++;
      }
      return [{ token_exists: eligible, user_exists: userExists, token_claimed: eligible && userExists, password_updated: eligible && userExists }];
    },
  };
  let source = await readSource('src/app/api/auth/password/reset/route.js');
  source = source.replace('import sql from "@/app/api/utils/sql";', `const sql = globalThis[${JSON.stringify(key)}].sql;`);
  source = source.replace('import argon2 from "argon2";', `const argon2 = globalThis[${JSON.stringify(key)}].argon2;`);
  try {
    const { POST } = await asModule(source);
    return { state, post: (overrides = {}) => POST(new Request('https://example.invalid/api/auth/password/reset', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'synthetic@example.invalid', token: 'synthetic-token', password: 'synthetic-password-123', ...overrides }),
    })) };
  } finally { delete globalThis[key]; }
}

test('reset hashes before one mutation and a consumed synthetic token cannot reset twice', () => isolated(async () => {
  const h = await resetHarness();
  assert.equal((await h.post()).status, 200);
  assert.equal((await h.post()).status, 400);
  assert.equal(h.state.writes, 1);
  assert.equal(h.state.password, 'new-synthetic-hash');
  assert.equal(h.state.valid, false);
  assert.deepEqual(h.state.events, ['preflight', 'hash', 'statement', 'preflight']);
}));

test('reset statement failure preserves modeled token and password for a later retry', () => isolated(async () => {
  const h = await resetHarness({ failWrite: true });
  assert.equal((await h.post()).status, 500);
  assert.equal(h.state.calls, 1);
  assert.equal(h.state.writes, 0);
  assert.equal(h.state.valid, true);
  assert.equal(h.state.password, 'old-synthetic-hash');
}));

test('reset hash failure and malformed input never reach the mutation', () => isolated(async () => {
  const h = await resetHarness({ failHash: true });
  assert.equal((await h.post()).status, 500);
  assert.equal(h.state.calls, 0);
  assert.equal((await h.post({ password: 'short' })).status, 400);
  assert.equal(h.state.calls, 0);
}));

test('reset rejects expired/wrong tokens and unknown users without modeled writes', () => isolated(async () => {
  for (const options of [{ expires: true }, { userExists: false }, {}]) {
    const h = await resetHarness(options);
    const response = await h.post(options.expires || options.userExists === false ? {} : { token: 'wrong-synthetic-token' });
    assert.equal(response.status, 400);
    assert.equal(h.state.writes, 0);
    assert.equal(h.state.valid, true);
    assert.equal(h.state.hashes, 0);
  }
}));

test('reset creates a missing credentials row only for the claimed token', () => isolated(async () => {
  const h = await resetHarness({ accountExists: false });
  assert.equal((await h.post()).status, 200);
  assert.equal((await h.post()).status, 400);
  assert.equal(h.state.inserts, 1);
}));

test('reset rechecks token expiry after hashing rather than trusting its preflight', () => isolated(async () => {
  const h = await resetHarness({ expireDuringHash: true });
  assert.equal((await h.post()).status, 400);
  assert.equal(h.state.hashes, 1);
  assert.equal(h.state.calls, 1);
  assert.equal(h.state.writes, 0);
  assert.equal(h.state.valid, true);
}));

test('two concurrent modeled reset claims permit only one password write', () => isolated(async () => {
  // This serializes modeled atomic statements; it is not a PostgreSQL race test.
  const h = await resetHarness();
  const responses = await Promise.all([h.post(), h.post()]);
  assert.deepEqual(responses.map((response) => response.status).sort(), [200, 400]);
  assert.equal(h.state.writes, 1);
}));
