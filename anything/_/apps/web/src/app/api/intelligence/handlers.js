import { IntelligenceError, toErrorResult } from "../../../../services/intelligence/service.mjs";
import { getProviderReadiness } from "../../../../services/intelligence/provider-readiness.mjs";

const ACTIONS = new Set(["ipinfo", "breach", "profile", "onion"]);
const MAX_BODY_BYTES = 8192;

function reply(body, status = 200, retryAfter) {
  const headers = { "Cache-Control": "no-store" };
  if (retryAfter !== undefined) headers["Retry-After"] = String(retryAfter);
  return Response.json(body, { status, headers });
}

function failure(code, message, status, retryAfter) {
  return reply({ ok: false, error: { code, message, ...(retryAfter !== undefined ? { retryAfter } : {}) } }, status, retryAfter);
}

async function readBody(request) {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return { response: failure("UNSUPPORTED_MEDIA_TYPE", "Send an application/json request.", 415) };
  }
  const length = request.headers.get("content-length");
  if (length && (!/^\d+$/.test(length) || Number(length) > MAX_BODY_BYTES)) {
    return { response: failure("REQUEST_TOO_LARGE", "Request is too large.", 413) };
  }
  const reader = request.body?.getReader();
  if (!reader) return { response: failure("INVALID_REQUEST", "A JSON request body is required.", 400) };
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) {
        await reader.cancel();
        return { response: failure("REQUEST_TOO_LARGE", "Request is too large.", 413) };
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return { body: JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) };
  } catch {
    return { response: failure("INVALID_JSON", "Request body must contain valid JSON.", 400) };
  } finally {
    reader.releaseLock();
  }
}

export function createIntelligenceHandlers({ authenticate, dispatchAction, getConfiguration = () => process.env }) {
  async function authorize() {
    try {
      const session = await authenticate();
      return session?.user?.id ? null : failure("UNAUTHORIZED", "Sign in to use intelligence tools.", 401);
    } catch {
      return failure("AUTHENTICATION_FAILED", "Authentication could not be verified.", 503);
    }
  }

  return {
    async GET() {
      const denied = await authorize();
      if (denied) return denied;
      const env = getConfiguration();
      return reply({ ok: true, data: { configuration: {
        IPINFO_TOKEN: Boolean(env.IPINFO_TOKEN),
        HIBP_API_KEY: Boolean(env.HIBP_API_KEY),
        PUPPETEER_EXECUTABLE_PATH: Boolean(env.PUPPETEER_EXECUTABLE_PATH),
        TOR_SOCKS_PROXY: Boolean(env.TOR_SOCKS_PROXY),
      }, remoteBrowser: { urlConfigured: Boolean(env.INTELLIGENCE_WORKER_URL), tokenConfigured: Boolean(env.INTELLIGENCE_WORKER_TOKEN) },
      providers: getProviderReadiness(env), configurationOnly: true } });
    },
    async POST(request) {
      const denied = await authorize();
      if (denied) return denied;
      const origin = request.headers.get("origin");
      if (origin && origin !== new URL(request.url).origin) {
        return failure("ORIGIN_NOT_ALLOWED", "Request origin is not allowed.", 403);
      }
      const parsed = await readBody(request);
      if (parsed.response) return parsed.response;
      const body = parsed.body;
      if (!body || typeof body !== "object" || Array.isArray(body) || !ACTIONS.has(body.action) ||
          !body.input || typeof body.input !== "object" || Array.isArray(body.input)) {
        return failure("INVALID_REQUEST", "Choose a supported action and provide its input.", 400);
      }
      try {
        const data = await dispatchAction(body.action, body.input);
        return reply({ ok: true, data });
      } catch (error) {
        const known = error instanceof IntelligenceError;
        const status = known && Number.isInteger(error.status) && error.status >= 400 && error.status <= 599 ? error.status : 500;
        const retryAfter = known && Number.isInteger(error.retryAfter) && error.retryAfter >= 0 ? error.retryAfter : undefined;
        return reply(toErrorResult(error), status, retryAfter);
      }
    },
  };
}
