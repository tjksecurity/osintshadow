import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';

const reservation = createServer();
await new Promise((resolve, reject) => { reservation.once('error', reject); reservation.listen(0, '127.0.0.1', resolve); });
const port = reservation.address().port;
await new Promise((resolve, reject) => reservation.close((error) => error ? reject(error) : resolve()));
const child = spawn(process.execPath, ['build/server/index.js'], {
  cwd: process.cwd(), env: { ...process.env, PORT: String(port), HOST: '127.0.0.1',
    DATABASE_URL: '', AUTH_SECRET: '', NODE_ENV: 'production' }, stdio: ['ignore', 'pipe', 'pipe'],
});
let diagnostics = '';
child.stdout.on('data', (data) => { diagnostics += data; });
child.stderr.on('data', (data) => { diagnostics += data; });
child.on('error', (error) => { diagnostics += error.message; });
try {
  const base = `http://127.0.0.1:${port}`;
  let ready = false;
  for (let attempt = 0; attempt < 75; attempt++) {
    if (child.exitCode !== null) throw new Error(`Server exited: ${diagnostics}`);
    try {
      const response = await fetch(base, { signal: AbortSignal.timeout(1000) });
      if (response.status === 200) { ready = true; break; }
    } catch { /* Wait for the new child to bind its own port. */ }
    await delay(200);
  }
  assert.ok(ready, `Server never became ready: ${diagnostics}`);
  const session = await fetch(`${base}/api/auth/session`, { signal: AbortSignal.timeout(5000) });
  assert.equal(session.status, 200);
  assert.equal(await session.json(), null);
  for (const route of ['/api/investigations', '/api/investigations/synthetic/progress']) {
    const response = await fetch(base + route, { signal: AbortSignal.timeout(5000) });
    assert.equal(response.status, 503);
    const body = await response.json();
    assert.equal(body.code, 'CONFIGURATION_REQUIRED');
    assert.deepEqual(body.missing, ['DATABASE_URL', 'AUTH_SECRET']);
  }
  const missing = await fetch(`${base}/api/not-a-real-route`, { signal: AbortSignal.timeout(5000) });
  assert.equal(missing.status, 404);
  assert.equal((await missing.json()).error, 'API route not found.');
  assert.ok(!diagnostics.includes('Error finding route files'), diagnostics);
  console.log('Built server smoke passed: homepage, signed-out session, bundled parameter routes, configuration errors, and API 404.');
} finally {
  if (child.exitCode === null) {
    child.kill();
    await Promise.race([new Promise((resolve) => child.once('exit', resolve)), delay(5000)]);
    if (child.exitCode === null) child.kill('SIGKILL');
  }
}
