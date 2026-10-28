import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import vm from "node:vm";

// Execute the actual route bodies, replacing only their external dependencies.
async function loadRoute(path, mocks) {
  let source = await readFile(new URL("../" + path, import.meta.url), "utf8");
  const key = "__osintAuthTest_" + randomUUID();
  globalThis[key] = mocks;
  if (mocks.sql) {
    assert.match(source, /^import sql from .*;$/m);
    source = source.replace(
      /^import sql from .*;$/m,
      "const sql = globalThis[" + JSON.stringify(key) + "].sql;",
    );
  }
  if (mocks.getToken) {
    assert.match(source, /^import \{ getToken \} from .*;$/m);
    source = source.replace(
      /^import \{ getToken \} from .*;$/m,
      "const getToken = globalThis[" + JSON.stringify(key) + "].getToken;",
    );
  }
  try {
    return await import(
      "data:text/javascript;base64," + Buffer.from(source).toString("base64")
    );
  } finally {
    delete globalThis[key];
  }
}

async function isolated(run, overrides = {}) {
  const config = {
    NODE_ENV: "production",
    APP_URL: "https://www.osintshadow.com",
    AUTH_URL: undefined,
    AUTH_SECRET: "synthetic-secret",
    RESEND_API_KEY: "synthetic-email-key",
    EMAIL_FROM: "ShadowTrace <noreply@example.com>",
    EXPO_AUTH_PARENT_ORIGIN: undefined,
    ...overrides,
  };
  const saved = Object.fromEntries(Object.keys(config).map((k) => [k, process.env[k]]));
  const originalFetch = globalThis.fetch;
  const originalWarn = console.warn;
  const originalError = console.error;
  const logs = [];
  for (const [key, value] of Object.entries(config)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  globalThis.fetch = async () => { throw new Error("Unexpected external request"); };
  console.warn = (...args) => logs.push(args.join(" "));
  console.error = (...args) => logs.push(args.join(" "));
  try {
    await run(logs);
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    globalThis.fetch = originalFetch;
    console.warn = originalWarn;
    console.error = originalError;
  }
}

function database(exists = true) {
  const calls = [];
  return {
    calls,
    sql: async (query, params) => {
      calls.push({ query, params });
      return query.startsWith("SELECT") && exists
        ? [{ id: "synthetic-user", email: "person@example.com" }]
        : [];
    },
  };
}

function forgotRequest(headers = {}) {
  return new Request("https://www.osintshadow.com/api/auth/password/forgot", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify({ email: " Person@Example.com " }),
  });
}

const forgotPath = "src/app/api/auth/password/forgot/route.js";
const expoPath = "src/app/api/auth/expo-web-success/route.js";

test("reset tokens go only to email and ignore attacker-controlled host headers", () =>
  isolated(async () => {
    const db = database();
    let sent;
    globalThis.fetch = async (url, options) => {
      assert.equal(url, "https://api.resend.com/emails");
      sent = JSON.parse(options.body);
      return Response.json({ id: "synthetic-email" });
    };
    const { POST } = await loadRoute(forgotPath, db);
    const response = await POST(forgotRequest({
      host: "attacker.example",
      "x-forwarded-host": "attacker.example",
      "x-forwarded-proto": "http",
    }));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.deepEqual(await response.json(), { ok: true });
    assert.equal(sent.to, "person@example.com");
    const link = new URL(sent.text.match(/https:\/\/\S+/)[0]);
    assert.equal(link.origin, "https://www.osintshadow.com");
    assert.equal(link.pathname, "/account/password/reset");
    assert.equal(link.searchParams.get("email"), "person@example.com");
    assert.equal(link.searchParams.get("token"),
      db.calls.find((c) => c.query.startsWith("INSERT")).params[1]);
    assert.doesNotMatch(sent.text, /attacker\.example/);
  }));

test("unknown accounts get the same public reset response without sending email", () =>
  isolated(async () => {
    const db = database(false);
    const { POST } = await loadRoute(forgotPath, db);
    const response = await POST(forgotRequest());
    assert.deepEqual(await response.json(), { ok: true });
    assert.equal(db.calls.length, 1);
  }));

test("missing email configuration does not mint a reset token", () =>
  isolated(async () => {
    const db = database();
    const { POST } = await loadRoute(forgotPath, db);
    assert.deepEqual(await (await POST(forgotRequest())).json(), { ok: true });
    assert.equal(db.calls.length, 0);
  }, { RESEND_API_KEY: undefined }));

test("reset origin must be trusted configuration with HTTPS in production", () =>
  isolated(async () => {
    const db = database();
    const { POST } = await loadRoute(forgotPath, db);
    for (const origin of ["http://public.example", "javascript:alert(1)", "not a URL"]) {
      process.env.APP_URL = origin;
      assert.deepEqual(await (await POST(forgotRequest())).json(), { ok: true });
    }
    assert.equal(db.calls.length, 0);
  }));

test("trusted AUTH_URL can supply the reset origin", () =>
  isolated(async () => {
    const db = database();
    let sent;
    globalThis.fetch = async (_, options) => {
      sent = JSON.parse(options.body);
      return Response.json({ id: "synthetic-email" });
    };
    const { POST } = await loadRoute(forgotPath, db);
    assert.deepEqual(await (await POST(forgotRequest())).json(), { ok: true });
    assert.match(sent.text, /https:\/\/accounts\.example\/account\/password\/reset/);
  }, { APP_URL: undefined, AUTH_URL: "https://accounts.example/api/auth" }));

test("delivery failures invalidate the new token and disclose no provider details", () =>
  isolated(async (logs) => {
    const db = database();
    globalThis.fetch = async () => new Response("private-provider-detail", { status: 500 });
    const { POST } = await loadRoute(forgotPath, db);
    assert.deepEqual(await (await POST(forgotRequest())).json(), { ok: true });
    const token = db.calls.find((c) => c.query.startsWith("INSERT")).params[1];
    const last = db.calls.at(-1);
    assert.match(last.query, /DELETE.*identifier = \$1 AND token = \$2/);
    assert.deepEqual(last.params, ["person@example.com", token]);
    assert.ok(!logs.join(" ").includes(token));
    assert.doesNotMatch(logs.join(" "), /private-provider-detail/);
  }));

test("database failures keep the generic public response", () =>
  isolated(async () => {
    const { POST } = await loadRoute(forgotPath, {
      sql: async () => { throw new Error("private-database-detail"); },
    });
    assert.deepEqual(await (await POST(forgotRequest())).json(), { ok: true });
  }));

test("forgot-password UI has no direct reset-link or delivery-status fallback", async () => {
  const source = await readFile(new URL(
    "../src/app/account/password/forgot/page.jsx", import.meta.url,
  ), "utf8");
  assert.doesNotMatch(source, /resetUrl|emailSent/);
});

async function authMessage(response) {
  const html = await response.text();
  const scripts = [...html.matchAll(/<script nonce="([^"]+)">([\s\S]*?)<\/script>/g)];
  assert.equal(scripts.length, 1);
  assert.equal((html.match(/<\/script>/g) || []).length, 1);
  assert.ok(response.headers.get("content-security-policy")
    .includes("'nonce-" + scripts[0][1] + "'"));
  let delivered;
  vm.runInNewContext(scripts[0][2], {
    window: {
      location: { origin: "https://www.osintshadow.com" },
      parent: { postMessage: (message, origin) => { delivered = { message, origin }; } },
    },
  });
  return { html, delivered };
}

const tokenProvider = (options) => options.raw
  ? "synthetic-session-token"
  : { sub: "synthetic-user", email: "person@example.com", name: "Person" };

test("embedded auth targets only same-origin parents by default", () =>
  isolated(async () => {
    const { GET } = await loadRoute(expoPath, { getToken: tokenProvider });
    const response = await GET(new Request(
      "https://www.osintshadow.com/api/auth/expo-web-success?origin=https://attacker.example",
      { headers: { referer: "https://attacker.example" } },
    ));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(response.headers.get("x-frame-options"), "SAMEORIGIN");
    assert.match(response.headers.get("content-security-policy"), /frame-ancestors 'self';/);
    const { delivered } = await authMessage(response);
    assert.equal(delivered.origin, "https://www.osintshadow.com");
    assert.equal(delivered.message.jwt, "synthetic-session-token");
  }));

test("an explicitly configured parent must receive an exact origin target", () =>
  isolated(async () => {
    const { GET } = await loadRoute(expoPath, { getToken: tokenProvider });
    const response = await GET(new Request("https://www.osintshadow.com/api/auth/expo-web-success"));
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-security-policy"),
      /frame-ancestors https:\/\/trusted-app\.example;/);
    assert.equal((await authMessage(response)).delivered.origin, "https://trusted-app.example");
  }, { EXPO_AUTH_PARENT_ORIGIN: "https://trusted-app.example" }));

test("invalid parent configuration fails closed before reading a session token", () =>
  isolated(async () => {
    let calls = 0;
    const { GET } = await loadRoute(expoPath, { getToken: () => { calls++; return "secret"; } });
    for (const value of ["*", "https://trusted-app.example/path", "https://user:pass@host.example",
      "http://public.example", "javascript:alert(1)"]) {
      process.env.EXPO_AUTH_PARENT_ORIGIN = value;
      const response = await GET(new Request("https://www.osintshadow.com/api/auth/expo-web-success"));
      assert.equal(response.status, 503);
      assert.doesNotMatch(await response.text(), /secret/);
    }
    assert.equal(calls, 0);
  }));

test("profile fields cannot break out of the embedded auth script", () =>
  isolated(async () => {
    const name = "</script><script>throw new Error('injected')</script>\u2028";
    const { GET } = await loadRoute(expoPath, {
      getToken: (options) => options.raw ? "synthetic-session-token" : { sub: "id", name },
    });
    const response = await GET(new Request("https://www.osintshadow.com/api/auth/expo-web-success"));
    const result = await authMessage(response);
    assert.equal(result.delivered.message.user.name, name);
    assert.doesNotMatch(result.html, /<script>throw/);
  }));

test("signed-out embedded auth returns an error without a session token", () =>
  isolated(async () => {
    const { GET } = await loadRoute(expoPath, { getToken: () => null });
    const response = await GET(new Request("https://www.osintshadow.com/api/auth/expo-web-success"));
    assert.equal(response.status, 401);
    const { delivered } = await authMessage(response);
    assert.equal(delivered.message.type, "AUTH_ERROR");
    assert.equal(delivered.message.jwt, undefined);
  }));

test("embedded auth without AUTH_SECRET fails closed", () =>
  isolated(async () => {
    const { GET } = await loadRoute(expoPath, {
      getToken: () => { throw new Error("Token lookup should not run"); },
    });
    const response = await GET(new Request("https://www.osintshadow.com/api/auth/expo-web-success"));
    assert.equal(response.status, 503);
    assert.equal(response.headers.get("cache-control"), "no-store");
  }, { AUTH_SECRET: undefined }));
