import test from "node:test";
import assert from "node:assert/strict";
import { createIntelligenceHandlers } from "../src/app/api/intelligence/handlers.js";
import { IntelligenceError } from "../services/intelligence/service.mjs";

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
