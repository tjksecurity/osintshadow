// Server-only adapter. Never import into browser code or accept a key from a request.
const FIELDS = Object.freeze({
  person: ['id', 'full_name', 'linkedin_url', 'job_title', 'job_company_name', 'job_company_website', 'industry'],
  company: ['id', 'name', 'website', 'linkedin_url', 'industry', 'size', 'founded'],
});
const MESSAGES = Object.freeze({
  not_requested: 'People Data Labs was not requested.',
  not_configured: 'People Data Labs is not enabled or its server API key is missing.',
  unsupported_target: 'People Data Labs supports email and domain targets in this integration.',
  invalid_target: 'The target did not pass local syntax validation; no provider lookup was made.',
  matched: 'Provider-reported match, not verified identity or ownership. Data may be outdated or inaccurate.',
  no_match: 'No provider match met the required likelihood threshold.',
  authentication_error: 'People Data Labs rejected the server credentials or API access.',
  rate_limited: 'People Data Labs rate or credit limit reached. No automatic retry was made.',
  provider_error: 'People Data Labs could not complete the lookup. No automatic retry was made.',
  timeout: 'People Data Labs exceeded the lookup deadline. The provider may have processed the request.',
  invalid_response: 'People Data Labs returned an unusable response. No match was retained.',
});
const MAX_BYTES = 128 * 1024;
const validDomain = value => typeof value === 'string' && value.length <= 253 &&
  /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i.test(value);

function validEmail(value) {
  if (value.length > 254) return false;
  const parts = value.split('@');
  return parts.length === 2 && parts[0].length <= 64 &&
    /^[a-z0-9!#$%&'*+/=?^_`{|}~.-]+$/i.test(parts[0]) &&
    !parts[0].startsWith('.') && !parts[0].endsWith('.') && !parts[0].includes('..') && validDomain(parts[1]);
}

async function readBoundedJSON(response) {
  if (Number(response.headers.get('content-length')) > MAX_BYTES || !response.body) {
      throw new Error('INVALID_RESPONSE');
  }
  const reader = response.body.getReader();
  const chunks = [];
  let length = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > MAX_BYTES) throw new Error('INVALID_RESPONSE');
      chunks.push(value);
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    try { return JSON.parse(new TextDecoder().decode(bytes)); }
    catch { throw new Error('INVALID_RESPONSE'); }
  } finally {
    void reader.cancel().catch(() => {});
  }
}

export async function enrichPeopleDataLabs(targetType, targetValue, options = {}, runtime = {}) {
  const env = runtime.env ?? process.env;
  const fetchImpl = runtime.fetchImpl ?? globalThis.fetch;
  const kind = targetType === 'email' ? 'person' : targetType === 'domain' ? 'company' : null;
  const base = { provider: 'People Data Labs', kind, checked_at: new Date().toISOString(), likelihood: null, record: null };
  const result = (status, extra = {}) => ({ ...base, status, message: MESSAGES[status], ...extra });
  if (options.includePeopleDataLabs !== true) return result('not_requested');
  if (!kind) return result('unsupported_target');
  const value = typeof targetValue === 'string' ? targetValue.trim() : '';
  if (!(kind === 'person' ? validEmail(value) : validDomain(value))) return result('invalid_target');
  const apiKey = typeof env.PDL_API_KEY === 'string' ? env.PDL_API_KEY.trim() : '';
  if (env.PDL_ENABLED !== 'true' || !apiKey) return result('not_configured');

  const url = new URL(`https://api.peopledatalabs.com/v5/${kind}/enrich`);
  url.search = new URLSearchParams({
    [kind === 'person' ? 'email' : 'website']: value,
    min_likelihood: '6', pretty: 'false', data_include: FIELDS[kind].join(','),
  }).toString();
  const controller = new AbortController();
  let timer;
  let deadlineExceeded = false;
  try {
    const work = async () => {
      const response = await fetchImpl(url.toString(), {
        method: 'GET', headers: { 'X-Api-Key': apiKey, Accept: 'application/json' },
        redirect: 'error', cache: 'no-store', signal: controller.signal,
      });
      if (response.status !== 200) {
        void response.body?.cancel().catch(() => {});
        if (response.status === 404) return result('no_match');
        if (response.status === 401 || response.status === 403) return result('authentication_error');
        if (response.status === 429) return result('rate_limited');
        return result('provider_error');
      }
      let body;
      try { body = await readBoundedJSON(response); }
      catch (error) { return result(error?.message === 'INVALID_RESPONSE' ? 'invalid_response' : 'provider_error'); }
      if (!body || body.status !== 200 || !Number.isInteger(body.likelihood) || body.likelihood < 1 || body.likelihood > 10) {
        return result('invalid_response');
      }
      const source = kind === 'person' ? body.data : body;
      if (!source || typeof source !== 'object' || Array.isArray(source)) return result('invalid_response');
      if (body.likelihood < 6) return result('no_match');
      const record = {};
      for (const field of FIELDS[kind]) {
        const item = source[field];
        if (field === 'founded') {
          if (Number.isInteger(item) && item >= 1 && item <= 9999) record[field] = item;
        } else if (typeof item === 'string' && item.trim() && !item.includes(apiKey)) {
          record[field] = item.trim().slice(0, 300);
        }
      }
      if (!Object.keys(record).length) return result('invalid_response');
      return result('matched', { likelihood: body.likelihood, record });
    };
    const deadline = new Promise(resolve => {
      timer = setTimeout(() => {
        deadlineExceeded = true;
        controller.abort();
        resolve(result('timeout'));
      }, Math.min(10000, Math.max(1, runtime.timeoutMs ?? 10000)));
    });
    return await Promise.race([work(), deadline]);
  } catch {
    return result(deadlineExceeded ? 'timeout' : 'provider_error');
  } finally {
    clearTimeout(timer);
    controller.abort();
  }
}
