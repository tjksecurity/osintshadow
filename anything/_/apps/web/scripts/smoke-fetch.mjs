import assert from 'node:assert/strict';

// Run against the built entry with no credentials, providers, or open listener.
process.env.DATABASE_URL = '';
process.env.AUTH_SECRET = process.env.SHADOWTRACE_SMOKE_WITH_AUTH === '1' ? 'synthetic-hosting-smoke-secret' : '';
process.env.AUTH_TRUST_HOST = 'true';
process.env.NODE_ENV = 'production';
const { default: entry } = await import('../api/index.mjs');
const request = (path) => entry.fetch(new Request('https://example.invalid' + path));
const homepage = await request('/');
assert.equal(homepage.status, 200);
assert.match(await homepage.text(), /<html/i);
const session = await request('/api/auth/session');
assert.equal(session.status, 200);
assert.equal(await session.json(), null);
for (const path of ['/api/investigations', '/api/investigations/synthetic/progress']) {
  const response = await request(path);
  assert.equal(response.status, 503);
  assert.equal((await response.json()).code, 'CONFIGURATION_REQUIRED');
}
const missing = await request('/api/not-a-real-route');
assert.equal(missing.status, 404);
assert.equal((await missing.json()).error, 'API route not found.');
assert.ok(!process.getActiveResourcesInfo().includes('TCPServerWrap'), 'Fetch mode opened an HTTP listener.');
console.log(`Hosting-only built fetch smoke passed (synthetic auth secret present: ${Boolean(process.env.AUTH_SECRET)}, database intentionally unconfigured): homepage, signed-out session, API configuration errors, and no HTTP listener. Authentication, persistence and operational readiness are NOT verified.`);
