import { pathToFileURL } from 'node:url';

// A signed-out transport/configuration preflight, never authenticated acceptance.
export const EXPECTED_PROVIDER_IDS = Object.freeze(['credentials-signin', 'credentials-signup']);
const CONFIGURATION_NAMES = ['DATABASE_URL', 'AUTH_SECRET'];
const PATHS = Object.freeze({
  homepage: '/',
  providers: '/api/auth/providers',
  csrf: '/api/auth/csrf',
  investigations: '/api/investigations',
  session: '/api/auth/session',
});
const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const isJson = (value = '') => /^application\/(?:json|[a-z0-9!#$&^_.+-]+\+json)(?:\s*;|$)/i.test(value);
const isHtml = (value = '') => /^text\/html(?:\s*;|$)/i.test(value);

export function validateDeploymentUrl(value) {
  const invalid = () => { throw new TypeError('Expected an explicit HTTPS origin without credentials, path, query, or fragment.'); };
  if (typeof value !== 'string' || !/^https:\/\/[^/?#]+\/?$/i.test(value) || /[\s\\@?#]/.test(value)) invalid();
  let url;
  try { url = new URL(value); } catch { invalid(); }
  if (url.protocol !== 'https:' || !url.hostname || url.username || url.password || url.pathname !== '/' || url.search || url.hash) invalid();
  return url.origin;
}

// Accepts observations, but only emits fixed names, status/boolean fields and reason codes.
export function classifyDeployment(observations = {}) {
  const checks = {};
  for (const name of Object.keys(PATHS)) {
    const observation = observations[name] ?? {};
    const status = Number.isInteger(observation.status) && observation.status >= 100 && observation.status <= 599
      ? observation.status : null;
    const body = observation.body;
    const missingConfiguration = CONFIGURATION_NAMES.filter((key) =>
      status === 503 && isRecord(body) && body.code === 'CONFIGURATION_REQUIRED' && Array.isArray(body.missing) && body.missing.includes(key));
    const tokenPresent = name === 'csrf' && isRecord(body) && typeof body.csrfToken === 'string' && body.csrfToken.trim().length > 0;
    const shapeValid = name === 'homepage' ||
      (name === 'providers' && isRecord(body) && EXPECTED_PROVIDER_IDS.every((id) =>
        Object.hasOwn(body, id) && isRecord(body[id]) && body[id].id === id && body[id].type === 'credentials')) ||
      (name === 'csrf' && tokenPresent) ||
      (name === 'investigations' && isRecord(body) && body.code === 'UNAUTHORIZED') ||
      (name === 'session' && body === null);
    let reason = 'PASSED';
    if (observation.requestFailed || status === null) reason = 'REQUEST_FAILED';
    else if (observation.redirected || (status >= 300 && status < 400)) reason = 'REDIRECT_BLOCKED';
    else if (missingConfiguration.length) reason = 'CONFIGURATION_REQUIRED';
    else if (status !== (name === 'investigations' ? 401 : 200)) reason = 'UNEXPECTED_STATUS';
    else if (!(name === 'homepage' ? isHtml(observation.contentType) : isJson(observation.contentType))) reason = 'UNEXPECTED_CONTENT_TYPE';
    else if (name !== 'homepage' && !observation.jsonValid) reason = 'INVALID_JSON';
    else if (!shapeValid) reason = 'UNEXPECTED_RESPONSE';
    checks[name] = { status, passed: reason === 'PASSED', reason, missingConfiguration,
      ...(name === 'csrf' ? { tokenPresent: Boolean(tokenPresent) } : {}) };
  }
  return {
    scope: 'deployment-preflight-only',
    preflightChecksPassed: Object.values(checks).every((check) => check.passed),
    authenticatedWorkflowVerified: false,
    databaseVerified: false,
    operationalReady: false,
    missingConfiguration: CONFIGURATION_NAMES.filter((name) =>
      Object.values(checks).some((check) => check.missingConfiguration.includes(name))),
    checks,
    remainingAcceptance: [
      'Approved original database connectivity and required schema verification.',
      'Authorized credential sign-in and persisted investigation/report workflow verification.',
    ],
  };
}

async function boundedJson(response) {
  const reader = response.body?.getReader();
  if (!reader) return { jsonValid: false };
  const decoder = new TextDecoder();
  let size = 0;
  let text = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 65536) { await reader.cancel(); return { jsonValid: false }; }
      text += decoder.decode(value, { stream: true });
    }
    return { jsonValid: true, body: JSON.parse(text + decoder.decode()) };
  } catch {
    return { jsonValid: false };
  } finally {
    reader.releaseLock();
  }
}

export async function probeDeployment(baseURL, { fetchImpl = globalThis.fetch, timeoutMs = 10000 } = {}) {
  const origin = validateDeploymentUrl(baseURL);
  if (typeof fetchImpl !== 'function') throw new TypeError('A fetch implementation is required.');
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 60000) throw new TypeError('Timeout must be between 1 and 60000 milliseconds.');
  const observations = await Promise.all(Object.entries(PATHS).map(async ([name, path]) => {
    try {
      const response = await fetchImpl(new URL(path, origin), {
        method: 'GET', credentials: 'omit', redirect: 'manual', cache: 'no-store',
        headers: { accept: name === 'homepage' ? 'text/html' : 'application/json' },
        signal: AbortSignal.timeout(timeoutMs),
      });
      const observation = { status: response.status, redirected: response.redirected,
        contentType: response.headers.get('content-type') ?? '' };
      // Never inspect an unexpected successful protected response: it could contain customer rows.
      const expectedStatus = name === 'investigations' ? 401 : 200;
      if (!response.redirected && name !== 'homepage' &&
          (response.status === expectedStatus || response.status === 503) && isJson(observation.contentType)) {
        Object.assign(observation, await boundedJson(response));
      } else {
        await response.body?.cancel();
      }
      return [name, observation];
    } catch {
      // Do not print exception messages: transports may include URLs or private data.
      return [name, { requestFailed: true }];
    }
  }));
  return classifyDeployment(Object.fromEntries(observations));
}

async function main() {
  try {
    if (process.argv.length !== 3) throw new TypeError('Expected one deployment origin.');
    const result = await probeDeployment(process.argv[2]);
    console.log(JSON.stringify(result, null, 2));
    process.exitCode = result.preflightChecksPassed ? 0 : 1;
  } catch {
    console.error('Deployment preflight could not run. Usage: node scripts/check-deployment.mjs https://deployment-host');
    process.exitCode = 2;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
