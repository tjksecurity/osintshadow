import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('Vercel publishes the client build and routes requests to the original server', async () => {
  const config = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'));
  assert.equal(config.buildCommand, 'bun run build');
  assert.equal(config.outputDirectory, 'build/client');
  assert.equal(config.functions['api/index.mjs'].includeFiles, 'build/server/**');
  assert.deepEqual(config.rewrites, [{ source: '/(.*)', destination: '/api/index' }]);
  const manifest = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  assert.match(manifest.scripts.build, /node scripts\/stage-runtime\.mjs/);
});

test('serverless entry preserves requests and responses while reusing the server', async () => {
  let source = await readFile(new URL('../api/index.mjs', import.meta.url), 'utf8');
  const originalMode = process.env.SHADOWTRACE_SERVER_MODE;
  const requests = [];
  let loads = 0;
  const fixtureKey = '__shadowtraceHostingFixture';
  globalThis[fixtureKey] = async () => {
    loads++;
    assert.equal(process.env.SHADOWTRACE_SERVER_MODE, 'fetch');
    return { default: { fetch: async (request) => {
      requests.push(request);
      return new Response(await request.text(), { status: 202, headers: { 'x-original-server': 'yes' } });
    } } };
  };
  assert.ok(source.includes("import('../build/server/index.js')"));
  source = source.replace("import('../build/server/index.js')", `globalThis[${JSON.stringify(fixtureKey)}]()`);
  try {
    const { default: entry } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
    const request = new Request('https://example.invalid/api/synthetic?part=1', {
      method: 'POST', headers: { 'content-type': 'text/plain' }, body: 'synthetic body',
    });
    const response = await entry.fetch(request);
    assert.equal(response.status, 202);
    assert.equal(response.headers.get('x-original-server'), 'yes');
    assert.equal(await response.text(), 'synthetic body');
    await entry.fetch(new Request('https://example.invalid/'));
    assert.equal(requests[0], request);
    assert.equal(loads, 1);
  } finally {
    delete globalThis[fixtureKey];
    if (originalMode === undefined) delete process.env.SHADOWTRACE_SERVER_MODE;
    else process.env.SHADOWTRACE_SERVER_MODE = originalMode;
  }
});
