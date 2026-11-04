import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import * as catalogue from '../src/utils/publicSources.js';
import * as structure from '../src/app/api/investigations/osint/collector/dataStructure.js';
import * as database from '../src/app/api/investigations/utils/database.js';
import { normalizeProcessingFlags, readStoredProcessingFlags } from '../src/app/api/investigations/utils/processingFlags.js';
import { collectPublicSources } from '../src/app/api/investigations/osint/publicSources.js';
import { enrichPeopleDataLabs } from '../src/app/api/investigations/osint/peopleDataLabs.js';
import { generateReportHTML } from '../src/app/api/investigations/reports/generator.js';

// Real application functions execute with only transport, unrelated collectors,
// authentication and persistence boundaries injected. No provider requests or
// real database records are used. These tests do not prove database concurrency.
const root = '../src/app/api/investigations/';
const env = { PUBLIC_SOURCES_ENABLED: 'true', PUBLIC_SOURCE_GITHUB_ENABLED: 'true' };
const profile = { id: 123, login: 'synthetic-person', type: 'User', name: 'PUBLIC_SOURCE_ONLY_MARKER', company: 'Fixture Company' };
const allIDs = catalogue.PUBLIC_SOURCES.map(source => source.id);
const noNetwork = async () => { throw new Error('Unexpected live transport in isolated test'); };

async function load(relative, bindings = {}, { jsx = false, modules = {} } = {}) {
  let source = await readFile(new URL(relative, import.meta.url), 'utf8');
  source = source.replace(/^import[\s\S]*?from ["'][^"']+["'];?\s*/gm, '');
  // Dependency injection only; function bodies/branches remain the source under test.
  source = source.replace(/\bimport\(\s*(["'])([^"']+)\1\s*\)/g, (_match, _quote, path) => `__dynamic(${JSON.stringify(path)})`);
  if (jsx) source = ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.React, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  const key = '__public_sources_integration_' + randomUUID();
  globalThis[key] = {
    React, fetch: noNetwork, console: { log() {}, warn() {}, error() {} },
    __dynamic: async path => { assert.ok(Object.hasOwn(modules, path), `Unexpected dynamic import: ${path}`); return modules[path]; },
    ...bindings,
  };
  source = `const { ${Object.keys(globalThis[key]).join(', ')} } = globalThis[${JSON.stringify(key)}];\n` + source;
  try { return await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64')); }
  finally { delete globalThis[key]; }
}

function providerStore() {
  const cache = new Map(); const reservations = []; const saves = [];
  return {
    reservations, saves,
    async reserve(provider, id) {
      reservations.push({ provider, id });
      const key = `${id}:${provider}`;
      if (cache.has(key)) return { status: 'cached', envelope: structuredClone(cache.get(key)) };
      return { status: 'reserved' };
    },
    async save(provider, id, envelope, cooldownSeconds) {
      const copy = structuredClone(envelope); saves.push({ provider, id, envelope: copy, cooldownSeconds });
      cache.set(`${id}:${provider}`, copy); return true;
    },
  };
}

async function collectorHarness({ status = 200 } = {}) {
  const calls = []; const adapterOptions = [];
  const source = await readFile(new URL(root + 'osint/collector.js', import.meta.url), 'utf8');
  const names = [...source.matchAll(/import\s*\{([^}]+)\}/g)].flatMap(match => match[1].split(',').map(value => value.trim()).filter(Boolean));
  const bindings = Object.fromEntries(names.map(name => [name, async () => {}]));
  Object.assign(bindings, structure, {
    enrichPeopleDataLabs: (...args) => enrichPeopleDataLabs(...args, { env: {}, fetchImpl: noNetwork }),
    collectPublicSources: async (type, value, options, runtime) => {
      adapterOptions.push({ type, value, options, runtime });
      return collectPublicSources(type, value, options, {
        ...runtime, env,
        fetchImpl: async (address, init) => {
          calls.push({ address, init });
          assert.equal(new URL(address).origin, 'https://api.github.com');
          return Response.json(profile, { status });
        },
      });
    },
  });
  const { collectOSINT } = await load(root + 'osint/collector.js', bindings);
  return { collectOSINT, calls, adapterOptions };
}

function assertIsolated(data) {
  assert.ok(Array.isArray(data.public_sources)); assert.equal(data.public_sources.length, 1);
  assert.equal(data.public_sources[0].provider, 'github');
  assert.deepEqual(data.email_seeds, []); assert.deepEqual(data.phone_seeds, []); assert.deepEqual(data.discovered_urls, []);
  assert.deepEqual(data.social.profiles, []); assert.deepEqual(data.connections, { family: [], friends: [], associates: [] });
  assert.equal(data.error, undefined);
}

test('actual collector executes selected adapter while retaining separate provenance and no discovery seeds', async () => {
  const h = await collectorHarness(); const store = providerStore(); const progress = [];
  const data = await h.collectOSINT('username', 'synthetic-person', { publicSources: ['github'], investigationId: 7, publicSourceStore: store, onProgress: p => progress.push(p) });
  assertIsolated(data); assert.equal(data.public_sources[0].status, 'candidates_found');
  assert.equal(data.public_sources[0].records[0].label, profile.name);
  assert.equal(h.calls.length, 1); assert.equal(h.adapterOptions[0].runtime.store, store);
  assert.deepEqual(store.reservations, [{ provider: 'github', id: 7 }]);
  assert.ok(progress.some(event => event.step === 'public_sources'));
});

test('actual collector preserves a provider failure without replacing it with synthetic findings', async () => {
  const h = await collectorHarness({ status: 429 }); const store = providerStore();
  const data = await h.collectOSINT('username', 'synthetic-person', { publicSources: ['github'], investigationId: 7, publicSourceStore: store });
  assertIsolated(data); assert.equal(data.public_sources[0].status, 'rate_limited');
  assert.deepEqual(data.public_sources[0].records, []); assert.equal(h.calls.length, 1);
});

test('actual collector reuses completed receipt without another outbound request', async () => {
  const h = await collectorHarness(); const store = providerStore();
  const options = { publicSources: ['github'], investigationId: 7, publicSourceStore: store };
  const first = await h.collectOSINT('username', 'synthetic-person', options);
  const second = await h.collectOSINT('username', 'synthetic-person', options);
  assert.equal(h.calls.length, 1); assert.equal(second.public_sources[0].request_started, false);
  assert.equal(second.public_sources[0].evaluated_at, first.public_sources[0].evaluated_at);
});

function sqlHarness(flags) {
  const state = { status: 'processing', osint: [], reports: [], progress: [], queries: [], leaseReleased: false };
  const sql = async (parts, ...values) => {
    const query = parts.join('?'); state.queries.push({ query, values });
    if (query.includes('FROM investigations')) {
      assert.match(query, /user_id =/); assert.deepEqual(values.slice(0, 2), [7, 'synthetic-owner']);
      return [{ id: 7, user_id: 'synthetic-owner', status: state.status, target_type: 'username', target_value: 'synthetic-person', processing_flags: flags }];
    }
    if (query.includes("SET processing_locked_until = NOW() + INTERVAL '2 minutes'")) return [{ id: 7 }];
    if (query.includes('FROM investigation_progress_events')) return [];
    if (query.includes('SET processing_locked_until = NULL')) { state.leaseReleased = true; return []; }
    if (/UPDATE investigations/.test(query) && /SET status/.test(query)) { state.status = values[0]; return []; }
    if (/INSERT INTO osint_raw/.test(query)) { state.osint.push({ id: values[0], data: JSON.parse(values[1]) }); return []; }
    if (/INSERT INTO reports/.test(query)) { state.reports.push({ id: values[0], html: values[1] }); return []; }
    if (/INSERT INTO investigation_progress_events/.test(query)) { state.progress.push({ id: values[0], step: values[1], status: values[3] }); return []; }
    if (/INSERT INTO (ai_output|logs)/.test(query)) return [];
    throw new Error('Unexpected synthetic SQL: ' + query);
  };
  return { sql, state };
}

async function processorHarness(kind) {
  const flags = { ...normalizeProcessingFlags({}, true), publicSources: ['github'] };
  const h = sqlHarness(flags); const collector = await collectorHarness(); const store = providerStore();
  const collectorArguments = []; let factories = 0;
  const collectOSINT = async (...args) => { collectorArguments.push(args); return collector.collectOSINT(...args); };
  const createPublicSourceStore = sql => { assert.equal(sql, h.sql); factories++; return store; };
  const common = { ...database, sql: h.sql, readStoredProcessingFlags, collectOSINT, createPublicSourceStore };
  let result;
  if (kind === 'legacy') {
    const processor = await load(root + 'processing/processor.js', {
      ...common,
      collectSocialData: noNetwork, createSocialProfile: noNetwork, collectSocialPosts: noNetwork,
      performAIAnalysis: async () => ({ summary: 'Synthetic analysis only', risk_score: 0, risk_level: 'Unknown' }),
      computeDeconfliction: () => ({ type: 'deconfliction', counts: { total: 0 } }),
      extractGeoMarkers: () => [], generateReportHTML,
    });
    await processor.processInvestigation(7, 'username', 'synthetic-person', flags);
  } else {
    const route = await load(root + '[id]/tick/route.js', {
      ...common, auth: async () => ({ user: { id: 'synthetic-owner' } }),
    }, { modules: { '../../osint/collector.js': { collectOSINT }, '../../osint/publicSourceStore.js': { createPublicSourceStore } } });
    result = await route.POST(new Request('https://example.invalid/api/investigations/7/tick', { method: 'POST' }), { params: { id: '7' } });
  }
  return { ...h, result, flags, collector, collectorArguments, store, factories };
}

for (const kind of ['legacy', 'tick']) {
  test(`executed ${kind} caller passes selection/id/store and real insertOSINTData persists attributed output`, async () => {
    const h = await processorHarness(kind);
    if (kind === 'tick') {
      assert.equal(h.result.status, 200); assert.equal((await h.result.json()).ranStep, 'osint'); assert.equal(h.state.leaseReleased, true);
    } else {
      assert.equal(h.state.status, 'completed'); assert.equal(h.state.reports.length, 1);
      assert.ok(h.state.reports[0].html.includes('PUBLIC_SOURCE_ONLY_MARKER'));
    }
    assert.equal(h.factories, 1); assert.equal(h.collectorArguments.length, 1);
    const [type, value, options] = h.collectorArguments[0];
    assert.equal(type, 'username'); assert.equal(value, 'synthetic-person');
    assert.deepEqual(options.publicSources, ['github']); assert.equal(options.investigationId, 7); assert.equal(options.publicSourceStore, h.store);
    const saved = h.state.osint.find(row => row.data.public_sources);
    assert.ok(saved, 'Real insertOSINTData must reach synthetic SQL'); assert.equal(saved.id, 7); assertIsolated(saved.data);
    assert.equal(saved.data.public_sources[0].records[0].label, 'PUBLIC_SOURCE_ONLY_MARKER');
    assert.equal(h.collector.calls.length, 1);
    assert.ok(h.state.progress.some(event => event.step === 'osint' && event.status === 'completed'));
  });
}

test('public source flag normalization is additive, strict, deduplicated and disabled for trial', () => {
  assert.deepEqual(normalizeProcessingFlags({ public_sources: ['github', 'github', 'exa'] }).publicSources, ['github', 'exa']);
  for (const selection of [undefined, 'github', ['unknown'], [1], [...allIDs, 'github']]) assert.deepEqual(normalizeProcessingFlags({ public_sources: selection }).publicSources, []);
  assert.deepEqual(normalizeProcessingFlags({ public_sources: allIDs }, true).publicSources, []);
  const legacy = normalizeProcessingFlags({}); delete legacy.publicSources; delete legacy.includePeopleDataLabs;
  const serialized = JSON.stringify(legacy);
  assert.equal(JSON.stringify(readStoredProcessingFlags(serialized)), serialized);
  assert.equal(Object.hasOwn(readStoredProcessingFlags(serialized), 'publicSources'), false);
  for (const selection of ['github', ['unknown'], ['github', 'github']]) assert.equal(readStoredProcessingFlags({ ...legacy, publicSources: selection }), null);
});

test('actual external-AI payload excludes all new-provider records without mutating source evidence', async () => {
  let payload;
  const { enhanceWithAI } = await load(root + 'analysis/llm/anthropicEnhancer.js', {
    fetch: async (_address, options) => { payload = JSON.parse(options.body); return Response.json({ choices: [] }); },
  });
  const public_sources = allIDs.map(provider => ({ provider, records: [{ label: `ONLY_${provider}_EVIDENCE` }] }));
  const input = { target_type: 'username', target_value: 'synthetic-person', public_sources, people_data_labs: { record: { name: 'ONLY_PDL_EVIDENCE' } }, harmless_fixture: 'RETAIN_THIS_CONTEXT' };
  const original = structuredClone(input);
  await enhanceWithAI(input, { summary: 'Synthetic analysis only' });
  assert.ok(payload); const serialized = JSON.stringify(payload);
  for (const provider of allIDs) assert.ok(!serialized.includes(`ONLY_${provider}_EVIDENCE`));
  assert.ok(!serialized.includes('public_sources')); assert.ok(!serialized.includes('ONLY_PDL_EVIDENCE'));
  assert.ok(serialized.includes('RETAIN_THIS_CONTEXT')); assert.deepEqual(input, original);
});

async function components() {
  const options = await load('../src/components/NewInvestigation/PublicSourceOptions.jsx', catalogue, { jsx: true });
  const results = await load('../src/components/InvestigationDetail/PublicSourceResults.jsx', catalogue, { jsx: true });
  return { ...options, ...results };
}

function nodes(element) {
  if (!React.isValidElement(element)) return [];
  return [element, ...React.Children.toArray(element.props.children).flatMap(nodes)];
}

test('actual source selector renders all eight choices, defaults off and distinguishes unsupported/trial controls', async () => {
  const { PublicSourceOptions } = await components();
  const render = props => renderToStaticMarkup(React.createElement(PublicSourceOptions, { targetType: 'name', ...props }));
  const defaults = render({}); assert.equal((defaults.match(/type="checkbox"/g) || []).length, 8); assert.doesNotMatch(defaults, /checked=""/);
  for (const source of catalogue.PUBLIC_SOURCES) assert.ok(defaults.includes(source.label));
  assert.match(defaults, /Provider limits are separate from ShadowTrace credits/); assert.match(defaults, /not verified identity/);
  const selected = render({ publicSources: allIDs }); assert.equal((selected.match(/checked=""/g) || []).length, 6);
  const trial = render({ isTrial: true, publicSources: allIDs }); assert.match(trial, /<fieldset[^>]*disabled=""/); assert.doesNotMatch(trial, /checked=""/);
  const unsupported = render({ targetType: 'domain', publicSources: allIDs }); assert.doesNotMatch(unsupported, /checked=""/);
});

test('actual selection handlers select compatible sources, clear, deduplicate and uncheck', async () => {
  const { PublicSourceOptions } = await components(); const updates = [];
  const tree = PublicSourceOptions({ targetType: 'name', publicSources: ['github'], setPublicSources: value => updates.push(value) });
  const elements = nodes(tree); const buttons = elements.filter(element => element.type === 'button');
  buttons.find(button => button.props.children === 'Select compatible sources').props.onClick();
  assert.deepEqual(updates.at(-1), ['github', 'stackexchange', 'openalex', 'wikidata', 'tavily', 'exa']);
  buttons.find(button => button.props.children === 'Clear selection').props.onClick(); assert.deepEqual(updates.at(-1), []);
  const github = elements.filter(element => element.type === 'input')[0];
  github.props.onChange({ target: { checked: true } }); assert.deepEqual(updates.at(-1), ['github']);
  github.props.onChange({ target: { checked: false } }); assert.deepEqual(updates.at(-1), []);
});

test('actual report and React result component escape provider text and reject hostile links', async () => {
  const { PublicSourceResults } = await components();
  const result = { provider: 'github', status: 'candidates_found', message: '<script>message</script>', evaluated_at: '2026-11-04T00:00:00.000Z', request_started: true, truncated: true, validation: null,
    records: [{ id: '<img src=x onerror=alert(1)>', label: '<script>candidate</script>', context: '<svg onload=alert(1)>', url: 'https://github.com/synthetic-person?tracking=PRIVATE#PRIVATE' }, { id: 'bad', label: 'Hostile link', url: 'javascript:alert(1)' }] };
  const html = renderToStaticMarkup(React.createElement(PublicSourceResults, { results: [result] }));
  const report = generateReportHTML({ target_type: 'username', target_value: 'synthetic-person', public_sources: [result] }, { risk_score: 0 });
  for (const output of [html, report]) {
    assert.doesNotMatch(output, /<script>|<svg onload=|<img src=x/);
    assert.ok(output.includes('&lt;script&gt;candidate&lt;/script&gt;'));
    assert.ok(output.includes('href="https://github.com/synthetic-person"'));
    assert.doesNotMatch(output, /href="javascript:|tracking=PRIVATE|#PRIVATE/);
    assert.match(output, /noopener noreferrer/); assert.match(output, /not an exhaustive search/);
    assert.match(output, /identity or ownership/);
  }
});

test('old reports omit absent source sections, failures hide candidate arrays, false phone validation stays truthful', async () => {
  const { PublicSourceResults } = await components();
  assert.equal(renderToStaticMarkup(React.createElement(PublicSourceResults, {})), '');
  assert.doesNotMatch(generateReportHTML({ target_type: 'username', target_value: 'synthetic-person' }, { risk_score: 0 }), /Public profile sources/);
  const results = [{ provider: 'github', status: 'provider_error', message: 'Synthetic provider unavailable', records: [{ label: 'DO_NOT_SHOW_THIS', id: 'hidden', url: 'https://github.com/hidden' }] },
    { provider: 'veriphone', status: 'validated', records: [], validation: { phone_valid: false, carrier: '<script>carrier</script>' } }];
  const html = renderToStaticMarkup(React.createElement(PublicSourceResults, { results }));
  const report = generateReportHTML({ target_type: 'phone', target_value: '+12025550123', public_sources: results }, { risk_score: 0 });
  for (const output of [html, report]) {
    assert.ok(!output.includes('DO_NOT_SHOW_THIS')); assert.match(output, /Not valid/); assert.ok(!output.includes('<script>carrier</script>'));
  }
});
