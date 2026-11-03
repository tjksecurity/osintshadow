import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { classifyDeployment, EXPECTED_PROVIDER_IDS, probeDeployment, validateDeploymentUrl } from '../scripts/check-deployment.mjs';

const baseURL = 'https://preview.example.invalid';
const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'content-type': 'application/json' },
});
const providers = () => Object.fromEntries(EXPECTED_PROVIDER_IDS.map((id) => [id, { id, type: 'credentials' }]));
const healthy = () => ({
  '/': () => new Response('<html>synthetic shell</html>', { headers: { 'content-type': 'text/html' } }),
  '/api/auth/providers': () => json(providers()),
  '/api/auth/csrf': () => json({ csrfToken: 'synthetic-csrf-value-never-print' }),
  '/api/investigations': () => json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, 401),
  '/api/auth/session': () => json(null),
});
async function run(overrides = {}) {
  const responses = { ...healthy(), ...overrides };
  const requests = [];
  const result = await probeDeployment(baseURL, { fetchImpl: async (url, options) => {
    requests.push({ url: new URL(url), options });
    return responses[new URL(url).pathname]();
  } });
  return { result, requests };
}

test('homepage and a null session cannot pass when auth and protected APIs lack configuration', async () => {
  const result = await probeDeployment(baseURL, { fetchImpl: async (url) => {
    const path = new URL(url).pathname;
    if (path === '/') return new Response('<html>synthetic shell</html>', {
      headers: { 'content-type': 'text/html' },
    });
    if (path === '/api/auth/session') return json(null);
    if (path === '/api/investigations') return json({
      code: 'CONFIGURATION_REQUIRED', missing: ['DATABASE_URL', 'AUTH_SECRET'],
    }, 503);
    return json({ error: 'Authentication requires AUTH_SECRET and DATABASE_URL.' }, 503);
  } });
  assert.equal(result.preflightChecksPassed, false);
  assert.equal(result.operationalReady, false);
  assert.equal(result.authenticatedWorkflowVerified, false);
  assert.equal(result.databaseVerified, false);
  assert.equal(result.checks.homepage.passed, true);
  assert.equal(result.checks.session.passed, true);
  assert.equal(result.checks.providers.passed, false);
  assert.deepEqual(result.missingConfiguration, ['DATABASE_URL', 'AUTH_SECRET']);
});

test('successful signed-out preflight never claims login, database, or operational acceptance', async () => {
  const { result, requests } = await run();
  assert.equal(result.scope, 'deployment-preflight-only');
  assert.equal(result.preflightChecksPassed, true);
  assert.equal(result.authenticatedWorkflowVerified, false);
  assert.equal(result.databaseVerified, false);
  assert.equal(result.operationalReady, false);
  assert.equal(result.checks.csrf.tokenPresent, true);
  assert.deepEqual(result.missingConfiguration, []);
  assert.equal(requests.length, 5);
  for (const { url, options } of requests) {
    assert.equal(url.origin, baseURL);
    assert.equal(options.method, 'GET');
    assert.equal(options.credentials, 'omit');
    assert.equal(options.redirect, 'manual');
    assert.equal(options.cache, 'no-store');
    assert.ok(options.signal instanceof AbortSignal);
    assert.deepEqual(Object.keys(options.headers), ['accept']);
  }
  assert.match(result.remainingAcceptance.join(' '), /database.*schema/i);
  assert.match(result.remainingAcceptance.join(' '), /sign-in.*persisted/i);
  assert.ok(!JSON.stringify(result).includes('synthetic-csrf-value-never-print'));
});

test('auth discovery and CSRF success cannot hide a missing database configuration', async () => {
  const { result } = await run({ '/api/investigations': () => json({
    code: 'CONFIGURATION_REQUIRED', missing: ['DATABASE_URL'],
  }, 503) });
  assert.equal(result.checks.providers.passed, true);
  assert.equal(result.checks.csrf.passed, true);
  assert.equal(result.preflightChecksPassed, false);
  assert.deepEqual(result.missingConfiguration, ['DATABASE_URL']);
});

test('expected provider IDs remain bound to the original source configuration', async () => {
  const source = await readFile(new URL('../__create/index.ts', import.meta.url), 'utf8');
  const configured = [...source.matchAll(/id:\s*'(credentials-[^']+)'/g)].map((match) => match[1]);
  assert.deepEqual(EXPECTED_PROVIDER_IDS, configured);
});

test('both original providers require their actual ID and credentials type', async () => {
  for (const body of [{}, { 'credentials-signin': { id: 'credentials-signin', type: 'credentials' } },
    { ...providers(), 'credentials-signup': { id: 'different', type: 'credentials' } },
    { ...providers(), 'credentials-signup': { id: 'credentials-signup', type: 'oauth' } }]) {
    const { result } = await run({ '/api/auth/providers': () => json(body) });
    assert.equal(result.checks.providers.passed, false);
    assert.equal(result.preflightChecksPassed, false);
  }
});

test('CSRF requires a nonempty string, without disclosing the token value', async () => {
  for (const body of [{}, { csrfToken: null }, { csrfToken: 123 }, { csrfToken: '' }, { csrfToken: '   ' }]) {
    const { result } = await run({ '/api/auth/csrf': () => json(body) });
    assert.equal(result.checks.csrf.passed, false);
    assert.equal(result.checks.csrf.tokenPresent, false);
  }
});

test('an arbitrary infrastructure 401 is not the original protected-route boundary', async () => {
  const { result } = await run({ '/api/investigations': () => json({ error: 'Access denied' }, 401) });
  assert.equal(result.checks.investigations.reason, 'UNEXPECTED_RESPONSE');
  assert.equal(result.preflightChecksPassed, false);
});

test('unexpected protected API 200 is canceled without reading or storing rows', async () => {
  let canceled = false;
  let read = false;
  const { result } = await run({ '/api/investigations': () => ({
    status: 200, redirected: false, headers: new Headers({ 'content-type': 'application/json' }),
    body: { getReader() { read = true; throw new Error('Synthetic customer body must not be read.'); },
      async cancel() { canceled = true; } },
  }) });
  assert.equal(read, false);
  assert.equal(canceled, true);
  assert.equal(result.checks.investigations.status, 200);
  assert.equal(result.preflightChecksPassed, false);
});

test('HTML login or access-block pages on any API fail closed', async () => {
  for (const path of ['/api/auth/providers', '/api/auth/csrf', '/api/investigations', '/api/auth/session']) {
    const { result } = await run({ [path]: () => new Response('<html>synthetic access login</html>', {
      status: path === '/api/investigations' ? 401 : 200, headers: { 'content-type': 'text/html' },
    }) });
    assert.equal(result.preflightChecksPassed, false);
    assert.equal(Object.values(result.checks).filter((check) => !check.passed).length, 1);
  }
});

test('same-origin and cross-origin redirects are never followed or disclosed', async () => {
  for (const location of [baseURL + '/login?synthetic-private-query', 'https://access.example.invalid/?synthetic-private-query']) {
    for (const path of Object.keys(healthy())) {
      const { result, requests } = await run({ [path]: () => new Response(null, { status: 307, headers: { location } }) });
      assert.equal(result.preflightChecksPassed, false);
      assert.equal(requests.length, 5);
      assert.ok(Object.values(result.checks).some((check) => check.reason === 'REDIRECT_BLOCKED'));
      assert.ok(!JSON.stringify(result).includes('synthetic-private-query'));
    }
  }
});

test('a response already redirected by an injected transport also fails closed', async () => {
  const { result } = await run({ '/api/auth/providers': () => {
    const response = json(providers());
    Object.defineProperty(response, 'redirected', { value: true });
    return response;
  } });
  assert.equal(result.checks.providers.reason, 'REDIRECT_BLOCKED');
});

test('malformed JSON and non-JSON content types cannot satisfy API contracts', async () => {
  for (const headers of [{ 'content-type': 'application/json' }, { 'content-type': 'text/plain' }, {}]) {
    const { result } = await run({ '/api/auth/providers': () => new Response('not JSON: synthetic-private-value', { headers }) });
    assert.equal(result.preflightChecksPassed, false);
    assert.ok(!JSON.stringify(result).includes('synthetic-private-value'));
  }
});

test('a non-null session is not accepted as an anonymous preflight', async () => {
  const { result } = await run({ '/api/auth/session': () => json({ user: { name: 'synthetic-private-name' } }) });
  assert.equal(result.checks.session.reason, 'UNEXPECTED_RESPONSE');
  assert.ok(!JSON.stringify(result).includes('synthetic-private-name'));
});

test('transport exceptions expose no URLs, messages, credentials, or response content', async () => {
  const result = await probeDeployment(baseURL, { fetchImpl: async () => {
    throw new Error('https://user:synthetic-private-secret@example.invalid/?private=synthetic-private-secret');
  } });
  assert.equal(result.preflightChecksPassed, false);
  assert.ok(Object.values(result.checks).every((check) => check.status === null && check.reason === 'REQUEST_FAILED'));
  assert.ok(!JSON.stringify(result).includes('synthetic-private-secret'));
});

test('only fixed configuration variable names are reported', async () => {
  const { result } = await run({ '/api/investigations': () => json({
    code: 'CONFIGURATION_REQUIRED', missing: ['AUTH_SECRET', 'DATABASE_URL', 'synthetic-private-value', { value: 'private' }],
    error: 'synthetic-private-error',
  }, 503) });
  assert.deepEqual(result.missingConfiguration, ['DATABASE_URL', 'AUTH_SECRET']);
  assert.ok(!JSON.stringify(result).includes('synthetic-private'));
});

test('missing-configuration claims are only accepted from an explicit 503 configuration response', async () => {
  const { result } = await run({ '/api/investigations': () => json({
    code: 'CONFIGURATION_REQUIRED', missing: ['DATABASE_URL'],
  }, 401) });
  assert.deepEqual(result.missingConfiguration, []);
  assert.equal(result.checks.investigations.reason, 'UNEXPECTED_RESPONSE');
});

test('oversized untrusted JSON is rejected without logging its body', async () => {
  const { result } = await run({ '/api/auth/csrf': () => json({ csrfToken: 'x'.repeat(65537) }) });
  assert.equal(result.checks.csrf.reason, 'INVALID_JSON');
  assert.equal(result.checks.csrf.tokenPresent, false);
});

test('invalid or incomplete pure observations cannot pass', () => {
  for (const observations of [{}, { homepage: { status: 200, contentType: 'text/html' } },
    { providers: { status: '200', body: providers(), jsonValid: true, contentType: 'application/json' } }]) {
    const result = classifyDeployment(observations);
    assert.equal(result.preflightChecksPassed, false);
    assert.equal(result.operationalReady, false);
  }
});

test('only an explicit HTTPS root origin is accepted', () => {
  assert.equal(validateDeploymentUrl(baseURL + '/'), baseURL);
  assert.equal(validateDeploymentUrl('https://preview.example.invalid:8443'), 'https://preview.example.invalid:8443');
  for (const value of [undefined, '', '/relative', '//preview.example.invalid', 'http://preview.example.invalid',
    'file:///preview', 'javascript:synthetic', 'https://user:synthetic@example.invalid', 'https://@example.invalid',
    baseURL + '?', baseURL + '#', baseURL + '?token=synthetic', baseURL + '#synthetic',
    baseURL + '/login', baseURL + '/./', baseURL + '/path/..', ' ' + baseURL, baseURL + '\\path', baseURL + '\n']) {
    assert.throws(() => validateDeploymentUrl(value), /explicit HTTPS origin/);
  }
});

test('invalid input is rejected before any fetch and never echoes the supplied value', async () => {
  let calls = 0;
  await assert.rejects(probeDeployment('https://user:synthetic-private-secret@example.invalid', {
    fetchImpl: async () => { calls++; throw new Error('Unexpected request.'); },
  }), (error) => !error.message.includes('synthetic-private-secret'));
  assert.equal(calls, 0);
  for (const timeoutMs of [0, -1, 60001, NaN, '10']) {
    await assert.rejects(probeDeployment(baseURL, { timeoutMs, fetchImpl: async () => { calls++; } }), /Timeout/);
  }
  assert.equal(calls, 0);
});
