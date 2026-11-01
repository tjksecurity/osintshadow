import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import * as database from '../src/app/api/investigations/utils/database.js';
import * as authUtilities from '../src/app/api/investigations/utils/auth.js';
import { normalizePhoneCandidate } from '../src/app/api/investigations/osint/phoneValidation.js';
import { normalizeProcessingFlags, readStoredProcessingFlags } from '../src/app/api/investigations/utils/processingFlags.js';
const { createInvestigation } = database;

// A transaction-boundary model: this checks the actual helper's statements,
// authorization branches and failure propagation, not PostgreSQL lock behavior.
function harness({ plan = 'pro', credits = 1, role = 'user', insertFails = false, debitFails = false, flagsFail = false, exists = true } = {}) {
  const state = { user: { id: 'synthetic-user', plan, credits, role }, investigations: [], transactions: 0 };
  let tail = Promise.resolve();
  const sql = () => { throw new Error('Mutation escaped its transaction.'); };
  sql.transaction = (build, options) => {
    const execute = async () => {
      state.transactions++;
      assert.equal(options.isolationLevel, 'ReadCommitted');
      const statements = build((parts, ...values) => ({ query: parts.join('?'), values }));
      assert.equal(statements.length, 2);
      assert.match(statements[0].query, /SELECT id FROM auth_users.*FOR UPDATE/s);
      const operation = statements[1];
      assert.match(operation.query, /WITH account AS MATERIALIZED/);
      assert.match(operation.query, /monthly_remaining > 0/);
      assert.match(operation.query, /UPDATE auth_users[\s\S]+INSERT INTO investigations/);
      assert.match(operation.query, /INSERT INTO investigations \(user_id, target_type, target_value, status, processing_flags\)/);
      assert.match(operation.query, /jsonb_populate_record\(NULL::investigations/);
      assert.match(operation.query, /NOT EXISTS \(\s*SELECT 1 FROM investigations WHERE user_id = account.id/);
      const before = structuredClone(state);
      if (!exists) return [[], [{ investigation: null, rejection: 'USER_NOT_FOUND' }]];
      const admin = state.user.role === 'admin';
      const trial = !admin && (!state.user.plan || state.user.plan === 'trial');
      if (trial && state.investigations.length) return [[{ id: state.user.id }], [{ investigation: null, rejection: 'TRIAL_EXCEEDED' }]];
      if (!admin && !trial && state.user.credits <= 0) return [[{ id: state.user.id }], [{ investigation: null, rejection: 'INSUFFICIENT_CREDITS' }]];
      try {
        if (!admin && !trial) {
          if (debitFails) throw new Error('Synthetic debit failure.');
          state.user.credits--;
        }
        if (insertFails) throw new Error('Synthetic insert failure.');
        if (flagsFail) throw new Error('Synthetic flags persistence failure.');
        const row = { id: state.investigations.length + 1, user_id: operation.values[1], target_type: operation.values[2], target_value: operation.values[3], status: 'queued', processing_flags: JSON.parse(operation.values[trial ? 4 : 5]) };
        state.investigations.push(row);
        return [[{ id: state.user.id }], [{ investigation: row, is_admin: admin, is_trial: trial, rejection: null }]];
      } catch (error) {
        state.user = before.user;
        state.investigations = before.investigations;
        throw error;
      }
    };
    const result = tail.then(execute);
    tail = result.catch(() => {});
    return result;
  };
  const create = (options = {}) => createInvestigation(sql, 'synthetic-user', 'domain', 'example.invalid', options);
  return { state, create, sql };
}

test('creation refuses a client without transaction support before issuing any write', async () => {
  let writes = 0;
  await assert.rejects(createInvestigation(async () => { writes++; return [{ id: 1 }]; }, 'synthetic-user', 'domain', 'example.invalid'), /transactional persistence/);
  assert.equal(writes, 0);
});

test('paid creation debits one credit inside the same transaction and returns authoritative flags', async () => {
  const h = harness();
  const result = await h.create();
  assert.equal(result.status, 'queued');
  assert.equal(result.target_value, 'example.invalid');
  assert.deepEqual(result.__creditAuthorization, { isAdmin: false, isTrial: false });
  assert.equal(h.state.user.credits, 0);
  assert.equal(h.state.investigations.length, 1);
  assert.equal(h.state.transactions, 1);
});

test('debit or insert errors do not produce a partially successful model mutation', async () => {
  for (const failure of [{ debitFails: true }, { insertFails: true }]) {
    const h = harness(failure);
    await assert.rejects(h.create(), /Synthetic (?:debit|insert) failure/);
    assert.equal(h.state.user.credits, 1);
    assert.equal(h.state.investigations.length, 0);
  }
});

test('a single remaining paid credit authorizes only one serialized model creation', async () => {
  const h = harness();
  const results = await Promise.allSettled([h.create(), h.create()]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(results.find(result => result.status === 'rejected').reason.code, 'INSUFFICIENT_CREDITS');
  assert.equal(h.state.user.credits, 0);
  assert.equal(h.state.investigations.length, 1);
});

test('trial and admin policy are preserved, including a second trial denial', async () => {
  const trial = harness({ plan: null, credits: 0 });
  const results = await Promise.allSettled([trial.create(), trial.create()]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(results.find(result => result.status === 'rejected').reason.code, 'TRIAL_EXCEEDED');
  assert.equal(trial.state.user.credits, 0);
  const admin = harness({ role: 'admin', plan: null, credits: 0 });
  assert.equal((await admin.create()).__creditAuthorization.isAdmin, true);
  assert.equal((await admin.create()).__creditAuthorization.isTrial, false);
  assert.equal(admin.state.user.credits, 0);
});

test('missing accounts fail with an explicit rejection and no inserted row', async () => {
  const h = harness({ exists: false });
  await assert.rejects(h.create(), (error) => error.code === 'USER_NOT_FOUND');
  assert.equal(h.state.investigations.length, 0);
});

async function routeHarness(options) {
  const h = harness(options);
  const sql = async (parts) => {
    const query = parts.join('?');
    if (query.includes('SELECT id, email, role')) {
      return [{ id: h.state.user.id, role: h.state.user.role, email: 'synthetic@example.invalid', subscription_plan: h.state.user.plan, monthly_remaining: h.state.user.credits }];
    }
    if (query.includes('SELECT COUNT(*)')) return [{ cnt: h.state.investigations.length }];
    if (query.includes('UPDATE investigations') || query.includes('INSERT INTO logs') || query.includes('INSERT INTO investigation_progress_events')) return [];
    throw new Error('Unexpected standalone persistence operation.');
  };
  sql.transaction = h.sql.transaction;
  const key = '__shadowtraceCreditRoute_' + randomUUID();
  globalThis[key] = { sql, database, authUtilities, normalizePhoneCandidate, readStoredProcessingFlags };
  let source = await readFile(new URL('../src/app/api/investigations/route.js', import.meta.url), 'utf8');
  source = source
    .replace('import { auth } from "@/auth";', 'const auth = async () => ({ user: { id: "synthetic-user", email: "synthetic@example.invalid" } });')
    .replace('import sql from "@/app/api/utils/sql";', `const sql = globalThis[${JSON.stringify(key)}].sql;`)
    .replace(/^import \{\s*checkAuthentication,\s*checkUserCredits,\s*\} from "\.\/utils\/auth\.js";$/m, `const { checkAuthentication, checkUserCredits } = globalThis[${JSON.stringify(key)}].authUtilities;`)
    .replace(/^import \{\s*createInvestigation,\s*logEvent,\s*insertProgressEvent,\s*\} from "\.\/utils\/database\.js";$/m, `const { createInvestigation, logEvent, insertProgressEvent } = globalThis[${JSON.stringify(key)}].database;`)
    .replace('import { normalizePhoneCandidate } from "./osint/phoneValidation.js";', `const { normalizePhoneCandidate } = globalThis[${JSON.stringify(key)}];`)
    .replace("import { readStoredProcessingFlags } from './utils/processingFlags.js';", `const { readStoredProcessingFlags } = globalThis[${JSON.stringify(key)}];`);
  let route;
  try { route = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64')); }
  finally { delete globalThis[key]; }
  return { ...h, call: () => route.POST(new Request('https://example.invalid/api/investigations', { method: 'POST', body: JSON.stringify({ target_type: 'domain', target_value: 'example.invalid' }) })) };
}

async function quiet(run) {
  const saved = { log: console.log, error: console.error, warn: console.warn };
  console.log = console.error = console.warn = () => {};
  try { await run(); } finally { Object.assign(console, saved); }
}

test('the real create route reports a failed debit instead of returning 201', () => quiet(async () => {
  const h = await routeHarness({ debitFails: true });
  const response = await h.call();
  assert.equal(response.status, 500);
  assert.equal((await response.json()).code, 'CREATE_FAILED');
  assert.equal(h.state.investigations.length, 0);
  assert.equal(h.state.user.credits, 1);
}));

test('the real route maps a concurrent paid-credit rejection to 402', () => quiet(async () => {
  const h = await routeHarness();
  const responses = await Promise.all([h.call(), h.call()]);
  assert.deepEqual(responses.map(response => response.status).sort(), [201, 402]);
  assert.equal(h.state.user.credits, 0);
  assert.equal(h.state.investigations.length, 1);
}));

test('the real route preserves trial limits in the transaction model', () => quiet(async () => {
  const h = await routeHarness({ plan: null, credits: 0 });
  const responses = await Promise.all([h.call(), h.call()]);
  assert.deepEqual(responses.map(response => response.status).sort(), [201, 402]);
  assert.equal(h.state.user.credits, 0);
  assert.equal(h.state.investigations.length, 1);
}));

test('collection flags commit with creation and cannot widen trial policy', async () => {
  const paid = harness();
  const row = await paid.create({ include_web_scraping: false, include_nsfw: false });
  assert.equal(row.processing_flags.includeWebScraping, false);
  assert.equal(row.processing_flags.includeNSFW, false);
  const trial = harness({ plan: null, credits: 0 });
  const limited = await trial.create({ include_web_scraping: true, include_nsfw: true });
  assert.deepEqual(limited.processing_flags, normalizeProcessingFlags({}, true));
  const failed = harness({ flagsFail: true });
  await assert.rejects(failed.create(), /flags persistence failure/);
  assert.equal(failed.state.user.credits, 1);
  assert.equal(failed.state.investigations.length, 0);
});

test('missing or incomplete stored flags cannot become permissive collection defaults', () => {
  for (const stored of [null, undefined, {}, '{bad', [], JSON.stringify({ includeNSFW: false })]) {
    assert.equal(readStoredProcessingFlags(stored), null);
  }
  const flags = normalizeProcessingFlags({}, true);
  assert.deepEqual(readStoredProcessingFlags(JSON.stringify(flags)), flags);
});

test('the real tick route rejects missing flags before claiming a lock or loading collectors', async () => {
  const key = '__shadowtraceFlagTick_' + randomUUID();
  let locks = 0;
  globalThis[key] = {
    sql: async (parts) => {
      const query = parts.join('?');
      if (query.includes('INSERT INTO logs')) return [];
      if (query.includes('FROM investigations')) return [{ id: 1, user_id: 'synthetic-user', status: 'queued', processing_flags: null }];
      locks++;
      throw new Error('Invalid processing flags reached a mutation.');
    }, database, readStoredProcessingFlags,
  };
  let source = await readFile(new URL('../src/app/api/investigations/[id]/tick/route.js', import.meta.url), 'utf8');
  source = source
    .replace('import { auth } from "@/auth";', 'const auth = async () => ({ user: { id: "synthetic-user" } });')
    .replace('import sql from "@/app/api/utils/sql";', `const sql = globalThis[${JSON.stringify(key)}].sql;`)
    .replace("import { readStoredProcessingFlags } from '../../utils/processingFlags.js';", `const { readStoredProcessingFlags } = globalThis[${JSON.stringify(key)}];`)
    .replace(/^import \{\s*insertProgressEvent,[\s\S]*?\} from "\.\.\/\.\.\/utils\/database\.js";$/m, `const { insertProgressEvent, logEvent, updateInvestigationStatus, insertOSINTData, insertAIAnalysis, insertGeoMarkers, insertReport } = globalThis[${JSON.stringify(key)}].database;`);
  let route;
  try { route = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64')); }
  finally { delete globalThis[key]; }
  const response = await route.POST(new Request('https://example.invalid/api/investigations/1/tick', { method: 'POST' }), { params: { id: '1' } });
  assert.equal(response.status, 409);
  assert.equal((await response.json()).code, 'PROCESSING_FLAGS_REQUIRED');
  assert.equal(locks, 0);
});
