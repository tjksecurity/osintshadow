// Server-only. Public profiles are candidates, never identity/ownership proof.
import { PUBLIC_SOURCES, PUBLIC_PROFILE_DOMAINS, normalizePublicSources, safePublicSourceUrl, validInvestigationId } from '../../../../utils/publicSources.js';
import { normalizePhoneCandidate } from './phoneValidation.js';

const MESSAGES = Object.freeze({
  candidates_found: 'Public-source candidates, not independently verified identity or ownership. Review each original source.',
  validated: 'Number syntax/range validation only; not proof of activity, ownership or identity.',
  no_match: 'This bounded lookup returned no usable candidates. This does not establish nonexistence.',
  not_configured: 'This source is not enabled or its required server API key is missing.',
  unsupported_target: 'This source does not support the selected investigation type.',
  invalid_target: 'The identifier did not pass local syntax checks. No lookup was sent.',
  quota_exhausted: 'The configured request budget or provider allowance is exhausted. No automatic upgrade or retry.',
  rate_limited: 'A request interval or provider cooldown is active. No automatic retry.',
  lookup_pending: 'A previous lookup attempt is unresolved. It will not be sent again automatically.',
  budget_unavailable: 'Durable request-budget storage is unavailable. No provider lookup was sent.',
  persistence_error: 'The provider result could not be safely saved or recovered. No automatic repeat lookup.',
  authentication_error: 'The provider rejected the configured credentials or access.',
  provider_error: 'The provider could not complete the lookup. No automatic retry.',
  timeout: 'The lookup deadline expired. The provider may have processed the request.',
  invalid_response: 'The provider returned an unusable response. No candidates were retained.',
});
const KEY_NAMES = { openalex: 'OPENALEX_API_KEY', tavily: 'TAVILY_API_KEY', exa: 'EXA_API_KEY', veriphone: 'VERIPHONE_API_KEY' };
const USER_AGENT = 'ShadowTrace/1.0 (+https://github.com/tjksecurity/osintshadow)';
const NAME = /^(?=.*\p{L})[\p{L}\p{M} .\u2019'\-]{2,120}$/u;
const USERNAME = /^[a-z0-9_.-]{1,100}$/i;
const LOGIN = /^(?!.*--)[a-z0-9](?:[a-z0-9-]{0,37}[a-z0-9])?$/i;
const DID = /^did:plc:[a-z2-7]{24}$/;
const HANDLE = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z][a-z0-9-]{0,61}[a-z0-9]$/i;
class SourceFailure extends Error {}

function validTarget(provider, type, value) {
  if (/[\x00-\x1f\x7f]/.test(value)) return false;
  if (provider === 'veriphone') return /^\+[1-9]\d{7,14}$/.test(value) && Boolean(normalizePhoneCandidate(value, { allow_bare_input: true }));
  if (provider === 'bluesky') return DID.test(value) || (value.length <= 253 && HANDLE.test(value));
  if (type === 'name') return NAME.test(value);
  return provider === 'github' ? LOGIN.test(value) : USERNAME.test(value);
}

function scrub(value, secrets, max = 300) {
  if (typeof value !== 'string' || secrets.some(key => value.includes(key))) return '';
  return value.replace(/[\x00-\x1f\x7f]/g, ' ').trim().slice(0, max);
}
function makeRecord(id, label, url, context, secrets) {
  const safeId = scrub(String(id ?? ''), secrets, 500);
  const safeLabel = scrub(label, secrets);
  const href = safePublicSourceUrl(scrub(url, secrets, 1000));
  if (!safeId || !safeLabel || !href) return null;
  const result = { id: safeId, label: safeLabel, url: href };
  const detail = scrub(context, secrets);
  if (detail) result.context = detail;
  return result;
}

function cacheResult(envelope, provider, secrets) {
  if (envelope?.schema_version !== 1) return null;
  const r = envelope.result;
  if (!r || r.provider !== provider || !Object.hasOwn(MESSAGES, r.status) ||
    typeof r.request_started !== 'boolean' || typeof r.truncated !== 'boolean' ||
    typeof r.evaluated_at !== 'string' || !Number.isFinite(Date.parse(r.evaluated_at)) || new Date(r.evaluated_at).toISOString() !== r.evaluated_at ||
    typeof r.message !== 'string' || r.message !== MESSAGES[r.status] ||
    Object.keys(r).some(k => !['provider','status','message','evaluated_at','request_started','truncated','records','validation'].includes(k)) ||
    !Array.isArray(r.records) || r.records.length > 5 ||
    secrets.some(secret => JSON.stringify(r).includes(secret))) return null;
  if (r.records.some(item => !item || Object.keys(item).some(k => !['id','label','url','context'].includes(k)) ||
    typeof item.id !== 'string' || !item.id || item.id.length > 500 || typeof item.label !== 'string' || !item.label || item.label.length > 300 ||
    (item.context !== undefined && (typeof item.context !== 'string' || item.context.length > 300)) || typeof item.url !== 'string' || !item.url || safePublicSourceUrl(item.url) !== item.url)) return null;
  if ((r.status === 'candidates_found') !== (r.records.length > 0)) return null;
  if (r.status === 'validated') {
    if (provider !== 'veriphone' || !r.validation || typeof r.validation.phone_valid !== 'boolean' ||
      Object.keys(r.validation).some(k => !['phone_valid','phone_type','country_code','carrier'].includes(k)) ||
      Object.entries(r.validation).some(([k,v]) => k !== 'phone_valid' && (typeof v !== 'string' || v.length > 100))) return null;
  } else if (r.validation !== null) return null;
  return { ...r, request_started: false };
}

async function readJSON(response) {
  if (!response.body || Number(response.headers.get('content-length')) > 262144) throw new SourceFailure('INVALID_RESPONSE');
  const reader = response.body.getReader(); const chunks = []; let size = 0;
  try {
    while (true) {
      const next = await reader.read(); if (next.done) break;
      size += next.value.byteLength; if (size > 262144) throw new SourceFailure('INVALID_RESPONSE');
      chunks.push(next.value);
    }
    const bytes = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    try { return JSON.parse(new TextDecoder().decode(bytes)); } catch { throw new SourceFailure('INVALID_RESPONSE'); }
  } finally { void reader.cancel().catch(() => {}); }
}

function retrySeconds(response, provider) {
  const h = response.headers;
  const retry = h.get('retry-after');
  let seconds = retry ? (/^\d+(?:\.\d+)?$/.test(retry) ? Number(retry) : (Date.parse(retry) - Date.now()) / 1000) : 0;
  if (h.get('x-ratelimit-remaining') === '0') {
    const reset = Number(h.get('x-ratelimit-reset'));
    const delay = provider === 'openalex' ? reset : reset - Date.now() / 1000;
    seconds = Math.max(Number.isFinite(seconds) ? seconds : 0, Number.isFinite(delay) && delay > 0 ? delay : 3600);
  }
  return Number.isFinite(seconds) ? Math.max(0, Math.min(2678400, Math.ceil(seconds))) : 0;
}

function requestSpec(provider, type, value, key) {
  let url, body;
  const headers = { Accept: 'application/json', 'User-Agent': USER_AGENT };
  const setUrl = (base, params) => { url = new URL(base); if (params) url.search = new URLSearchParams(params).toString(); };
  switch (provider) {
    case 'github':
      headers.Accept = 'application/vnd.github+json';
      headers['X-GitHub-Api-Version'] = '2026-03-10';
      if (type === 'username') setUrl('https://api.github.com/users/' + encodeURIComponent(value));
      else setUrl('https://api.github.com/search/users', { q: `"${value}" in:fullname type:user`, per_page: '5', page: '1' });
      break;
    case 'bluesky': setUrl('https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile', { actor: value }); break;
    case 'stackexchange': setUrl('https://api.stackexchange.com/2.3/users', { site: 'stackoverflow', inname: value, pagesize: '5', page: '1', sort: 'name', order: 'asc' }); break;
    case 'openalex':
      headers.Authorization = `Bearer ${key}`;
      setUrl('https://api.openalex.org/authors', { search: value, per_page: '5', select: 'id,display_name,last_known_institutions' }); break;
    case 'wikidata': setUrl('https://www.wikidata.org/w/api.php', { action: 'wbsearchentities', search: value, language: 'en', uselang: 'en', type: 'item', limit: '5', format: 'json' }); break;
    case 'tavily':
      headers.Authorization = `Bearer ${key}`; setUrl('https://api.tavily.com/search');
      body = { query: `"${value}" public professional profile`, topic: 'general', search_depth: 'basic', max_results: 5, auto_parameters: false, include_answer: false, include_raw_content: false, include_images: false, include_image_descriptions: false, include_favicon: false, include_domains: PUBLIC_PROFILE_DOMAINS }; break;
    case 'exa':
      headers['x-api-key'] = key; setUrl('https://api.exa.ai/search');
      body = { query: `"${value}" professional profile`, type: 'lite', numResults: 5, category: 'people', includeDomains: PUBLIC_PROFILE_DOMAINS }; break;
    case 'veriphone':
      headers.Authorization = `Bearer ${key}`; setUrl('https://api.veriphone.io/v3/verify', { phone: value, mode: 'static', record: 'false' }); break;
  }
  if (body) headers['Content-Type'] = 'application/json';
  return { url: url.href, init: { method: body ? 'POST' : 'GET', headers, ...(body ? { body: JSON.stringify(body) } : {}) } };
}

async function lookup(provider, type, value, options, runtime) {
  const env = runtime.env ?? process.env;
  const secrets = Object.values(KEY_NAMES).map(name => env[name]).filter(key => typeof key === 'string' && key.trim()).map(key => key.trim());
  const result = (status, extra = {}) => ({ provider, status, message: MESSAGES[status], evaluated_at: new Date().toISOString(), request_started: false, truncated: false, records: [], validation: null, ...extra });
  const definition = PUBLIC_SOURCES.find(source => source.id === provider);
  if (!definition.targets.includes(type)) return result('unsupported_target');
  const input = typeof value === 'string' ? value.trim() : '';
  if (!validTarget(provider, type, input)) return result('invalid_target');
  const key = typeof env[KEY_NAMES[provider]] === 'string' ? env[KEY_NAMES[provider]].trim() : '';
  if (env.PUBLIC_SOURCES_ENABLED !== 'true' || env[`PUBLIC_SOURCE_${provider.toUpperCase()}_ENABLED`] !== 'true' || (KEY_NAMES[provider] && !key)) return result('not_configured');
  const store = runtime.store;
  if (typeof store?.reserve !== 'function' || typeof store?.save !== 'function' || !validInvestigationId(options.investigationId)) return result('budget_unavailable');
  let reservation;
  try { reservation = await store.reserve(provider, options.investigationId); } catch { return result('budget_unavailable'); }
  if (reservation?.status === 'cached') return cacheResult(reservation.envelope, provider, secrets) ?? result('persistence_error');
  if (reservation?.status !== 'reserved') return result(['quota_exhausted','rate_limited','lookup_pending','budget_unavailable'].includes(reservation?.status) ? reservation.status : 'budget_unavailable');
  const controller = new AbortController(); let timer, expired = false, started = false, cooldown = 0;
  const output = (status, extra = {}) => result(status, { request_started: started, ...extra });
  const send = async (url, init) => {
    if (expired || controller.signal.aborted) throw new SourceFailure('timeout');
    started = true;
    const response = await (runtime.fetchImpl ?? globalThis.fetch)(url, { ...init, redirect: 'error', cache: 'no-store', signal: controller.signal });
    cooldown = Math.max(cooldown, retrySeconds(response, provider));
    if (response.status !== 200) {
      if (provider === 'stackexchange' && response.status === 400) {
        const body = await readJSON(response);
        if (Number.isFinite(body?.backoff) && body.backoff > 0) cooldown = Math.max(cooldown, body.backoff);
        throw new SourceFailure(body?.error_id === 502 ? 'rate_limited' : 'provider_error');
      }
      void response.body?.cancel().catch(() => {});
      if ([402,432,433].includes(response.status)) { cooldown = Math.max(cooldown, 86400); throw new SourceFailure('quota_exhausted'); }
      if (response.status === 429 || (response.status === 403 && cooldown > 0)) { cooldown = Math.max(cooldown, 60); throw new SourceFailure('rate_limited'); }
      if ([401,403].includes(response.status)) throw new SourceFailure('authentication_error');
      if (response.status === 404 && ['github','bluesky'].includes(provider)) throw new SourceFailure('no_match');
      throw new SourceFailure('provider_error');
    }
    const body = await readJSON(response);
    if (expired || controller.signal.aborted) throw new SourceFailure('timeout');
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new SourceFailure('INVALID_RESPONSE');
    return body;
  };
  const work = async () => {
    const spec = requestSpec(provider, type, input, key);
    const body = await send(spec.url, spec.init);
    let items, truncated = false;
    const record = (id, label, url, context) => makeRecord(id, label, url, context, secrets);
    switch (provider) {
      case 'github':
        if (type === 'username' && (!Number.isSafeInteger(body.id) || typeof body.login !== 'string' || !LOGIN.test(body.login) || typeof body.type !== 'string')) throw new SourceFailure('INVALID_RESPONSE');
        items = type === 'username' ? [body] : body.items; truncated = body.incomplete_results === true || (Number(body.total_count) > 5);
        if (!Array.isArray(items)) throw new SourceFailure('INVALID_RESPONSE');
        if (items.slice(0,5).some(item => !Number.isSafeInteger(item?.id) || typeof item.login !== 'string' || !LOGIN.test(item.login) || typeof item.type !== 'string')) throw new SourceFailure('INVALID_RESPONSE');
        items = items.slice(0,5).filter(item => item.type === 'User').map(item => record(item.id, item.name || item.login, `https://github.com/${item.login}`, item.company)); break;
      case 'bluesky':
        if (!DID.test(body.did) || typeof body.handle !== 'string' || !HANDLE.test(body.handle)) throw new SourceFailure('INVALID_RESPONSE');
        items = [record(body.did, body.displayName || body.handle, `https://bsky.app/profile/${body.did}`, body.handle)]; break;
      case 'stackexchange':
        if (Number.isFinite(body.backoff) && body.backoff > 0) cooldown = Math.max(cooldown, Math.ceil(body.backoff));
        if (body.quota_remaining === 0) cooldown = Math.max(cooldown, 86400);
        if (body.error_id) throw new SourceFailure(body.error_id === 502 ? 'rate_limited' : 'provider_error');
        if (!Array.isArray(body.items)) throw new SourceFailure('INVALID_RESPONSE');
        truncated = body.has_more === true || body.items.length > 5;
        items = body.items.slice(0,5).filter(item => Number.isSafeInteger(item?.user_id) && item.user_id > 0).map(item => record(item.user_id, item.display_name, `https://stackoverflow.com/users/${item.user_id}`)); break;
      case 'openalex':
        if (!Array.isArray(body.results)) throw new SourceFailure('INVALID_RESPONSE');
        truncated = Number(body.meta?.count) > 5 || body.results.length > 5;
        items = body.results.slice(0,5).filter(item => /^https:\/\/openalex\.org\/A[1-9]\d*$/.test(item?.id)).map(item => record(item.id, item.display_name, item.id, Array.isArray(item.last_known_institutions) ? item.last_known_institutions.slice(0,3).map(i => scrub(i?.display_name, secrets)).filter(Boolean).join('; ') : '')); break;
      case 'wikidata': {
        if (body.success !== 1 || !Array.isArray(body.search)) throw new SourceFailure('INVALID_RESPONSE');
        truncated = body['search-continue'] !== undefined || body.search.length > 5;
        const found = body.search.slice(0,5).filter(item => /^Q[1-9]\d*$/.test(item?.id));
        if (!found.length) { items = []; break; }
        const url = new URL('https://www.wikidata.org/w/api.php');
        url.search = new URLSearchParams({ action: 'wbgetentities', ids: found.map(i => i.id).join('|'), props: 'claims', format: 'json' }).toString();
        const entityBody = await send(url.href, { method: 'GET', headers: spec.init.headers });
        if (entityBody.success !== 1 || !entityBody.entities || typeof entityBody.entities !== 'object' || Array.isArray(entityBody.entities)) throw new SourceFailure('INVALID_RESPONSE');
        if (found.some(item => {
          const entity = entityBody.entities[item.id];
          return !entity || (entity.missing === undefined && (!entity.claims || typeof entity.claims !== 'object' ||
            (entity.claims.P31 !== undefined && !Array.isArray(entity.claims.P31))));
        })) throw new SourceFailure('INVALID_RESPONSE');
        items = found.filter(item => (Array.isArray(entityBody.entities[item.id]?.claims?.P31) ? entityBody.entities[item.id].claims.P31 : []).some(claim => claim.rank !== 'deprecated' && claim.mainsnak?.snaktype === 'value' && claim.mainsnak.datavalue?.value?.id === 'Q5')).map(item => record(item.id, item.label, `https://www.wikidata.org/wiki/${item.id}`)); break;
      }
      case 'tavily': case 'exa':
        if (!Array.isArray(body.results)) throw new SourceFailure('INVALID_RESPONSE');
        truncated = body.results.length >= 5; // One bounded page, no exhaustiveness claim.
        items = body.results.slice(0,5).map(item => { const url = safePublicSourceUrl(item?.url); return url ? record(url, item.title, url) : null; }); break;
      case 'veriphone': {
        if (body.status !== 'success' || typeof body.phone_valid !== 'boolean') throw new SourceFailure('INVALID_RESPONSE');
        const validation = { phone_valid: body.phone_valid };
        for (const field of ['phone_type','country_code','carrier']) { const val = scrub(body[field], secrets, 100); if (val) validation[field] = val; }
        return output('validated', { validation });
      }
    }
    const records = items.filter(Boolean).filter((item, index, all) => all.findIndex(other => other.id === item.id) === index);
    return output(records.length ? 'candidates_found' : 'no_match', { records, truncated });
  };
  let final;
  try {
    const deadline = new Promise(resolve => { timer = setTimeout(() => { expired = true; controller.abort(); resolve(output('timeout')); }, Math.min(8000, Math.max(1, runtime.timeoutMs ?? 8000))); });
    final = await Promise.race([work(), deadline]);
  } catch (error) {
    // Only internal status tokens are reflected; provider error messages/keys never are.
    const status = expired ? 'timeout' : error instanceof SourceFailure ? (error.message === 'INVALID_RESPONSE' ? 'invalid_response' : error.message) : 'provider_error';
    final = output(status);
  } finally { clearTimeout(timer); controller.abort(); }
  if (final.status === 'rate_limited') cooldown = Math.max(cooldown, 60);
  try {
    if (await store.save(provider, options.investigationId, { schema_version: 1, result: final }, cooldown) !== true) return output('persistence_error');
  } catch { return output('persistence_error'); }
  return final;
}

export async function collectPublicSources(targetType, targetValue, options = {}, runtime = {}) {
  const selected = normalizePublicSources(options.publicSources);
  const results = new Array(selected.length); let cursor = 0;
  const worker = async () => {
    while (cursor < selected.length) {
      const index = cursor++;
      results[index] = await lookup(selected[index], targetType, targetValue, options, runtime);
    }
  };
  await Promise.all(Array.from({ length: Math.min(3, selected.length) }, worker));
  return results;
}
