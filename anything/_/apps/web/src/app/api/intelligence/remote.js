import { dispatchAction, validateAction, IntelligenceError } from "../../../../services/intelligence/service.mjs";
import { getProviderReadiness } from "../../../../services/intelligence/provider-readiness.mjs";

const MAX_RESPONSE_BYTES = 1_200_000;
const MAX_CONTENT_CHARS = 512 * 1024;
const messages = {
  WORKER_STARTING: "The browser worker is starting. Wait before trying again.",
  CONFIGURATION_REQUIRED: "The browser worker needs additional server configuration.",
  INVALID_INPUT: "The browser worker rejected this lookup input.",
  INVALID_ACTION: "The browser worker does not support this operation.",
  BUSY: "The browser worker is busy. Wait before trying again.",
  RATE_LIMITED: "The browser worker rate limit was reached. Wait before trying again.",
  TIMEOUT: "The browser worker did not finish in time.",
  BROWSER_UNAVAILABLE: "The browser worker could not load the requested public profile.",
  BROWSER_CLEANUP_FAILED: "The browser worker could not close its browser cleanly.",
  TOR_UNAVAILABLE: "The worker's configured Tor route or onion service could not be reached.",
  PROXY_CLEANUP_FAILED: "The browser worker could not release its Tor proxy cleanly.",
  UPSTREAM_BLOCKED: "The public profile is unavailable. Login, an access challenge, or account availability may prevent extraction.",
  UPSTREAM_ERROR: "The requested source did not return a successful document.",
  REDIRECT_BLOCKED: "The onion service attempted to leave the permitted origin.",
  RESPONSE_TOO_LARGE: "The browser worker response exceeded the permitted size.",
};

function loopback(hostname) {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  return host === "localhost" || host.endsWith(".localhost") || /^127\./.test(host) || host === "[::1]" || host.startsWith("[::ffff:");
}

export function browserWorkerConfiguration(env) {
  const rawURL = env.INTELLIGENCE_WORKER_URL;
  const rawToken = env.INTELLIGENCE_WORKER_TOKEN;
  if ((rawURL === undefined || rawURL === "") && (rawToken === undefined || rawToken === "")) return null;
  const urlPresent = typeof rawURL === "string" && rawURL.trim().length > 0;
  const tokenPresent = typeof rawToken === "string" && rawToken.trim().length > 0;
  if (!urlPresent || !tokenPresent || rawToken.length < 32 || /\s/.test(rawToken)) {
    throw new IntelligenceError("CONFIGURATION_REQUIRED", "Configure the browser worker HTTPS origin and a server-only token of at least 32 characters.", 503);
  }
  let url;
  try { url = new URL(rawURL.trim()); } catch {
    throw new IntelligenceError("CONFIGURATION_REQUIRED", "The browser worker origin is invalid.", 503);
  }
  if (!/^https:\/\/[^/?#\\]+\/?$/i.test(rawURL.trim()) || url.protocol !== "https:" || url.username || url.password || url.search || url.hash ||
      !["", "/"].includes(url.pathname) || (env.NODE_ENV === "production" && loopback(url.hostname))) {
    throw new IntelligenceError("CONFIGURATION_REQUIRED", "Use a browser worker HTTPS origin without credentials, query, fragment, or path. Production cannot use loopback.", 503);
  }
  return { url: new URL("/intelligence", url.origin).href, token: rawToken };
}

function retryAfter(response, body) {
  const field = body?.error?.retryAfter;
  if (Number.isInteger(field) && field >= 0) return Math.max(1, Math.min(field, 3600));
  const header = response.headers.get("retry-after");
  if (!header) return undefined;
  const value = /^\d+$/.test(header) ? Number(header) : Math.ceil((Date.parse(header) - Date.now()) / 1000);
  return Number.isFinite(value) ? Math.max(1, Math.min(value, 3600)) : undefined;
}

async function discard(response) { await response.body?.cancel().catch(() => {}); }

async function readResponse(response, signal) {
  if (Number(response.headers.get("content-length")) > MAX_RESPONSE_BYTES) {
    await discard(response);
    throw new IntelligenceError("INVALID_WORKER_RESPONSE", "The browser worker returned an oversized response.", 502);
  }
  const reader = response.body?.getReader();
  if (!reader) throw new IntelligenceError("INVALID_WORKER_RESPONSE", "The browser worker returned an empty response.", 502);
  const cancel = () => { void reader.cancel().catch(() => {}); };
  signal.addEventListener("abort", cancel, { once: true });
  const chunks = []; let length = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > MAX_RESPONSE_BYTES) throw new IntelligenceError("INVALID_WORKER_RESPONSE", "The browser worker returned an oversized response.", 502);
      chunks.push(value);
    }
    const bytes = new Uint8Array(length); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    const body = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("Invalid envelope");
    return body;
  } catch (error) {
    await reader.cancel().catch(() => {});
    if (error instanceof IntelligenceError) throw error;
    throw new IntelligenceError("INVALID_WORKER_RESPONSE", "The browser worker returned an unreadable response.", 502);
  } finally { signal.removeEventListener("abort", cancel); reader.releaseLock(); }
}

function stringField(value, key, nullable = false, limit = 4096) {
  const field = value[key];
  if (nullable && (field === null || field === undefined)) return null;
  if (typeof field !== "string" || field.length > limit || (!nullable && !field.trim())) {
    throw new IntelligenceError("INVALID_WORKER_RESPONSE", "The browser worker returned an invalid result.", 502);
  }
  return field;
}

function cleanResult(action, input, body, token) {
  const data = body.data;
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new IntelligenceError("INVALID_WORKER_RESPONSE", "The browser worker returned an invalid result.", 502);
  let result;
  if (action === "profile") {
    if (data.provider !== "x_public_profile" || typeof data.username !== "string" || data.username.toLowerCase() !== input.username.toLowerCase() || data.url !== `https://x.com/${input.username}`) {
      throw new IntelligenceError("INVALID_WORKER_RESPONSE", "The browser worker returned a different profile than requested.", 502);
    }
    result = { provider: data.provider, username: data.username, url: data.url, name: stringField(data, "name"),
      bio: stringField(data, "bio", true), location: stringField(data, "location", true), queriedAt: stringField(data, "queriedAt") };
  } else {
    const requested = new URL(input.url);
    let finalURL;
    try { finalURL = new URL(data.url); } catch { throw new IntelligenceError("INVALID_WORKER_RESPONSE", "The browser worker returned an invalid onion URL.", 502); }
    const permitted = finalURL.origin === requested.origin || (requested.protocol === "http:" && !requested.port && finalURL.origin === `https://${requested.hostname}`);
    if (data.provider !== "tor_browser" || data.via !== "configured_socks5" || data.requestedUrl !== input.url || !permitted || finalURL.username || finalURL.password || typeof data.truncated !== "boolean" || typeof data.text !== "string" || typeof data.html !== "string") {
      throw new IntelligenceError("INVALID_WORKER_RESPONSE", "The browser worker returned an unverified onion result.", 502);
    }
    result = { provider: data.provider, url: data.url, requestedUrl: data.requestedUrl, title: stringField(data, "title", true),
      text: stringField(data, "text", true, MAX_CONTENT_CHARS), html: stringField(data, "html", true, MAX_CONTENT_CHARS),
      truncated: data.truncated, via: data.via, queriedAt: stringField(data, "queriedAt") };
  }
  if (JSON.stringify(result).includes(token)) throw new IntelligenceError("INVALID_WORKER_RESPONSE", "The browser worker returned an unsafe response.", 502);
  return result;
}

async function remoteDispatch(action, input, config, fetchImpl, timeoutMs) {
  const controller = new AbortController();
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new IntelligenceError("TIMEOUT", "The browser worker did not respond within the time limit.", 504));
    }, timeoutMs);
  });
  try {
    return await Promise.race([timeout, (async () => {
      const response = await fetchImpl(config.url, { method: "POST", headers: { Authorization: `Bearer ${config.token}`, "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ action, input }), redirect: "error", credentials: "omit", signal: controller.signal });
      if (response.status === 202) {
        await discard(response);
        throw new IntelligenceError("WORKER_STARTING", "The browser worker is starting. Wait before trying again.", 503, 5);
      }
      if (response.status === 401 || response.status === 403) {
        await discard(response);
        throw new IntelligenceError("WORKER_AUTHENTICATION_FAILED", "The browser worker rejected the server credentials. Its server configuration must be checked.", 503);
      }
      const body = await readResponse(response, controller.signal);
      if (!response.ok || body.ok !== true) {
        const code = typeof body.error?.code === "string" && Object.hasOwn(messages, body.error.code) ? body.error.code : "WORKER_ERROR";
        const status = [400, 402, 404, 409, 413, 429, 502, 503, 504].includes(response.status) ? response.status : 502;
        throw new IntelligenceError(code, messages[code] || "The browser worker could not complete this operation.", status, retryAfter(response, body));
      }
      return cleanResult(action, input, body, config.token);
    })()]);
  } catch (error) {
    if (controller.signal.aborted) throw new IntelligenceError("TIMEOUT", "The browser worker did not respond within the time limit.", 504);
    if (error instanceof IntelligenceError) throw error;
    throw new IntelligenceError("WORKER_UNAVAILABLE", "The browser worker could not be reached. No automatic retry was made.", 502);
  } finally { clearTimeout(timer); }
}

export async function dispatchIntelligenceAction(action, input, {
  env = process.env, fetchImpl = globalThis.fetch, localDispatch = dispatchAction, timeoutMs = 65000,
} = {}) {
  // Normalize first, before a remote request can start paid browser compute.
  const validated = validateAction(action, input);
  const mode = getProviderReadiness(env).x.mode;
  if (action === "profile" && mode === null) throw new IntelligenceError("CONFIGURATION_REQUIRED", "Set X_API_MODE to browser or api.", 503);
  const browserAction = action === "onion" || (action === "profile" && mode === "browser");
  if (!browserAction) return localDispatch(action, validated, { env, fetchImpl });
  const remote = browserWorkerConfiguration(env);
  if (!remote) return localDispatch(action, validated, { env, fetchImpl });
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 65000) throw new IntelligenceError("CONFIGURATION_REQUIRED", "The browser worker timeout must be between 1 and 65000 milliseconds.", 503);
  return remoteDispatch(action, validated, remote, fetchImpl, timeoutMs);
}
