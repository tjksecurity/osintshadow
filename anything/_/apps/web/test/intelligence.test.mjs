import test from "node:test";
import assert from "node:assert/strict";
import { createIntelligenceHandlers } from "../src/app/api/intelligence/handlers.js";
import { IntelligenceError } from "../services/intelligence/service.mjs";
import { dispatchIntelligenceAction } from "../src/app/api/intelligence/remote.js";

function handlers(overrides = {}) {
  const calls = [];
  const api = createIntelligenceHandlers({
    authenticate: async () => ({ user: { id: "synthetic-user" } }),
    dispatchAction: async (...args) => { calls.push(args); return { provider: "synthetic", value: "fixture" }; },
    getConfiguration: () => ({}),
    ...overrides,
  });
  return { ...api, calls };
}
function request(body = { action: "ipinfo", input: { ip: "8.8.8.8" } }, options = {}) {
  return new Request("https://app.example/api/intelligence", { method: "POST", headers: { "content-type": "application/json", ...options.headers }, body: typeof body === "string" ? body : JSON.stringify(body) });
}

test("unauthenticated requests never dispatch a provider action", async () => {
  const api = handlers({ authenticate: async () => null });
  for (const response of [await api.GET(), await api.POST(request())]) {
    assert.equal(response.status, 401);
    assert.equal((await response.json()).error.code, "UNAUTHORIZED");
    assert.equal(response.headers.get("cache-control"), "no-store");
  }
  assert.deepEqual(api.calls, []);
});
test("authentication errors fail closed", async () => {
  const api = handlers({ authenticate: async () => { throw new Error("private database details"); } });
  const response = await api.POST(request());
  assert.equal(response.status, 503);
  assert.doesNotMatch(await response.text(), /private database/);
  assert.deepEqual(api.calls, []);
});
test("cross-origin, malformed, oversized and unsupported requests never dispatch", async () => {
  const api = handlers();
  const cases = [
    [request(undefined, { headers: { origin: "https://other.example" } }), 403],
    [request("{"), 400],
    [request({ action: "unknown", input: {} }), 400],
    [request({ action: "breach", input: [] }), 400],
    [request("x".repeat(8193)), 413],
    [request("{}", { headers: { "content-type": "text/plain" } }), 415],
  ];
  for (const [input, status] of cases) assert.equal((await api.POST(input)).status, status);
  assert.deepEqual(api.calls, []);
});
test("authenticated actions use the shared dispatcher and return evidence unchanged", async () => {
  const api = handlers();
  for (const action of ["ipinfo", "breach", "profile", "onion"]) {
    const input = { value: "synthetic fixture" };
    const response = await api.POST(request({ action, input }));
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true, data: { provider: "synthetic", value: "fixture" } });
    assert.deepEqual(api.calls.at(-1), [action, input]);
  }
});
test("configuration status contains booleans and never secret values", async () => {
  const api = handlers({ getConfiguration: () => ({ HIBP_API_KEY: "private", IPINFO_TOKEN: "private" }) });
  const response = await api.GET();
  const body = await response.json();
  assert.deepEqual(body.data.configuration, { IPINFO_TOKEN: true, HIBP_API_KEY: true, PUPPETEER_EXECUTABLE_PATH: false, TOR_SOCKS_PROXY: false });
  assert.equal(body.data.configurationOnly, true);
  assert.doesNotMatch(JSON.stringify(body), /private/);
});
test("provider errors retain meaningful status and retry-after without leaking unexpected errors", async () => {
  const limited = handlers({ dispatchAction: async () => { throw new IntelligenceError("RATE_LIMITED", "Provider rate limit reached.", 429, 30); } });
  const response = await limited.POST(request());
  assert.equal(response.status, 429);
  assert.equal(response.headers.get("retry-after"), "30");
  assert.equal((await response.json()).error.retryAfter, 30);
  const broken = handlers({ dispatchAction: async () => { throw new Error("secret=do-not-leak"); } });
  const failed = await broken.POST(request());
  assert.equal(failed.status, 500);
  assert.doesNotMatch(await failed.text(), /do-not-leak/);
});

const workerToken = "synthetic-worker-token-12345678901234567890";
const workerEnv = { NODE_ENV: "production", INTELLIGENCE_WORKER_URL: "https://browser-worker.example/", INTELLIGENCE_WORKER_TOKEN: workerToken,
  IPINFO_TOKEN: "synthetic-ipinfo-private", HIBP_API_KEY: "synthetic-hibp-private", X_API_BEARER_TOKEN: "synthetic-x-private" };
const profile = { provider: "x_public_profile", username: "example", url: "https://x.com/example", name: "Fixture Name", bio: "Fixture Bio", location: "Fixture Location", queriedAt: "2026-11-01T00:00:00.000Z" };
const onionURL = `http://${"a".repeat(56)}.onion/`;
const onion = { provider: "tor_browser", url: onionURL, requestedUrl: onionURL, title: "Fixture onion", text: "Fixture document", html: "<p>Fixture document</p>", truncated: false, via: "configured_socks5", queriedAt: "2026-11-01T00:00:00.000Z" };

test("absent remote configuration preserves the local dispatcher and input normalization", async () => {
  let calls = 0;
  const result = await dispatchIntelligenceAction("profile", { username: "@example", token: "must-not-forward" }, { env: {}, fetchImpl: () => assert.fail("must not fetch"), localDispatch: async (action, input, options) => {
    calls++; assert.equal(action, "profile"); assert.deepEqual(input, { username: "example" }); assert.deepEqual(options.env, {}); return profile;
  } });
  assert.equal(calls, 1); assert.deepEqual(result, profile);
});

test("configured remote browser actions send only normalized input and the server worker token", async () => {
  for (const [action, input, fixture] of [["profile", { username: "example", cookie: "private-user-cookie", HIBP_API_KEY: "bad-extra" }, profile], ["onion", { url: onionURL }, onion]]) {
    let calls = 0;
    const result = await dispatchIntelligenceAction(action, input, { env: workerEnv, localDispatch: () => assert.fail("remote action must not launch locally"), fetchImpl: async (url, options) => {
      calls++; assert.equal(url, "https://browser-worker.example/intelligence"); assert.equal(options.headers.Authorization, `Bearer ${workerToken}`);
      assert.equal(options.headers.Cookie, undefined); assert.equal(options.credentials, "omit"); assert.equal(options.redirect, "error"); assert.ok(options.signal);
      const payload = JSON.parse(options.body);
      assert.deepEqual(payload, { action, input: action === "profile" ? { username: "example" } : { url: onionURL } });
      for (const secret of [workerEnv.IPINFO_TOKEN, workerEnv.HIBP_API_KEY, workerEnv.X_API_BEARER_TOKEN, workerToken, "private-user-cookie"]) assert.ok(!options.body.includes(secret));
      return Response.json({ ok: true, data: { ...fixture, internalDebug: { token: workerToken } } });
    } });
    assert.equal(calls, 1); assert.deepEqual(result, fixture); assert.ok(!JSON.stringify(result).includes(workerToken));
  }
});

test("HTTP providers and explicitly configured official X API stay local even if remote browser config is invalid", async () => {
  for (const [action, input] of [["ipinfo", { ip: "8.8.8.8" }], ["breach", { email: "synthetic@example.com" }], ["profile", { username: "example" }]]) {
    const env = { ...workerEnv, INTELLIGENCE_WORKER_URL: "http://invalid.example/path", ...(action === "profile" ? { X_API_MODE: "api", X_INCLUDED_ACCESS_VERIFIED: "true" } : {}) };
    let calls = 0;
    await dispatchIntelligenceAction(action, input, { env, fetchImpl: () => assert.fail("remote network must not be called"), localDispatch: async (received, normalized, options) => {
      calls++; assert.equal(received, action); assert.deepEqual(normalized, input); assert.equal(options.env.HIBP_API_KEY, workerEnv.HIBP_API_KEY); return { provider: "local-fixture" };
    } });
    assert.equal(calls, 1);
  }
});

test("invalid action inputs fail before configuration reads, remote network, or local execution", async () => {
  const unreadEnvironment = { get X_API_MODE() { assert.fail("configuration must not be read for invalid input"); } };
  for (const [action, input] of [["profile", { username: "../login" }], ["onion", { url: "http://localhost/" }], ["onion", { url: "http://example.onion" }], ["unknown", {}]]) {
    await assert.rejects(dispatchIntelligenceAction(action, input, { env: unreadEnvironment, fetchImpl: () => assert.fail("must not fetch"), localDispatch: () => assert.fail("must not execute") }), IntelligenceError);
  }
});

test("partial, short-token, non-origin, unsafe and production-loopback configuration fails closed", async () => {
  const variants = [
    { INTELLIGENCE_WORKER_URL: "https://worker.example" }, { INTELLIGENCE_WORKER_TOKEN: workerToken },
    { INTELLIGENCE_WORKER_URL: " ", INTELLIGENCE_WORKER_TOKEN: " " },
    { ...workerEnv, INTELLIGENCE_WORKER_TOKEN: "too-short" }, { ...workerEnv, INTELLIGENCE_WORKER_TOKEN: `${workerToken}\n` },
    ...["http://worker.example", "https://user:password@worker.example", "https://worker.example/path", "https://worker.example/a/..", "https://worker.example?query=1", "https://worker.example/#fragment", "https://localhost", "https://localhost.", "https://127.0.0.1", "https://127.1", "https://2130706433", "https://[::1]", "https://[::ffff:127.0.0.1]"].map((url) => ({ ...workerEnv, INTELLIGENCE_WORKER_URL: url })),
  ];
  for (const env of variants) await assert.rejects(dispatchIntelligenceAction("profile", { username: "example" }, { env, fetchImpl: () => assert.fail("must not fetch"), localDispatch: () => assert.fail("must not fall back") }), (error) => error instanceof IntelligenceError && error.code === "CONFIGURATION_REQUIRED");
});

test("remote cold start becomes a single 503 WORKER_STARTING with five-second retry metadata", async () => {
  let calls = 0;
  const api = handlers({ dispatchAction: (action, input) => dispatchIntelligenceAction(action, input, { env: workerEnv, fetchImpl: async () => { calls++; return Response.json({ message: workerToken }, { status: 202 }); } }) });
  const response = await api.POST(request({ action: "profile", input: { username: "example" } }));
  assert.equal(calls, 1); assert.equal(response.status, 503); assert.equal(response.headers.get("retry-after"), "5");
  const payload = await response.json(); assert.equal(payload.error.code, "WORKER_STARTING"); assert.equal(payload.error.retryAfter, 5); assert.ok(!JSON.stringify(payload).includes(workerToken));
});

test("auth, origin and body guards prevent remote compute before helper dispatch", async () => {
  let calls = 0;
  const dispatch = (action, input) => dispatchIntelligenceAction(action, input, { env: workerEnv, fetchImpl: async () => { calls++; return Response.json({ ok: true, data: profile }); } });
  const signedOut = handlers({ authenticate: async () => null, dispatchAction: dispatch });
  assert.equal((await signedOut.POST(request({ action: "profile", input: { username: "example" } }))).status, 401);
  const signedIn = handlers({ dispatchAction: dispatch });
  assert.equal((await signedIn.POST(request({ action: "profile", input: { username: "example" } }, { headers: { origin: "https://attacker.example" } }))).status, 403);
  assert.equal((await signedIn.POST(request("x".repeat(8193)))).status, 413);
  assert.equal((await signedIn.POST(request({ action: "onion", input: { url: "http://localhost/" } }))).status, 400);
  assert.equal(calls, 0);
});

test("remote worker auth and status errors preserve useful safe diagnostics without upstream secret text", async () => {
  for (const [status, code, expectedStatus, expectedCode] of [[401, "UNAUTHORIZED", 503, "WORKER_AUTHENTICATION_FAILED"], [403, "UNAUTHORIZED", 503, "WORKER_AUTHENTICATION_FAILED"], [429, "BUSY", 429, "BUSY"], [502, "UPSTREAM_BLOCKED", 502, "UPSTREAM_BLOCKED"], [503, "CONFIGURATION_REQUIRED", 503, "CONFIGURATION_REQUIRED"]]) {
    let calls = 0;
    await assert.rejects(dispatchIntelligenceAction("profile", { username: "example" }, { env: workerEnv, fetchImpl: async () => {
      calls++; return Response.json({ ok: false, error: { code, message: `sensitive ${workerToken}`, retryAfter: 7 } }, { status });
    } }), (error) => {
      assert.equal(error.status, expectedStatus); assert.equal(error.code, expectedCode); assert.ok(!error.message.includes(workerToken));
      if (status === 429) assert.equal(error.retryAfter, 7);
      return true;
    });
    assert.equal(calls, 1);
  }
});

test("remote malformed, oversized, different-target and token-echoed results cannot become successful evidence", async () => {
  const cases = [
    () => new Response("not json"),
    () => new Response("oversized", { headers: { "Content-Length": "1200001" } }),
    () => Response.json({ ok: true, data: { ...profile, username: "different" } }),
    () => Response.json({ ok: true, data: { ...profile, name: workerToken } }),
    () => Response.json({ ok: true, data: null }),
  ];
  for (const response of cases) await assert.rejects(dispatchIntelligenceAction("profile", { username: "example" }, { env: workerEnv, fetchImpl: async () => response() }), (error) => error.code === "INVALID_WORKER_RESPONSE");
  await assert.rejects(dispatchIntelligenceAction("onion", { url: onionURL }, { env: workerEnv, fetchImpl: async () => Response.json({ ok: true, data: { ...onion, url: `http://${"b".repeat(56)}.onion/` } }) }), (error) => error.code === "INVALID_WORKER_RESPONSE");
});

test("remote fetch and stalled-body deadlines abort once, release streams, and never retry", async () => {
  let calls = 0;
  await assert.rejects(dispatchIntelligenceAction("profile", { username: "example" }, { env: workerEnv, timeoutMs: 10, fetchImpl: async (_url, options) => {
    calls++; return new Promise((_, reject) => options.signal.addEventListener("abort", () => reject(new DOMException("cancelled", "AbortError")), { once: true }));
  } }), (error) => error.code === "TIMEOUT" && error.status === 504);
  assert.equal(calls, 1);
  let cancelled = false;
  await assert.rejects(dispatchIntelligenceAction("profile", { username: "example" }, { env: workerEnv, timeoutMs: 10, fetchImpl: async () => new Response(new ReadableStream({
    start(controller) { controller.enqueue(new TextEncoder().encode('{"ok":')); }, cancel() { cancelled = true; },
  })) }), (error) => error.code === "TIMEOUT" && error.status === 504);
  assert.equal(cancelled, true);
});

test("authenticated readiness metadata never exposes worker origin, worker token or provider keys", async () => {
  const api = handlers({ getConfiguration: () => workerEnv });
  const response = await api.GET(); const body = await response.json();
  assert.deepEqual(body.data.remoteBrowser, { urlConfigured: true, tokenConfigured: true });
  assert.equal(body.data.providers.metadataOnly, true); assert.equal(body.data.providers.liveChecksPerformed, false);
  for (const secret of [workerEnv.INTELLIGENCE_WORKER_URL, workerToken, workerEnv.IPINFO_TOKEN, workerEnv.HIBP_API_KEY, workerEnv.X_API_BEARER_TOKEN]) assert.ok(!JSON.stringify(body).includes(secret));
});
