import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import { enrichPeopleDataLabs } from '../src/app/api/investigations/osint/peopleDataLabs.js';
import { normalizeProcessingFlags, readStoredProcessingFlags } from '../src/app/api/investigations/utils/processingFlags.js';
import * as envelope from '../src/app/api/investigations/osint/collector/dataStructure.js';
import { generateReportHTML } from '../src/app/api/investigations/reports/generator.js';

// All transport, records and credentials below are synthetic; no external requests.
const contract = JSON.parse(await readFile(new URL('../../../../../docs/api/people-data-labs.schema.json', import.meta.url)));
const env = { PDL_ENABLED: 'true', PDL_API_KEY: 'synthetic-secret-not-a-real-key' };
const person = { status: 200, likelihood: 8, data: { id: 'fixture-person', full_name: 'Synthetic Person', job_title: 'Engineer' } };
const company = { status: 200, likelihood: 9, id: 'fixture-company', name: 'Synthetic Company', website: 'example.invalid', founded: 2000 };
const requested = { includePeopleDataLabs: true };

// Small dependency-free validator for every keyword used by this checked-in schema.
function matches(value, schema) {
  const type = value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value;
  if (schema.type && ![].concat(schema.type).some(t => t === type || (t === 'integer' && Number.isInteger(value)))) return false;
  if ('const' in schema && value !== schema.const) return false;
  if (schema.enum && !schema.enum.includes(value)) return false;
  if (schema.allOf && !schema.allOf.every(s => matches(value, s))) return false;
  if (schema.if && !matches(value, matches(value, schema.if) ? schema.then ?? {} : schema.else ?? {})) return false;
  if (typeof value === 'number' && ((schema.minimum !== undefined && value < schema.minimum) || (schema.maximum !== undefined && value > schema.maximum))) return false;
  if (typeof value === 'string') {
    if (schema.minLength !== undefined && value.length < schema.minLength) return false;
    if (schema.maxLength !== undefined && value.length > schema.maxLength) return false;
    if (schema.format === 'date-time' && !Number.isFinite(Date.parse(value))) return false;
  }
  if (type === 'object') {
    if (schema.required?.some(key => !Object.hasOwn(value, key))) return false;
    if (schema.minProperties !== undefined && Object.keys(value).length < schema.minProperties) return false;
    if (schema.propertyNames && Object.keys(value).some(key => !matches(key, schema.propertyNames))) return false;
    if (schema.additionalProperties === false && Object.keys(value).some(key => !Object.hasOwn(schema.properties ?? {}, key))) return false;
    if (Object.entries(schema.properties ?? {}).some(([key, s]) => Object.hasOwn(value, key) && !matches(value[key], s))) return false;
  }
  return true;
}

async function lookup({ type = 'email', value = 'synthetic@example.invalid', options = requested, config = env, body = person, status = 200, fetchImpl, timeoutMs } = {}) {
  let calls = 0;
  const result = await enrichPeopleDataLabs(type, value, options, {
    env: config, timeoutMs,
    fetchImpl: async (...args) => { calls++; return fetchImpl ? fetchImpl(...args) : Response.json(body, { status }); },
  });
  assert.ok(matches(result, contract), `Contract violation: ${JSON.stringify(result)}`);
  assert.ok(!JSON.stringify(result).includes(env.PDL_API_KEY));
  return { result, calls };
}

test('contract rejects contradictory states and kind-specific field leakage', async () => {
  const { result } = await lookup();
  for (const patch of [{ record: null }, { likelihood: null }, { likelihood: 5 }, { kind: null }, { record: {} }, { record: { website: 'example.invalid' } }, { status: 'no_match' }, { record: { full_name: '' } }]) {
    assert.equal(matches({ ...result, ...patch }, contract), false);
  }
});

test('explicit opt-in, enable flag and key are all required; no default requests', async () => {
  for (const options of [{}, { includePeopleDataLabs: false }, { includePeopleDataLabs: 'true' }]) {
    const out = await lookup({ options }); assert.equal(out.result.status, 'not_requested'); assert.equal(out.calls, 0);
  }
  for (const config of [{}, { PDL_API_KEY: env.PDL_API_KEY }, { PDL_ENABLED: 'true' }, { ...env, PDL_ENABLED: 'false' }, { ...env, PDL_API_KEY: ' ' }]) {
    const out = await lookup({ config }); assert.equal(out.result.status, 'not_configured'); assert.equal(out.calls, 0);
  }
});

test('unsupported and malformed identifiers never contact the provider', async () => {
  for (const type of ['phone', 'username', 'ip', 'license_plate']) {
    const out = await lookup({ type }); assert.equal(out.result.status, 'unsupported_target'); assert.equal(out.calls, 0);
  }
  for (const [type, value] of [['email', '12345'], ['email', 'x..y@example.invalid'], ['email', 'x\n@example.invalid'], ['domain', 'https://example.invalid/x'], ['domain', '127.0.0.1'], ['domain', 'localhost'], ['domain', '-example.invalid'], ['domain', 'example.invalid?api_key=bad']]) {
    const out = await lookup({ type, value }); assert.equal(out.result.status, 'invalid_target'); assert.equal(out.calls, 0);
  }
});

test('person request uses fixed v5 endpoint, header-only key, projection, no redirect/retry', async () => {
  const out = await lookup({ fetchImpl: async (address, options) => {
    const url = new URL(address);
    assert.equal(url.origin, 'https://api.peopledatalabs.com');
    assert.equal(url.pathname, '/v5/person/enrich');
    assert.equal(url.searchParams.get('email'), 'synthetic@example.invalid');
    assert.equal(url.searchParams.get('min_likelihood'), '6');
    assert.equal(url.searchParams.get('data_include'), 'id,full_name,linkedin_url,job_title,job_company_name,job_company_website,industry');
    assert.equal(url.searchParams.get('api_key'), null);
    assert.equal(options.headers['X-Api-Key'], env.PDL_API_KEY);
    assert.equal(options.redirect, 'error'); assert.equal(options.cache, 'no-store');
    return Response.json(person);
  } });
  assert.equal(out.calls, 1); assert.equal(out.result.kind, 'person'); assert.equal(out.result.status, 'matched');
});

test('company uses the top-level envelope, not person data; filters out personal fields', async () => {
  const { result } = await lookup({ type: 'domain', value: 'example.invalid', fetchImpl: async address => {
    const url = new URL(address); assert.equal(url.pathname, '/v5/company/enrich'); assert.equal(url.searchParams.get('website'), 'example.invalid');
    return Response.json({ ...company, emails: ['private@example.invalid'], location: { street_address: 'PRIVATE' }, full_name: 'PRIVATE', data: person.data });
  } });
  assert.deepEqual(result.record, { id: 'fixture-company', name: 'Synthetic Company', website: 'example.invalid', founded: 2000 });
  assert.equal(result.kind, 'company');
});

test('person output excludes contact/home/demographic fields even if provider ignores projection', async () => {
  const { result } = await lookup({ body: { ...person, data: { ...person.data, mobile_phone: 'PRIVATE', emails: ['PRIVATE'], location_street_address: 'PRIVATE', birth_date: 'PRIVATE', sex: 'PRIVATE', name: 'COMPANY_ONLY', job_company_name: ' ', industry: 'x'.repeat(600), linkedin_url: env.PDL_API_KEY } } });
  assert.equal(result.record.industry.length, 300);
  assert.ok(!JSON.stringify(result).includes('PRIVATE')); assert.ok(!JSON.stringify(result).includes('COMPANY_ONLY'));
  assert.equal(result.record.job_company_name, undefined); assert.equal(result.record.linkedin_url, undefined);
});

for (const [status, expected] of [[404, 'no_match'], [401, 'authentication_error'], [403, 'authentication_error'], [429, 'rate_limited'], [400, 'provider_error'], [402, 'provider_error'], [422, 'provider_error'], [500, 'provider_error'], [302, 'provider_error']]) {
  test(`HTTP ${status} is truthful, nonfatal and never exposes provider error text`, async () => {
    const out = await lookup({ status, body: { error: env.PDL_API_KEY + ' private target' } });
    assert.equal(out.result.status, expected); assert.equal(out.result.record, null); assert.equal(out.calls, 1);
  });
}

test('low likelihood is no match, never a verified profile', async () => {
  const { result } = await lookup({ body: { ...person, likelihood: 5 } });
  assert.equal(result.status, 'no_match'); assert.equal(result.record, null); assert.equal(result.likelihood, null);
});

test('malformed envelopes and wrong field types never become matches', async () => {
  for (const body of [null, [], {}, { ...person, likelihood: '8' }, { ...person, likelihood: 11 }, { ...person, status: 404 }, { ...person, data: [] }, { ...person, data: {} }, { ...person, data: { full_name: 99 } }, company]) {
    assert.equal((await lookup({ body })).result.status, 'invalid_response');
  }
  assert.equal((await lookup({ fetchImpl: async () => new Response('not-json') })).result.status, 'invalid_response');
});

test('streamed and declared oversized responses are rejected', async () => {
  for (const response of [new Response('x'.repeat(131073)), new Response('{}', { headers: { 'content-length': '131073' } })]) {
    assert.equal((await lookup({ fetchImpl: async () => response })).result.status, 'invalid_response');
  }
});

test('timeout covers both stalled headers and stalled response body; no retries', async () => {
  for (const stalled of [() => new Promise(() => {}), async () => new Response(new ReadableStream({ start() {} }))]) {
    const out = await lookup({ timeoutMs: 10, fetchImpl: stalled });
    assert.equal(out.result.status, 'timeout'); assert.equal(out.calls, 1);
  }
});

test('network errors never leak keys, target identifiers or throw out of the collector', async () => {
  const out = await lookup({ fetchImpl: async () => { throw new Error(env.PDL_API_KEY + ' synthetic@example.invalid'); } });
  assert.equal(out.result.status, 'provider_error'); assert.equal(out.calls, 1);
  assert.ok(!JSON.stringify(out.result).includes('synthetic@example.invalid'));
});

test('a network interruption during body consumption is a provider error, not malformed JSON', async () => {
  const out = await lookup({ fetchImpl: async () => new Response(new ReadableStream({
    start(controller) { controller.error(new TypeError('Synthetic network interruption')); },
  })) });
  assert.equal(out.result.status, 'provider_error'); assert.equal(out.calls, 1);
});

test('new flags are literal opt-in, trial-disabled; old serialized settings remain byte-equivalent', () => {
  assert.equal(normalizeProcessingFlags({ include_people_data_labs: true }).includePeopleDataLabs, true);
  for (const value of [undefined, false, 'true', 1]) assert.equal(normalizeProcessingFlags({ include_people_data_labs: value }).includePeopleDataLabs, false);
  assert.equal(normalizeProcessingFlags({ include_people_data_labs: true }, true).includePeopleDataLabs, false);
  const legacy = normalizeProcessingFlags({}); delete legacy.includePeopleDataLabs;
  const serialized = JSON.stringify(legacy);
  assert.equal(JSON.stringify(readStoredProcessingFlags(serialized)), serialized);
  assert.equal(readStoredProcessingFlags({ ...legacy, includePeopleDataLabs: 'true' }), null);
});

async function load(relative, bindings = {}, jsx = false) {
  let source = await readFile(new URL(relative, import.meta.url), 'utf8');
  source = source.replace(/^import[\s\S]*?from ["'][^"']+["'];?\s*/gm, '');
  if (jsx) source = ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.React, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  const key = '__pdl_' + randomUUID(); globalThis[key] = { React, ...bindings };
  source = `const { ${Object.keys(globalThis[key]).join(', ')} } = globalThis[${JSON.stringify(key)}];\n` + source;
  try { return await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64')); }
  finally { delete globalThis[key]; }
}

test('real collector retains separate provider provenance and continues on no-match', async () => {
  const source = await readFile(new URL('../src/app/api/investigations/osint/collector.js', import.meta.url), 'utf8');
  const names = [...source.matchAll(/import\s*\{([^}]+)\}/g)].flatMap(match => match[1].split(',').map(v => v.trim()).filter(Boolean));
  const bindings = Object.fromEntries(names.map(name => [name, async () => {}]));
  Object.assign(bindings, envelope, { collectPublicSources: async () => [], enrichPeopleDataLabs: (...args) => enrichPeopleDataLabs(...args, { env, fetchImpl: async () => Response.json({}, { status: 404 }) }) });
  const { collectOSINT } = await load('../src/app/api/investigations/osint/collector.js', bindings);
  const result = await collectOSINT('email', 'synthetic@example.invalid', requested);
  assert.equal(result.people_data_labs.status, 'no_match'); assert.equal(result.error, undefined);
  assert.deepEqual(result.email_seeds, []); assert.deepEqual(result.phone_seeds, []);
  assert.deepEqual(result.discovered_urls, []); assert.ok(matches(result.people_data_labs, contract));
});

test('static wiring: both processors forward explicit opt-in to collection and call persistence', async () => {
  for (const [path, sourceName] of [['[id]/tick/route.js', 'flags'], ['processing/processor.js', 'options']]) {
    const source = await readFile(new URL('../src/app/api/investigations/' + path, import.meta.url), 'utf8');
    assert.ok(source.includes(`includePeopleDataLabs: ${sourceName}.includePeopleDataLabs === true`));
    assert.match(source, /await insertOSINTData\(sql, (?:inv\.id|investigationId), osintData\)/);
  }
});

test('external AI request excludes PDL records and leaves original input intact', async () => {
  let payload;
  const { enhanceWithAI } = await load('../src/app/api/investigations/analysis/llm/anthropicEnhancer.js', {
    fetch: async (_url, options) => { payload = JSON.parse(options.body); return Response.json({ choices: [] }); },
  });
  const input = { target_type: 'domain', target_value: 'example.invalid', people_data_labs: { record: { name: 'PDL_ONLY_MARKER' } } };
  await enhanceWithAI(input, { summary: 'fixture' });
  assert.ok(payload); assert.ok(!JSON.stringify(payload).includes('PDL_ONLY_MARKER')); assert.ok(!JSON.stringify(payload).includes('people_data_labs'));
  assert.equal(input.people_data_labs.record.name, 'PDL_ONLY_MARKER');
});

test('React and HTML reports escape provider data and keep uncertainty visible', async () => {
  const { result } = await lookup({ body: { ...person, data: { full_name: '<script>synthetic</script>' } } });
  const { PeopleDataLabsResult } = await load('../src/components/InvestigationDetail/PeopleDataLabsResult.jsx', {}, true);
  const html = renderToStaticMarkup(React.createElement(PeopleDataLabsResult, { result }));
  const report = generateReportHTML({ target_type: 'email', target_value: 'synthetic@example.invalid', people_data_labs: result }, { risk_score: 0 });
  for (const output of [html, report]) {
    assert.ok(!output.includes('<script>synthetic</script>')); assert.match(output, /&lt;script&gt;synthetic/);
    assert.match(output, /not independently verified/); assert.match(output, /People Data Labs/);
  }
  assert.equal(renderToStaticMarkup(React.createElement(PeopleDataLabsResult, {})), '');
});

test('form opt-in defaults off and explains separate provider credits; disabled for trial/unsupported targets', async () => {
  const empty = () => null;
  const { InvestigationForm } = await load('../src/components/NewInvestigation/InvestigationForm.jsx', {
    TargetTypeSelector: empty, TargetValueInput: empty, SearchOptions: empty, AdvancedOptions: empty, PublicSourceOptions: empty,
    targetTypes: [{ value: 'domain' }, { value: 'phone' }],
  }, true);
  const render = props => renderToStaticMarkup(React.createElement(InvestigationForm, { targetType: 'domain', targetValue: 'example.invalid', user: {}, hasUnlimitedCredits: true, ...props }));
  assert.match(render({}), /Provider credits are separate/); assert.doesNotMatch(render({}), /checked=""/);
  assert.match(render({ includePeopleDataLabs: true }), /checked=""/);
  for (const props of [{ isTrial: true }, { targetType: 'phone' }]) {
    const html = render({ ...props, includePeopleDataLabs: true }); assert.match(html, /disabled=""/); assert.doesNotMatch(html, /checked=""/);
  }
});
