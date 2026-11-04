import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createPublicSourceStore, PUBLIC_SOURCE_LIMITS } from '../src/app/api/investigations/osint/publicSourceStore.js';

// These tagged-SQL doubles inspect parameterization and decisions only. They do
// not execute PostgreSQL or prove transaction rollback, locking or concurrency.
function harness({ output, fail = false, pending = false } = {}) {
  const transactions = [];
  const sql = () => { throw new Error('Queries must stay inside a transaction'); };
  sql.transaction = async (callback, options) => {
    const queries = [];
    const tx = (strings, ...values) => {
      assert.ok(Array.isArray(strings.raw), 'use tagged SQL, never concatenated target SQL');
      const query = { text: strings.join('?').replace(/\s+/g, ' ').trim(), values };
      queries.push(query);
      return query;
    };
    const record = { queries, options };
    transactions.push(record);
    const statements = callback(tx);
    assert.ok(Array.isArray(statements));
    assert.deepEqual(statements, queries, 'transaction must receive the tagged statements');
    if (fail) throw new Error('Synthetic missing schema / private connection error');
    if (pending) return new Promise(() => {});
    return typeof output === 'function' ? output(record) : output;
  };
  return { store: createPublicSourceStore(sql), transactions };
}

const expectedLimits = {
  github: { day: 50, month: 1000, interval: 75, units: 1 },
  bluesky: { day: 100, month: 2000, interval: 1, units: 1 },
  stackexchange: { day: 100, month: 2000, interval: 60, units: 1 },
  openalex: { day: 50, month: 1000, interval: 1, units: 1 },
  wikidata: { day: 100, month: 2000, interval: 2, units: 2 },
  tavily: { day: 30, month: 900, interval: 5, units: 1 },
  exa: { day: 30, month: 500, interval: 5, units: 1 },
  veriphone: { day: 30, month: 900, interval: 5, units: 1 },
};

test('all eight providers retain the contract safety caps, not unlimited/free-billing claims', () => {
  assert.deepEqual(PUBLIC_SOURCE_LIMITS, expectedLimits);
  assert.ok(Object.isFrozen(PUBLIC_SOURCE_LIMITS));
});

test('reservation locks the shared provider row before spending aggregate UTC budget and claiming the receipt', async () => {
  for (const [provider, limit] of Object.entries(expectedLimits)) {
    const h = harness({ output: [[], [{ status: 'reserved', envelope: null }]] });
    assert.deepEqual(await h.store.reserve(provider, '42'), { status: 'reserved', envelope: null });
    assert.equal(h.transactions.length, 1);
    const { queries, options } = h.transactions[0];
    assert.deepEqual(options, { isolationLevel: 'ReadCommitted' });
    assert.equal(queries.length, 2);
    assert.match(queries[0].text, /^INSERT INTO osint_provider_budgets/);
    assert.match(queries[0].text, /ON CONFLICT \(provider\) DO UPDATE SET provider = EXCLUDED.provider/);
    assert.deepEqual(queries[0].values, [provider]);
    const query = queries[1];
    assert.match(query.text, /prior AS MATERIALIZED/);
    assert.match(query.text, /WHERE provider = \? AND investigation_id = \?/);
    assert.match(query.text, /AT TIME ZONE 'UTC'/);
    assert.match(query.text, /CASE WHEN day_key .* THEN day_used ELSE 0 END AS today/);
    assert.match(query.text, /CASE WHEN month_key .* THEN month_used ELSE 0 END AS this_month/);
    assert.match(query.text, /NOT EXISTS \(SELECT 1 FROM prior\)/);
    assert.match(query.text, /today \+ \? <= \? AND this_month \+ \? <= \?/);
    assert.match(query.text, /blocked_until IS NULL OR blocked_until <= CURRENT_TIMESTAMP/);
    assert.match(query.text, /last_request_at <= CURRENT_TIMESTAMP - \? \* INTERVAL '1 second'/);
    assert.match(query.text, /ON CONFLICT DO NOTHING RETURNING provider/);
    assert.match(query.text, /FROM budget, claimed WHERE b.provider = claimed.provider AND b.provider = budget.provider/);
    assert.deepEqual(query.values, [
      provider, '42', provider, '42', provider,
      limit.units, limit.day, limit.units, limit.month, limit.interval,
      limit.units, limit.units, limit.units, limit.day, limit.units, limit.month,
    ]);
    assert.ok(!query.text.includes('42'), 'investigation identifier must be parameterized');
  }
});

test('completed receipt precedes cooldown/quota, and an unresolved receipt is never automatically retried', async () => {
  const envelope = { schema_version: 1, result: { provider: 'github', status: 'no_match' } };
  for (const status of ['cached', 'lookup_pending', 'reserved', 'quota_exhausted', 'rate_limited']) {
    const row = { status, envelope: status === 'cached' ? envelope : null };
    const h = harness({ output: [[], [row]] });
    assert.deepEqual(await h.store.reserve('github', 42), row);
    const query = h.transactions[0].queries[1].text;
    const positions = ['cached', 'lookup_pending', 'reserved', 'quota_exhausted', 'rate_limited'].map(value => query.indexOf(`'${value}'`));
    assert.ok(positions.every(position => position >= 0));
    assert.deepEqual(positions, [...positions].sort((a, b) => a - b));
    assert.doesNotMatch(query, /DELETE|TRUNCATE|result_json\s*=\s*NULL/i);
  }
});

test('missing transaction capability fails closed before attempting SQL', async () => {
  for (const sql of [undefined, null, {}, { transaction: true }, () => assert.fail('must not query')]) {
    const store = createPublicSourceStore(sql);
    assert.deepEqual(await store.reserve('github', 42), { status: 'budget_unavailable' });
    assert.equal(await store.save('github', 42, {}), false);
  }
});

test('unknown and inherited provider properties never reach SQL', async () => {
  for (const provider of ['', 'unknown', 'GITHUB', 'toString', 'constructor', '__proto__', null, undefined, ['github']]) {
    const h = harness({ output: [[], [{ status: 'reserved' }]] });
    assert.deepEqual(await h.store.reserve(provider, 42), { status: 'budget_unavailable' }, String(provider));
    assert.equal(await h.store.save(provider, 42, {}), false, String(provider));
    assert.equal(h.transactions.length, 0, String(provider));
  }
});

test('invalid or coercion-prone investigation IDs never reach SQL or escape as exceptions', async () => {
  const ids = [undefined, null, '', '0', 0, -1, 1.5, NaN, Infinity, '01', ' 1 ', '1e2', '1; DROP TABLE investigations',
    '10000000000000000000', '9223372036854775808', Number.MAX_SAFE_INTEGER + 1,
    [], [1], {}, { toString() { throw new Error('must not coerce user object'); } }];
  for (const id of ids) {
    const h = harness({ output: [[], [{ status: 'reserved' }]] });
    assert.deepEqual(await h.store.reserve('github', id), { status: 'budget_unavailable' });
    assert.equal(await h.store.save('github', id, {}), false);
    assert.equal(h.transactions.length, 0);
  }
});

test('integer and exact bigint-string identifiers remain losslessly parameterized', async () => {
  for (const id of [1, Number.MAX_SAFE_INTEGER, '9223372036854775807']) {
    const h = harness({ output: [[], [{ status: 'reserved' }]] });
    assert.equal((await h.store.reserve('exa', id)).status, 'reserved');
    assert.equal(h.transactions[0].queries[1].values[1], String(id));
  }
});

test('missing schema or transaction failure returns a static unavailable result without leaking the exception', async () => {
  const h = harness({ fail: true });
  assert.deepEqual(await h.store.reserve('github', 42), { status: 'budget_unavailable' });
  assert.equal(await h.store.save('github', 42, { synthetic: true }), false);
  assert.equal(h.transactions.length, 2);
});

test('absent SQL result rows cannot accidentally grant a reservation', async () => {
  for (const output of [undefined, null, [], [[]], [[], []], [[], [null]]]) {
    const h = harness({ output });
    assert.deepEqual(await h.store.reserve('github', 42), { status: 'budget_unavailable' });
  }
});

test('saving uses the same lock order and writes a result only while its receipt remains unresolved', async () => {
  const envelope = { schema_version: 1, result: { provider: 'github', status: 'no_match', records: [] } };
  const original = structuredClone(envelope);
  const h = harness({ output: [[{ provider: 'github' }], [{ provider: 'github' }]] });
  assert.equal(await h.store.save('github', 42, envelope, 75), true);
  assert.deepEqual(envelope, original);
  const { queries, options } = h.transactions[0];
  assert.deepEqual(options, { isolationLevel: 'ReadCommitted' });
  assert.equal(queries.length, 2);
  assert.match(queries[0].text, /^UPDATE osint_provider_budgets/);
  assert.match(queries[0].text, /GREATEST\(COALESCE\(blocked_until, CURRENT_TIMESTAMP\), CURRENT_TIMESTAMP \+ \? \* INTERVAL '1 second'\)/);
  assert.deepEqual(queries[0].values, [75, 75, 'github']);
  assert.match(queries[1].text, /^UPDATE osint_provider_lookups SET result_json = \?::jsonb, completed_at = CURRENT_TIMESTAMP/);
  assert.match(queries[1].text, /WHERE provider = \? AND investigation_id = \? AND result_json IS NULL RETURNING provider$/);
  assert.deepEqual(queries[1].values, [JSON.stringify(envelope), 'github', '42']);
});

test('save rejects duplicate/completed receipts or absent budget rows rather than claiming persistence', async () => {
  for (const output of [undefined, [], [[], []], [[], [{ provider: 'github' }]], [[{ provider: 'github' }], []], [[{}, {}], [{}]], [[{}], [{}, {}]]]) {
    const h = harness({ output });
    assert.equal(await h.store.save('github', 42, { schema_version: 1 }), false);
  }
});

test('cooldown is nonnegative, rounded up, capped at 31 days and never shortens an existing block', async () => {
  const cases = [[undefined, 0], [0, 0], [-100, 0], [0.1, 1], [75.2, 76], [2678400, 2678400], [99999999, 2678400], [NaN, 0], [Infinity, 0], ['60', 0]];
  for (const [input, expected] of cases) {
    const h = harness({ output: [[{}], [{}]] });
    assert.equal(await h.store.save('github', 42, {}, input), true);
    const query = h.transactions[0].queries[0];
    assert.deepEqual(query.values, [expected, expected, 'github']);
    assert.match(query.text, /ELSE blocked_until END/);
    assert.match(query.text, /GREATEST\(COALESCE\(blocked_until, CURRENT_TIMESTAMP\)/);
  }
});

test('an unserializable envelope fails saving without throwing out of the processor', async () => {
  const circular = {}; circular.self = circular;
  const h = harness({ output: [[{}], [{}]] });
  assert.equal(await h.store.save('github', 42, circular), false);
});

test('an unresolved transaction has a bounded wait and is not retried', { timeout: 5000 }, async () => {
  const h = harness({ pending: true });
  const [reservation, saved] = await Promise.all([
    h.store.reserve('github', 42), h.store.save('github', 42, {}),
  ]);
  assert.deepEqual(reservation, { status: 'budget_unavailable' });
  assert.equal(saved, false);
  assert.equal(h.transactions.length, 2);
  // This does not imply an already-submitted PostgreSQL transaction was cancelled.
});

test('review-only migration cascades retained records but keeps aggregate budgets separate and is not auto-applied by the store', async () => {
  const migration = await readFile(new URL('../migrations/20261104_public_source_budgets.sql', import.meta.url), 'utf8');
  const source = await readFile(new URL('../src/app/api/investigations/osint/publicSourceStore.js', import.meta.url), 'utf8');
  assert.match(migration, /REVIEW ONLY\. Not applied by application startup or this task/);
  assert.match(migration, /investigation_id BIGINT NOT NULL REFERENCES investigations\(id\) ON DELETE CASCADE/);
  assert.match(migration, /PRIMARY KEY \(investigation_id, provider\)/);
  assert.match(migration, /CHECK \(\(completed_at IS NULL\) = \(result_json IS NULL\)\)/);
  assert.match(migration, /day_used INTEGER NOT NULL DEFAULT 0 CHECK \(day_used >= 0\)/);
  assert.match(migration, /month_used INTEGER NOT NULL DEFAULT 0 CHECK \(month_used >= 0\)/);
  assert.doesNotMatch(source, /CREATE TABLE|ALTER TABLE|20261104_public_source_budgets|readFile/);
  const budgetDefinition = migration.split('CREATE TABLE IF NOT EXISTS osint_provider_lookups')[0];
  assert.doesNotMatch(budgetDefinition, /REFERENCES investigations|target_value|api_key/i);
});
