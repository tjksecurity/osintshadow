import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { normalizeProcessingFlags, readStoredProcessingFlags } from '../src/app/api/investigations/utils/processingFlags.js';
import { regenerateInvestigation } from '../src/app/api/investigations/utils/regenerate.js';

// Execute the real route/effect with synthetic persistence, timers and transport.
// No credentials, customer records, collectors or provider requests are used.
const api = '../src/app/api/investigations/';
const steps = ['osint', 'social_profiles', 'social_posts', 'ai', 'deconflict', 'geo', 'report'];
const flags = normalizeProcessingFlags({}, true);
async function route(path, sql, helpers = {}, user = { id: 'owner' }) {
  const key = '__runner_' + randomUUID();
  globalThis[key] = { sql, auth: async () => ({ user }), readStoredProcessingFlags, ...helpers };
  let source = await readFile(new URL(api + path, import.meta.url), 'utf8');
  source = source.replace(/^import\s+([\s\S]*?)\s+from\s+["'][^"']+["'];/gm, (_, names) => {
    return `const ${names.trim()} = globalThis[${JSON.stringify(key)}]${names.trim().startsWith('{') ? '' : '.' + names.trim()};`;
  });
  source = 'const console = { error() {}, warn() {}, log() {} };\n' + source;
  try { return await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64')); }
  finally { delete globalThis[key]; }
}
const request = () => new Request('https://example.invalid/api/investigations/1', { method: 'POST' });
const context = { params: { id: '1' } };
const flush = () => new Promise(resolve => setImmediate(resolve));

test('progress returns the newest 200 events, chronological, without forgetting completed steps', async () => {
  const history = Array.from({ length: 307 }, (_, i) => ({ id: i + 1, step_key: i < 7 ? steps[i] : 'report', event_status: i < 7 ? 'completed' : 'info', percent: i < 7 ? 80 : 92 }));
  const sql = async (parts, ...values) => {
    const q = parts.join('?');
    if (q.includes('FROM investigations')) {
      assert.match(q, /user_id =/); assert.equal(values[1], 'owner');
      return [{ id: 1, status: 'processing' }];
    }
    if (/SELECT DISTINCT/.test(q)) return history.slice(0, 7);
    if (/ORDER BY id DESC/.test(q)) return history.slice(-200).reverse();
    return history.slice(0, 200);
  };
  const response = await (await route('[id]/progress/route.js', sql)).GET(request(), context);
  const body = await response.json();
  assert.equal(body.lastEventId, 307);
  assert.equal(body.events.length, 200);
  assert.equal(body.events[0].id, 108);
  assert.equal(body.events.at(-1).id, 307);
  assert.deepEqual(body.completedSteps.sort(), [...steps].sort());
  assert.match(response.headers.get('cache-control'), /no-store/);
});

test('progress never reads another owner’s history', async () => {
  let calls = 0;
  const sql = async parts => { calls++; assert.match(parts.join('?'), /user_id =/); return []; };
  assert.equal((await (await route('[id]/progress/route.js', sql)).GET(request(), context)).status, 404);
  assert.equal(calls, 1);
});

async function tickHarness({ noise = false, checkpointFails = false, historyFails = false, terminal = false, claim = true, statusWriteFails = false } = {}) {
  const history = steps.filter(step => step !== 'social_posts').map(step => ({ step_key: step, event_status: 'completed' }));
  if (noise) history.push(...Array.from({ length: 301 }, () => ({ step_key: 'report', event_status: 'info' })));
  if (terminal) history.push({ step_key: 'social_posts', event_status: 'completed' });
  const state = { status: 'processing', released: false, progress: [] };
  const sql = async (parts) => {
    const q = parts.join('?');
    if (q.includes('FROM investigations')) return [{ id: 1, status: state.status, processing_flags: flags }];
    if (q.includes('SET processing_locked_until = NOW()')) return claim ? [{ id: 1 }] : [];
    if (q.includes('FROM investigation_progress_events')) {
      if (historyFails) throw new Error('Synthetic history read failure');
      return /SELECT DISTINCT/.test(q) ? history.filter(e => e.event_status !== 'info') : history.slice(-300);
    }
    if (q.includes('FROM social_profiles')) return [];
    if (q.includes('SET processing_locked_until = NULL')) {
      assert.match(q, /processing_lock_token =/);
      state.released = true; return [];
    }
    throw new Error('Unexpected synthetic SQL: ' + q);
  };
  const helpers = {
    logEvent: async () => {},
    updateInvestigationStatus: async (_sql, _id, status) => {
      if (statusWriteFails) throw new Error('Synthetic status write failure');
      state.status = status;
    },
    insertProgressEvent: async (_sql, _id, event) => {
      if (checkpointFails && event.stepKey === 'social_posts' && event.eventStatus === 'completed') throw new Error('Synthetic checkpoint failure');
      state.progress.push(event);
    },
    insertOSINTData: async () => { throw new Error('Collector must not run'); },
  };
  const loaded = await route('[id]/tick/route.js', sql, helpers);
  return { state, call: () => loaded.POST(request(), context) };
}

test('a noisy progress tail cannot replay already completed collection stages', async () => {
  const h = await tickHarness({ noise: true });
  const response = await h.call();
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.ranStep, 'social_posts');
  assert.equal(h.state.released, true);
});

test('a lost completion checkpoint is not reported as successful progress', async () => {
  const h = await tickHarness({ checkpointFails: true });
  assert.equal((await h.call()).status, 500);
  assert.equal(h.state.status, 'failed');
  assert.equal(h.state.released, true);
});

test('history failure after claiming a lease releases only this lease', async () => {
  const h = await tickHarness({ historyFails: true });
  assert.equal((await h.call()).status, 500);
  assert.equal(h.state.released, true);
});

test('all checkpoints complete returns terminal status and releases the owned lease', async () => {
  const h = await tickHarness({ terminal: true });
  const response = await h.call();
  assert.equal(response.status, 200);
  assert.equal((await response.json()).status, 'completed');
  assert.equal(h.state.released, true);
});

test('a rejected lease claim cannot release another worker’s lease', async () => {
  const h = await tickHarness({ claim: false });
  assert.equal((await h.call()).status, 202);
  assert.equal(h.state.released, false);
});

test('even failure to persist terminal status releases the owned lease', async () => {
  const h = await tickHarness({ terminal: true, statusWriteFails: true });
  assert.equal((await h.call()).status, 500);
  assert.equal(h.state.released, true);
});

async function effectHarness() {
  const source = (await readFile(new URL('../src/app/investigations/[id]/page.jsx', import.meta.url), 'utf8')).replaceAll('\r', '');
  const effect = source.slice(source.indexOf('  // NEW: tick processing'), source.indexOf('  useEffect(() => {\n    if (typeof window', source.indexOf('  // NEW: tick processing'))).replaceAll('\r', '');
  assert.match(effect, /useEffect/);
  const timers = new Map(); let nextTimer = 0;
  const calls = []; const errors = [];
  const refs = [{ current: false }, { current: null }];
  const setTimer = (fn, delay) => { const id = ++nextTimer; timers.set(id, { fn, delay }); return id; };
  const clearTimer = id => timers.delete(id);
  const fetch = (url, options) => new Promise(resolve => calls.push({ url, options, resolve }));
  const run = new Function('useEffect', 'id', 'investigationStatus', 'tickInFlightRef', 'tickTimerRef', 'setLastTickError', 'fetch', 'setTimeout', 'clearTimeout', 'AbortController', 'refetch', effect);
  const render = id => {
    let cleanup;
    run(fn => { cleanup = fn(); }, id, 'processing', ...refs, value => errors.push(value), fetch, setTimer, clearTimer, AbortController, async () => {});
    return cleanup;
  };
  return { render, calls, timers, errors };
}

test('changing investigation retires the old loop even if its in-flight response arrives late', async () => {
  const h = await effectHarness();
  const stopA = h.render('1');
  stopA();
  const stopB = h.render('2');
  assert.equal(h.calls.length, 2, 'new investigation must have its own runner');
  assert.equal(h.calls[0].options.signal.aborted, true);
  h.calls[0].resolve(Response.json({ status: 'processing' }));
  await flush();
  assert.equal(h.errors.length, 0, 'retired loop must not update the new investigation UI');
  assert.equal([...h.timers.values()].filter(t => t.delay === 1500).length, 0);
  h.calls[1].resolve(Response.json({ status: 'processing' }));
  await flush();
  assert.equal([...h.timers.values()].filter(t => t.delay === 1500).length, 1);
  stopB();
  assert.equal(h.timers.size, 0);
});

test('configuration/auth failures stop automatic retries instead of hammering a blocked job', async () => {
  for (const status of [401, 403, 404, 409]) {
    const h = await effectHarness();
    const stop = h.render('1');
    h.calls[0].resolve(Response.json({ error: 'Synthetic blocked configuration' }, { status }));
    await flush();
    assert.equal(h.timers.size, 0, `HTTP ${status} must not rearm`);
    assert.match(h.errors.at(-1), /Synthetic blocked configuration/);
    stop();
  }
});

test('terminal success stops the runner without waiting for another status poll', async () => {
  const h = await effectHarness();
  const stop = h.render('1');
  h.calls[0].resolve(Response.json({ status: 'completed' }));
  await flush();
  assert.equal(h.timers.size, 0);
  stop();
});

test('a busy lease remains retryable and never overlaps requests in the same loop', async () => {
  const h = await effectHarness();
  const stop = h.render('1');
  assert.equal(h.calls.length, 1);
  assert.equal([...h.timers.values()].filter(t => t.delay === 1500).length, 0);
  h.calls[0].resolve(Response.json({ status: 'processing' }, { status: 202 }));
  await flush();
  assert.equal([...h.timers.values()].filter(t => t.delay === 1500).length, 1);
  stop();
});

test('a terminal stage failure does not automatically run collection again', async () => {
  const h = await effectHarness();
  const stop = h.render('1');
  h.calls[0].resolve(Response.json({ code: 'TICK_FAILED', error: 'Synthetic stage failure' }, { status: 500 }));
  await flush();
  assert.equal(h.timers.size, 0);
  stop();
});

test('start refuses missing saved permissions before it changes status', async () => {
  let writes = 0;
  const sql = async parts => {
    if (/UPDATE/.test(parts.join('?'))) { writes++; return [{ id: 1 }]; }
    return [{ id: 1, status: 'queued', processing_flags: null }];
  };
  const loaded = await route('[id]/start/route.js', sql, { insertProgressEvent: async () => {}, logEvent: async () => {} });
  const response = await loaded.POST(request(), context);
  assert.equal(response.status, 409);
  assert.equal((await response.json()).code, 'PROCESSING_FLAGS_REQUIRED');
  assert.equal(writes, 0);
});

test('start rechecks the exact saved settings and does not report a failed CAS as started', async () => {
  let calls = 0;
  const sql = async parts => {
    const q = parts.join('?'); calls++;
    if (/UPDATE/.test(q)) {
      assert.match(q, /user_id =/);
      assert.match(q, /processing_flags::jsonb =/);
      return [];
    }
    return [{ id: 1, status: 'queued', processing_flags: flags }];
  };
  const loaded = await route('[id]/start/route.js', sql, { insertProgressEvent: async () => {}, logEvent: async () => {} });
  const response = await loaded.POST(request(), context);
  assert.equal(response.status, 409);
  assert.equal((await response.json()).code, 'PROCESSING_STATE_CHANGED');
  assert.equal(calls, 3);
});

test('regeneration preserves artifacts for incomplete settings or any running status before mutation', async () => {
  let transactions = 0;
  const sql = { transaction() { transactions++; throw new Error('Must not mutate'); } };
  for (const processing_flags of [null, {}, { includeNSFW: false }]) {
    assert.equal((await regenerateInvestigation(sql, { id: 1, status: 'failed', processing_flags }, 'owner')).code, 'PROCESSING_FLAGS_REQUIRED');
  }
  for (const status of ['queued', 'processing', 'unknown']) {
    assert.equal((await regenerateInvestigation(sql, { id: 1, status, processing_flags: flags }, 'owner')).code, 'INVESTIGATION_RUNNING');
  }
  assert.equal(transactions, 0);
});

test('regeneration locks ownership and puts cleanup, settings/lease recheck, reset and first progress in one mutation', async () => {
  const sql = { transaction: async (build, options) => {
    assert.equal(options.isolationLevel, 'ReadCommitted');
    const statements = build((parts, ...values) => ({ query: parts.join('?'), values }));
    assert.equal(statements.length, 2);
    assert.match(statements[0].query, /user_id = \? FOR UPDATE/);
    assert.deepEqual(statements[0].values, [1, 'owner']);
    const mutation = statements[1];
    assert.deepEqual(mutation.values, [1, 'owner', JSON.stringify(flags)]);
    assert.match(mutation.query, /status IN \('completed', 'failed'\)/);
    assert.match(mutation.query, /processing_flags::jsonb =/);
    assert.match(mutation.query, /processing_locked_until < NOW\(\)/);
    assert.match(mutation.query, /processing_lock_token IS NULL/);
    assert.equal((mutation.query.match(/DELETE FROM/g) || []).length, 8);
    assert.equal((mutation.query.match(/IN \(SELECT id FROM eligible\)/g) || []).length, 9);
    assert.match(mutation.query, /INSERT INTO investigation_progress_events[\s\S]+FROM reset/);
    return [[{ id: 1 }], []]; // eligibility changed: no destructive fallback
  } };
  assert.equal((await regenerateInvestigation(sql, { id: 1, status: 'failed', processing_flags: flags }, 'owner')).code, 'PROCESSING_STATE_CHANGED');
});

test('regeneration transaction failure propagates without standalone cleanup or retry', async () => {
  let calls = 0;
  const sql = () => { throw new Error('Standalone cleanup is forbidden'); };
  sql.transaction = async () => { calls++; throw new Error('Synthetic rollback'); };
  await assert.rejects(regenerateInvestigation(sql, { id: 1, status: 'failed', processing_flags: flags }, 'owner'), /Synthetic rollback/);
  assert.equal(calls, 1);
});

test('real regenerate route returns the guarded rejection without deleting saved results', async () => {
  const sql = async parts => {
    assert.match(parts.join('?'), /SELECT id, user_id, status, processing_flags/);
    return [{ id: 1, status: 'failed', processing_flags: null }];
  };
  const loaded = await route('[id]/route.js', sql, { regenerateInvestigation, logEvent: async () => {} });
  const response = await loaded.POST(request(), context);
  assert.equal(response.status, 409);
  assert.equal((await response.json()).code, 'PROCESSING_FLAGS_REQUIRED');
});
