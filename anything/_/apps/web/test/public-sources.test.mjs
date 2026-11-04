import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { collectPublicSources } from '../src/app/api/investigations/osint/publicSources.js';

// These are synthetic fixtures. Every transport and durable store is injected;
// this suite neither calls providers nor proves live PostgreSQL concurrency.
const schema = JSON.parse(await readFile(new URL('../../../../../docs/api/public-sources.schema.json', import.meta.url), 'utf8'));
const providers = ['github', 'bluesky', 'stackexchange', 'openalex', 'wikidata', 'tavily', 'exa', 'veriphone'];
const secrets = {
  OPENALEX_API_KEY: 'synthetic-openalex-secret', TAVILY_API_KEY: 'synthetic-tavily-secret',
  EXA_API_KEY: 'synthetic-exa-secret', VERIPHONE_API_KEY: 'synthetic-veriphone-secret',
};
const env = { PUBLIC_SOURCES_ENABLED: 'true', ...secrets,
  ...Object.fromEntries(providers.map(id => [`PUBLIC_SOURCE_${id.toUpperCase()}_ENABLED`, 'true'])) };
const did = 'did:plc:abcdefghijklmnopqrstuvwx';
const fixtures = {
  github: { id: 123, login: 'synthetic-person', type: 'User', name: 'Synthetic Person', company: 'Fixture Company', email: 'PRIVATE', location: 'PRIVATE', bio: 'PRIVATE' },
  bluesky: { did, handle: 'synthetic.example.invalid', displayName: 'Synthetic Person', description: 'PRIVATE', avatar: 'https://private.invalid/image' },
  stackexchange: { items: [{ user_id: 123, account_id: 456, display_name: 'Synthetic Person', link: 'https://untrusted.invalid', about_me: 'PRIVATE', location: 'PRIVATE', age: 99 }], has_more: false, quota_remaining: 9999 },
  openalex: { results: [{ id: 'https://openalex.org/A123', display_name: 'Synthetic Person', last_known_institutions: [{ display_name: 'Fixture University', country_code: 'PRIVATE' }], orcid: 'PRIVATE', birth_date: 'PRIVATE' }], meta: { count: 1 } },
  wikidata: { success: 1, search: [{ id: 'Q123', label: 'Synthetic Person', description: 'PRIVATE', url: 'https://untrusted.invalid' }] },
  tavily: { results: [{ title: 'Synthetic Person', url: 'https://github.com/synthetic-person?tracking=PRIVATE#PRIVATE', content: 'PRIVATE', score: 0.99 }], answer: 'PRIVATE', images: ['PRIVATE'] },
  exa: { results: [{ id: 'https://linkedin.com/in/synthetic-person', title: 'Synthetic Person', url: 'https://linkedin.com/in/synthetic-person?tracking=PRIVATE#PRIVATE', text: 'PRIVATE', highlights: ['PRIVATE'] }] },
  veriphone: { status: 'success', phone_valid: true, phone_type: 'mobile', country_code: 'US', carrier: 'Fixture Carrier', phone: 'PRIVATE', phone_region: 'PRIVATE', country: 'PRIVATE' },
};
const human = { entities: { Q123: { id: 'Q123', claims: { P31: [{ rank: 'normal', mainsnak: { snaktype: 'value', datavalue: { value: { id: 'Q5' } } } }], P569: [{ private: 'PRIVATE' }] } } }, success: 1 };
const targets = {
  github: ['username', 'synthetic-person'], bluesky: ['username', 'synthetic.example.invalid'],
  stackexchange: ['name', 'Synthetic Person'], openalex: ['name', 'Synthetic Person'],
  wikidata: ['name', 'Synthetic Person'], tavily: ['name', 'Synthetic Person'],
  exa: ['name', 'Synthetic Person'], veriphone: ['phone', '+12025550123'],
};

// All keywords in the checked-in schema are covered here; no validation install.
function conforms(value, spec) {
  const type = value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value;
  if (spec.type && ![].concat(spec.type).some(t => t === type || (t === 'integer' && Number.isInteger(value)))) return false;
  if ('const' in spec && value !== spec.const) return false;
  if (spec.enum && !spec.enum.includes(value)) return false;
  if (spec.oneOf && spec.oneOf.filter(s => conforms(value, s)).length !== 1) return false;
  if (spec.allOf && !spec.allOf.every(s => conforms(value, s))) return false;
  if (spec.if && !conforms(value, conforms(value, spec.if) ? spec.then ?? {} : spec.else ?? {})) return false;
  if (type === 'string') {
    if (spec.minLength !== undefined && value.length < spec.minLength) return false;
    if (spec.maxLength !== undefined && value.length > spec.maxLength) return false;
    if (spec.pattern && !new RegExp(spec.pattern).test(value)) return false;
    if (spec.format === 'date-time' && !Number.isFinite(Date.parse(value))) return false;
    if (spec.format === 'uri') { try { new URL(value); } catch { return false; } }
  }
  if (type === 'array') {
    if (spec.minItems !== undefined && value.length < spec.minItems) return false;
    if (spec.maxItems !== undefined && value.length > spec.maxItems) return false;
    if (spec.items && !value.every(v => conforms(v, spec.items))) return false;
  }
  if (type === 'object') {
    if (spec.required?.some(key => !Object.hasOwn(value, key))) return false;
    if (spec.additionalProperties === false && Object.keys(value).some(key => !Object.hasOwn(spec.properties ?? {}, key))) return false;
    if (Object.entries(spec.properties ?? {}).some(([key, child]) => Object.hasOwn(value, key) && !conforms(value[key], child))) return false;
  }
  return true;
}

function fakeStore({ reservation = { status: 'reserved' }, saveResult = true } = {}) {
  const reservations = []; const saved = [];
  return {
    reservations, saved,
    async reserve(provider, id) { reservations.push({ provider, id }); return typeof reservation === 'function' ? reservation(provider, id) : reservation; },
    async save(provider, id, envelope, cooldownSeconds) { saved.push({ provider, id, envelope: structuredClone(envelope), cooldownSeconds }); return saveResult; },
  };
}

async function run(provider = 'github', options = {}) {
  const [defaultType, defaultValue] = targets[provider];
  const store = options.store ?? fakeStore();
  const calls = [];
  const results = await collectPublicSources(options.type ?? defaultType, options.value ?? defaultValue,
    options.options ?? { publicSources: [provider], investigationId: 7 }, {
      env: options.env ?? env, store, timeoutMs: options.timeoutMs,
      fetchImpl: async (address, init) => {
        calls.push({ url: new URL(address), init });
        if (options.fetchImpl) return options.fetchImpl(address, init);
        const body = calls.length === 2 && provider === 'wikidata' ? human : options.body ?? fixtures[provider];
        return Response.json(body, { status: options.status ?? 200, headers: options.headers });
      },
    });
  assert.ok(Array.isArray(results));
  for (const result of results) {
    assert.ok(conforms(result, schema), `Contract violation: ${JSON.stringify(result)}`);
    for (const secret of Object.values(secrets)) assert.ok(!JSON.stringify(result).includes(secret), 'Result leaks a provider key');
  }
  return { result: results[0], results, calls, store };
}

test('unselected/unknown/non-array providers cannot initiate requests', async () => {
  for (const publicSources of [undefined, [], 'github', ['unknown'], ['github', 1], Array(9).fill('github')]) {
    const out = await run('github', { options: { publicSources, investigationId: 7 } });
    assert.deepEqual(out.results, []); assert.equal(out.calls.length, 0); assert.equal(out.store.reservations.length, 0);
  }
});

test('duplicate source selections run once', async () => {
  const out = await run('github', { options: { publicSources: ['github', 'github'], investigationId: 7 } });
  assert.equal(out.results.length, 1); assert.equal(out.calls.length, 1); assert.equal(out.store.reservations.length, 1);
});

test('global and per-provider literal enable flags gate every source before reservation', async () => {
  for (const provider of providers) {
    for (const config of [{}, { ...env, PUBLIC_SOURCES_ENABLED: 'false' }, { ...env, [`PUBLIC_SOURCE_${provider.toUpperCase()}_ENABLED`]: true }]) {
      const out = await run(provider, { env: config });
      assert.equal(out.result.status, 'not_configured', provider);
      assert.equal(out.result.request_started, false); assert.equal(out.calls.length, 0); assert.equal(out.store.reservations.length, 0);
    }
  }
});

test('credit-based providers require nonempty server keys; no query key fallback', async () => {
  for (const provider of ['openalex', 'tavily', 'exa', 'veriphone']) {
    for (const key of [undefined, '', '   ']) {
      const out = await run(provider, { env: { ...env, [`${provider.toUpperCase()}_API_KEY`]: key } });
      assert.equal(out.result.status, 'not_configured'); assert.equal(out.calls.length, 0); assert.equal(out.store.reservations.length, 0);
    }
  }
});

test('unsupported targets never reserve budget or contact a provider', async () => {
  for (const provider of providers) {
    for (const type of ['email', 'domain', 'ip', 'license_plate']) {
      const out = await run(provider, { type, value: 'synthetic@example.invalid' });
      assert.equal(out.result.status, 'unsupported_target', `${provider}/${type}`);
      assert.equal(out.calls.length, 0); assert.equal(out.store.reservations.length, 0);
    }
  }
});

test('malformed compatible inputs fail before reservation', async () => {
  const invalid = [
    ['github', 'username', '-bad'], ['github', 'username', 'bad--name'], ['github', 'username', '../private'],
    ['github', 'username', 'x'.repeat(40)], ['bluesky', 'username', 'plainusername'],
    ['bluesky', 'username', 'https://example.invalid'], ['bluesky', 'username', '127.0.0.1'],
    ['openalex', 'name', 'x'], ['openalex', 'name', '123456'], ['wikidata', 'name', 'Name\nOther'],
    ['tavily', 'name', 'Person site:private.invalid'], ['exa', 'username', 'name&api_key=bad'],
    ['veriphone', 'phone', '2025550123'], ['veriphone', 'phone', '+00000000000'],
  ];
  for (const [provider, type, value] of invalid) {
    const out = await run(provider, { type, value });
    assert.equal(out.result.status, 'invalid_target', `${provider}/${value}`);
    assert.equal(out.calls.length, 0); assert.equal(out.store.reservations.length, 0);
  }
});

test('name queries support Unicode and legal punctuation, not query operators', async () => {
  const out = await run('openalex', { value: "Élodie O’Neill" });
  assert.equal(out.result.status, 'candidates_found');
  assert.equal(out.calls[0].url.searchParams.get('search'), "Élodie O’Neill");
});

for (const provider of providers) {
  test(`${provider}: exact fixed origin, bounded response, projected fields and saved receipt`, async () => {
    const out = await run(provider);
    assert.equal(out.result.provider, provider);
    assert.equal(out.result.status, provider === 'veriphone' ? 'validated' : 'candidates_found');
    assert.equal(out.result.request_started, true);
    assert.equal(out.calls.length, provider === 'wikidata' ? 2 : 1);
    assert.deepEqual(out.store.reservations, [{ provider, id: 7 }]);
    assert.equal(out.store.saved.length, 1);
    assert.equal(out.store.saved[0].envelope.schema_version, 1);
    assert.deepEqual(out.store.saved[0].envelope.result, out.result);
    assert.ok(!JSON.stringify(out.result).includes('PRIVATE'));
    for (const call of out.calls) {
      assert.equal(call.url.protocol, 'https:'); assert.equal(call.init.redirect, 'error'); assert.equal(call.init.cache, 'no-store');
      assert.ok(call.init.signal instanceof AbortSignal);
      for (const secret of Object.values(secrets)) assert.ok(!call.url.toString().includes(secret));
    }
    const call = out.calls[0]; const headers = new Headers(call.init.headers);
    const expected = {
      github: ['https://api.github.com', '/users/synthetic-person'], bluesky: ['https://public.api.bsky.app', '/xrpc/app.bsky.actor.getProfile'],
      stackexchange: ['https://api.stackexchange.com', '/2.3/users'], openalex: ['https://api.openalex.org', '/authors'],
      wikidata: ['https://www.wikidata.org', '/w/api.php'], tavily: ['https://api.tavily.com', '/search'],
      exa: ['https://api.exa.ai', '/search'], veriphone: ['https://api.veriphone.io', '/v3/verify'],
    }[provider];
    assert.deepEqual([call.url.origin, call.url.pathname], expected);
    if (['github', 'bluesky', 'stackexchange', 'wikidata'].includes(provider)) assert.equal(headers.get('authorization'), null);
    if (['openalex', 'tavily', 'veriphone'].includes(provider)) assert.equal(headers.get('authorization'), `Bearer ${secrets[`${provider.toUpperCase()}_API_KEY`]}`);
    if (provider === 'exa') assert.equal(headers.get('x-api-key'), secrets.EXA_API_KEY);
  });
}

test('GitHub name search is anonymous, constrained and not marked exhaustive', async () => {
  const out = await run('github', { type: 'name', value: 'Synthetic Person', body: { items: [fixtures.github], total_count: 100, incomplete_results: true } });
  const { url, init } = out.calls[0];
  assert.equal(url.pathname, '/search/users'); assert.equal(url.searchParams.get('q'), '"Synthetic Person" in:fullname type:user');
  assert.equal(url.searchParams.get('per_page'), '5'); assert.equal(url.searchParams.get('page'), '1');
  assert.equal(new Headers(init.headers).get('authorization'), null); assert.equal(out.result.truncated, true);
  assert.equal(out.result.records[0].url, 'https://github.com/synthetic-person');
});

test('GitHub organizations are never person candidates', async () => {
  const out = await run('github', { body: { ...fixtures.github, type: 'Organization' } });
  assert.equal(out.result.status, 'no_match'); assert.deepEqual(out.result.records, []);
});

test('Bluesky uses exact handle or DID without guessing a suffix', async () => {
  const out = await run('bluesky', { value: did });
  assert.equal(out.calls[0].url.searchParams.get('actor'), did);
  assert.equal(out.result.records[0].id, did);
  assert.equal(out.result.records[0].url, `https://bsky.app/profile/${did}`);
});

test('Stack Exchange fixes site/query/page and preserves method cooldown', async () => {
  const out = await run('stackexchange', { body: { ...fixtures.stackexchange, backoff: 90, has_more: true } });
  const query = out.calls[0].url.searchParams;
  for (const [key, value] of Object.entries({ site: 'stackoverflow', inname: 'Synthetic Person', pagesize: '5', page: '1', sort: 'name', order: 'asc' })) assert.equal(query.get(key), value);
  assert.equal(query.get('key'), null); assert.equal(out.result.truncated, true);
  assert.equal(out.result.records[0].url, 'https://stackoverflow.com/users/123');
  assert.ok(out.store.saved[0].cooldownSeconds >= 90);
});

test('OpenAlex requests only author identity and professional affiliation fields', async () => {
  const out = await run('openalex'); const query = out.calls[0].url.searchParams;
  assert.equal(query.get('search'), 'Synthetic Person'); assert.equal(query.get('per_page'), '5');
  assert.equal(query.get('select'), 'id,display_name,last_known_institutions');
  assert.equal(out.result.records[0].url, 'https://openalex.org/A123');
  assert.ok(out.result.records[0].context.includes('Fixture University'));
});

test('Wikidata bounds both calls and excludes nonhuman/deprecated P31 claims', async () => {
  const search = { success: 1, search: [1, 2, 3].map(id => ({ id: `Q${id}`, label: `Synthetic ${id}` })), 'search-continue': 3 };
  const q5 = rank => ({ rank, mainsnak: { snaktype: 'value', datavalue: { value: { id: 'Q5' } } } });
  const out = await run('wikidata', { fetchImpl: async address => {
    const url = new URL(address);
    if (url.searchParams.get('action') === 'wbsearchentities') {
      for (const [key, value] of Object.entries({ type: 'item', search: 'Synthetic Person', language: 'en', uselang: 'en', limit: '5', format: 'json' })) assert.equal(url.searchParams.get(key), value);
      return Response.json(search);
    }
    assert.equal(url.searchParams.get('action'), 'wbgetentities'); assert.equal(url.searchParams.get('ids'), 'Q1|Q2|Q3'); assert.equal(url.searchParams.get('props'), 'claims');
    return Response.json({ success: 1, entities: { Q1: { claims: { P31: [q5('normal')] } }, Q2: { claims: { P31: [q5('deprecated')] } }, Q3: { claims: { P31: [{ mainsnak: { datavalue: { value: { id: 'Q43229' } } } }] } } } });
  } });
  assert.equal(out.calls.length, 2); assert.equal(out.result.records.length, 1); assert.equal(out.result.records[0].id, 'Q1'); assert.equal(out.result.truncated, true);
});

test('Wikidata never follows an arbitrary URL or makes a second call for invalid IDs', async () => {
  const out = await run('wikidata', { body: { success: 1, search: [{ id: '../private', label: 'Bad', url: 'http://127.0.0.1/' }] } });
  assert.equal(out.calls.length, 1); assert.deepEqual(out.result.records, []);
});

test('Tavily and Exa use cheapest explicit search shapes without content or automatic fan-out', async () => {
  for (const provider of ['tavily', 'exa']) {
    const out = await run(provider); const call = out.calls[0]; const body = JSON.parse(call.init.body);
    assert.equal(call.init.method, 'POST'); assert.ok(body.query.includes('"Synthetic Person"'));
    const domains = provider === 'tavily' ? body.include_domains : body.includeDomains;
    assert.ok(Array.isArray(domains) && domains.length > 0);
    assert.ok(domains.every(domain => ['github.com', 'stackoverflow.com', 'bsky.app', 'orcid.org', 'openalex.org', 'wikidata.org', 'linkedin.com'].includes(domain)));
    if (provider === 'tavily') {
      assert.equal(body.topic, 'general'); assert.equal(body.search_depth, 'basic'); assert.equal(body.max_results, 5);
      for (const field of ['auto_parameters', 'include_answer', 'include_raw_content', 'include_images']) assert.equal(body[field], false);
    } else {
      assert.equal(body.type, 'lite'); assert.equal(body.numResults, 5); assert.equal(body.category, 'people');
      for (const field of ['contents', 'outputSchema', 'text', 'highlights']) assert.equal(body[field], undefined);
    }
    assert.ok(out.result.records.every(record => !record.url.includes('?') && !record.url.includes('#')));
  }
});

test('search results reject userinfo/local/IP/suffix spoofing and retain HTTPS approved hosts only', async () => {
  const urls = ['http://github.com/bad', 'https://github.com.evil.invalid/bad', 'https://github.com@evil.invalid/bad', 'https://user:password@github.com/bad', 'https://127.0.0.1/', 'https://localhost/', 'javascript:alert(1)', 'https://unapproved.invalid/', 'https://www.linkedin.com/in/synthetic-person?secret=PRIVATE#PRIVATE'];
  for (const provider of ['tavily', 'exa']) {
    const out = await run(provider, { body: { results: urls.map(url => ({ id: url, title: 'Synthetic Person', url })) } });
    assert.ok(out.result.records.every(record => record.url === 'https://www.linkedin.com/in/synthetic-person'));
    assert.ok(!JSON.stringify(out.result).includes('PRIVATE'));
  }
});

test('Veriphone only validates the explicit international number and stores no number/owner', async () => {
  for (const valid of [true, false]) {
    const out = await run('veriphone', { body: { ...fixtures.veriphone, phone_valid: valid } });
    const query = out.calls[0].url.searchParams;
    assert.equal(query.get('phone'), '+12025550123'); assert.equal(query.get('mode'), 'static'); assert.equal(query.get('record'), 'false');
    assert.equal(out.result.status, 'validated'); assert.equal(out.result.validation.phone_valid, valid); assert.deepEqual(out.result.records, []);
    assert.ok(!JSON.stringify(out.result).includes('+12025550123'));
  }
});

for (const status of ['quota_exhausted', 'rate_limited', 'lookup_pending', 'budget_unavailable']) {
  test(`durable ${status} prevents a request and preserves truthful status`, async () => {
    const out = await run('github', { store: fakeStore({ reservation: { status } }) });
    assert.equal(out.result.status, status); assert.equal(out.calls.length, 0); assert.equal(out.result.request_started, false); assert.equal(out.store.saved.length, 0);
  });
}

test('missing/invalid investigation identity cannot initiate a request', async () => {
  for (const investigationId of [undefined, null, 0, -1, 'not-an-id', 1.5]) {
    const out = await run('github', { options: { publicSources: ['github'], investigationId } });
    assert.equal(out.calls.length, 0); assert.equal(out.result.status, 'budget_unavailable');
  }
});

test('reservation exceptions fail closed without leaking database/secret messages', async () => {
  const store = fakeStore(); store.reserve = async () => { throw new Error(secrets.EXA_API_KEY); };
  const out = await run('github', { store }); assert.equal(out.result.status, 'budget_unavailable'); assert.equal(out.calls.length, 0);
});

test('save/cooldown persistence failure removes candidates and prevents a success claim', async () => {
  for (const throws of [false, true]) {
    const store = fakeStore({ saveResult: false });
    if (throws) store.save = async () => { throw new Error(secrets.EXA_API_KEY); };
    const out = await run('github', { store });
    assert.equal(out.result.status, 'persistence_error'); assert.deepEqual(out.result.records, []); assert.equal(out.result.validation, null); assert.equal(out.calls.length, 1);
  }
});

test('cached normalized result preserves original evaluation time without another request', async () => {
  const first = await run('github'); const cached = structuredClone(first.store.saved[0].envelope);
  cached.result.evaluated_at = '2026-01-01T00:00:00.000Z';
  const out = await run('github', { store: fakeStore({ reservation: { status: 'cached', envelope: cached } }) });
  assert.equal(out.result.status, 'candidates_found'); assert.equal(out.result.evaluated_at, cached.result.evaluated_at); assert.equal(out.result.request_started, false);
  assert.equal(out.calls.length, 0); assert.equal(out.store.saved.length, 0);
});

test('outdated/malformed/cross-provider/poisoned cached results fail closed', async () => {
  const first = await run('github'); const baseline = first.store.saved[0].envelope;
  const poisoned = [
    null, { schema_version: 2, result: baseline.result }, { schema_version: 1, result: {} },
    { schema_version: 1, result: { ...baseline.result, provider: 'exa' } },
    { schema_version: 1, result: { ...baseline.result, evaluated_at: 'yesterday' } },
    { schema_version: 1, result: { ...baseline.result, leaked_key: secrets.EXA_API_KEY } },
    { schema_version: 1, result: { ...baseline.result, records: [{ id: '123', label: 'Bad', url: 'javascript:alert(1)' }] } },
    { schema_version: 1, result: { ...baseline.result, records: [{ id: '123', label: 'Bad', url: null }] } },
    { schema_version: 1, result: { ...baseline.result, records: [{ id: '123', label: 123, url: 'https://github.com/synthetic-person' }] } },
    { schema_version: 1, result: { ...baseline.result, records: [{ id: '123', label: 'Bad', url: 'https://github.com@evil.invalid' }] } },
    { schema_version: 1, result: { ...baseline.result, records: [{ id: '123', label: 'Bad', url: 'https://github.com/synthetic-person', email: 'PRIVATE' }] } },
  ];
  for (const envelope of poisoned) {
    const out = await run('github', { store: fakeStore({ reservation: { status: 'cached', envelope } }) });
    assert.equal(out.result.status, 'persistence_error'); assert.equal(out.calls.length, 0); assert.deepEqual(out.result.records, []);
  }
});

for (const [status, expected] of [[401, 'authentication_error'], [403, 'authentication_error'], [402, 'quota_exhausted'], [432, 'quota_exhausted'], [433, 'quota_exhausted'], [429, 'rate_limited'], [500, 'provider_error'], [302, 'provider_error']]) {
  test(`HTTP ${status} yields ${expected} with no retry or provider-body disclosure`, async () => {
    const out = await run('tavily', { status, body: { error: secrets.TAVILY_API_KEY + ' PRIVATE' } });
    assert.equal(out.result.status, expected); assert.equal(out.calls.length, 1); assert.deepEqual(out.result.records, []); assert.ok(!out.result.message.includes('PRIVATE'));
  });
}

test('Retry-After and GitHub exhausted-rate headers are persisted as cooldown', async () => {
  const out = await run('github', { status: 403, headers: { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': String(Math.ceil(Date.now() / 1000) + 180), 'retry-after': '120' }, body: {} });
  assert.equal(out.result.status, 'rate_limited'); assert.ok(out.store.saved[0].cooldownSeconds >= 120); assert.equal(out.calls.length, 1);
});

test('StackExchange throttle error is recognized despite HTTP400 and exhausted quota blocks later calls', async () => {
  const throttled = await run('stackexchange', { status: 400, body: { error_id: 502, error_name: 'throttle_violation', error_message: 'PRIVATE', backoff: 75 } });
  assert.equal(throttled.result.status, 'rate_limited'); assert.ok(throttled.store.saved[0].cooldownSeconds >= 75);
  const exhausted = await run('stackexchange', { body: { ...fixtures.stackexchange, quota_remaining: 0 } });
  assert.ok(exhausted.store.saved[0].cooldownSeconds > 0);
});

test('well-formed empty search responses are no_match, not claims of nonexistence', async () => {
  const empty = { github: { items: [], total_count: 0, incomplete_results: false }, stackexchange: { items: [], quota_remaining: 999, has_more: false }, openalex: { results: [], meta: { count: 0 } }, wikidata: { success: 1, search: [] }, tavily: { results: [] }, exa: { results: [] } };
  for (const [provider, body] of Object.entries(empty)) {
    const out = await run(provider, { type: 'name', value: 'Synthetic Person', body });
    assert.equal(out.result.status, 'no_match', provider); assert.deepEqual(out.result.records, []); assert.equal(out.calls.length, 1);
  }
});

for (const provider of providers) {
  test(`${provider}: malformed success envelope is invalid_response, not no_match`, async () => {
    const out = await run(provider, { body: { unexpected: true } }); assert.equal(out.result.status, 'invalid_response', provider);
  });
}
test('invalid JSON never becomes candidates', async () => {
  const invalid = await run('github', { fetchImpl: async () => new Response('not JSON') }); assert.equal(invalid.result.status, 'invalid_response');
});

test('oversized streamed and declared responses are bounded at 256KiB', async () => {
  for (const response of [new Response('x'.repeat(262145)), new Response('{}', { headers: { 'content-length': '262145' } })]) {
    const out = await run('github', { fetchImpl: async () => response }); assert.equal(out.result.status, 'invalid_response'); assert.equal(out.calls.length, 1);
  }
});

test('deadline covers stalled headers and body without retries', async () => {
  for (const fetchImpl of [() => new Promise(() => {}), async () => new Response(new ReadableStream({ start() {} }))]) {
    const out = await run('github', { fetchImpl, timeoutMs: 10 }); assert.equal(out.result.status, 'timeout'); assert.equal(out.calls.length, 1);
  }
});

test('Wikidata shares one deadline across its two requests', async () => {
  const out = await run('wikidata', { timeoutMs: 10, fetchImpl: async address => {
    if (new URL(address).searchParams.get('action') === 'wbsearchentities') return Response.json(fixtures.wikidata);
    return new Promise(() => {});
  } });
  assert.equal(out.result.status, 'timeout'); assert.equal(out.calls.length, 2); assert.deepEqual(out.result.records, []);
});

test('late Wikidata first response cannot initiate a second request after timeout', async () => {
  let release;
  const delayed = new Promise(resolve => { release = resolve; });
  const out = await run('wikidata', { timeoutMs: 5, fetchImpl: async address => {
    assert.equal(new URL(address).searchParams.get('action'), 'wbsearchentities');
    return delayed;
  } });
  assert.equal(out.result.status, 'timeout'); assert.equal(out.calls.length, 1);
  release(Response.json(fixtures.wikidata));
  await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(out.calls.length, 1); assert.equal(out.store.saved.length, 1);
});

test('network/body failures use static provider_error messages with no secret or target leakage', async () => {
  for (const fetchImpl of [async () => { throw new Error(secrets.OPENALEX_API_KEY + ' PRIVATE'); }, async () => new Response(new ReadableStream({ start(controller) { controller.error(new Error('PRIVATE')); } }))]) {
    const out = await run('openalex', { fetchImpl }); assert.equal(out.result.status, 'provider_error'); assert.ok(!out.result.message.includes('PRIVATE')); assert.equal(out.calls.length, 1);
  }
});

test('transport exception text cannot impersonate internal status tokens', async () => {
  for (const message of ['no_match', 'candidates_found', 'validated', 'INVALID_RESPONSE', 'rate_limited']) {
    const out = await run('github', { fetchImpl: async () => { throw new Error(message); } });
    assert.equal(out.result.status, 'provider_error'); assert.equal(out.calls.length, 1);
  }
});

test('Wikidata malformed second envelopes are not silently treated as zero humans', async () => {
  for (const entities of [[], 'invalid', { Q123: { claims: { P31: {} } } }]) {
    const out = await run('wikidata', { fetchImpl: async address => Response.json(
      new URL(address).searchParams.get('action') === 'wbsearchentities' ? fixtures.wikidata : { success: 1, entities }
    ) });
    assert.equal(out.result.status, 'invalid_response'); assert.deepEqual(out.result.records, []); assert.equal(out.calls.length, 2);
  }
});

test('selected adapters run at most three at once and one provider failure stays isolated', async () => {
  let active = 0; let peak = 0;
  const store = fakeStore();
  const sourceIds = ['github', 'stackexchange', 'openalex', 'wikidata', 'tavily', 'exa'];
  const results = await collectPublicSources('name', 'Synthetic Person', { publicSources: sourceIds, investigationId: 7 }, {
    env, store,
    fetchImpl: async address => {
      active++; peak = Math.max(peak, active);
      try {
        await new Promise(resolve => setTimeout(resolve, 5));
        const url = new URL(address);
        if (url.hostname === 'api.github.com') return Response.json({ items: [fixtures.github], total_count: 1, incomplete_results: false });
        if (url.hostname === 'www.wikidata.org') return Response.json(url.searchParams.get('action') === 'wbsearchentities' ? fixtures.wikidata : human);
        if (url.hostname === 'api.tavily.com') return new Response(null, { status: 500 });
        const id = { 'api.stackexchange.com': 'stackexchange', 'api.openalex.org': 'openalex', 'api.exa.ai': 'exa' }[url.hostname];
        assert.ok(id, 'Unexpected outbound host'); return Response.json(fixtures[id]);
      } finally { active--; }
    },
  });
  assert.ok(peak > 1 && peak <= 3, `Observed ${peak} concurrent requests`);
  assert.equal(results.length, sourceIds.length);
  assert.deepEqual(results.map(result => result.provider), sourceIds);
  for (const result of results) {
    assert.ok(conforms(result, schema));
    assert.equal(result.status, result.provider === 'tavily' ? 'provider_error' : 'candidates_found');
  }
});

test('provider-returned keys cannot leak through candidate fields', async () => {
  const out = await run('openalex', { body: { results: [{ ...fixtures.openalex.results[0], display_name: secrets.OPENALEX_API_KEY, last_known_institutions: [{ display_name: secrets.OPENALEX_API_KEY }] }] } });
  assert.ok(!JSON.stringify(out.result).includes(secrets.OPENALEX_API_KEY));
});

test('candidate results never exceed five records and long text remains within schema', async () => {
  const out = await run('stackexchange', { body: { ...fixtures.stackexchange, items: Array.from({ length: 12 }, (_, i) => ({ user_id: i + 1, display_name: 'x'.repeat(1000) })), has_more: true } });
  assert.equal(out.result.records.length, 5); assert.equal(out.result.truncated, true);
  assert.ok(out.result.records.every(record => record.label.length <= 300));
});

test('the contract validator rejects contradictory statuses and unexpected record fields', async () => {
  const { result } = await run('github');
  for (const patch of [{ status: 'no_match' }, { records: [] }, { validation: { phone_valid: true } }, { status: 'verified_identity' }, { extra: true }]) assert.equal(conforms({ ...result, ...patch }, schema), false);
  const phone = (await run('veriphone')).result;
  assert.equal(conforms({ ...phone, validation: { phone_valid: 'yes' } }, schema), false);
});

test('missing GitHub login cannot fabricate a github.com/undefined source', async () => {
  const out = await run('github', { type: 'name', value: 'Synthetic Person', body: { items: [{ id: 123, type: 'User', name: 'Synthetic Person' }] } });
  assert.equal(out.result.status, 'invalid_response');
  assert.deepEqual(out.result.records, []);
});

test('Bluesky rejects a trailing-hyphen DNS label before any reservation or request', async () => {
  const out = await run('bluesky', { value: 'synthetic.example.com-' });
  assert.equal(out.result.status, 'invalid_target');
  assert.equal(out.calls.length, 0); assert.equal(out.store.reservations.length, 0);
});

test('Bluesky rejects malformed returned handles too', async () => {
  const out = await run('bluesky', { body: { ...fixtures.bluesky, handle: 'synthetic.example.com-' } });
  assert.equal(out.result.status, 'invalid_response'); assert.deepEqual(out.result.records, []);
});

test('cached evaluation time must be a canonical UTC timestamp, not a parseable shorthand', async () => {
  const first = await run('github');
  for (const evaluated_at of ['1', '2026-01-01', '2026-02-31T00:00:00.000Z']) {
    const envelope = structuredClone(first.store.saved[0].envelope);
    envelope.result.evaluated_at = evaluated_at;
    const out = await run('github', { store: fakeStore({ reservation: { status: 'cached', envelope } }) });
    assert.equal(out.result.status, 'persistence_error'); assert.equal(out.calls.length, 0);
  }
});
