import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

const routePath = "src/app/api/stripe/confirm/route.js";

// Execute the actual handler while replacing only its auth, database, and Stripe
// transport boundaries. This makes no provider or database calls.
async function loadRoute(mocks) {
  let source = await readFile(new URL(`../${routePath}`, import.meta.url), "utf8");
  const key = `__shadowTraceStripe_${randomUUID()}`;
  globalThis[key] = mocks;
  source = source.replace(
    'import { auth } from "@/auth";',
    `const auth = globalThis[${JSON.stringify(key)}].auth;`,
  );
  source = source.replace(
    'import sql from "@/app/api/utils/sql";',
    `const sql = globalThis[${JSON.stringify(key)}].sql;`,
  );
  source = source.replace(
    'import { fulfillCheckout, validateCheckout } from "./fulfillment.js";',
    `const { fulfillCheckout, validateCheckout } = globalThis[${JSON.stringify(key)}].fulfillment;`,
  );
  try {
    return await import(
      `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`,
    );
  } finally {
    delete globalThis[key];
  }
}

async function loadFulfillment() {
  const source = await readFile(
    new URL("../src/app/api/stripe/fulfillment.js", import.meta.url),
    "utf8",
  );
  return import(
    `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`,
  );
}

function taggedQuery(strings, values) {
  return strings.reduce(
    (query, part, index) => query + (index ? `$${index}` : "") + part,
    "",
  );
}

async function harness({ checkout, user, authenticated = true, schemaMissing = false } = {}) {
  const state = {
    checkout: checkout ?? {
      id: "cs_owned",
      customer: "cus_owner",
      subscription: "sub_owned",
      mode: "subscription",
      status: "complete",
      payment_status: "paid",
      metadata: { user_id: "user-1", plan: "pro", credits: "50" },
    },
    user: user ?? { id: "user-1", stripe_customer_id: "cus_owner" },
    fulfilled: new Set(),
    queries: [],
    fetches: 0,
    updateCount: 0,
  };
  const sql = async (strings, ...values) => {
    const query = taggedQuery(strings, values);
    state.queries.push({ query, values });
    if (query.includes("WITH eligible AS MATERIALIZED")) {
      if (schemaMissing) throw new Error("column stripe_subscription_id does not exist");
      const [userId, customerId, sessionId] = values;
      const ownerMatches =
        Boolean(state.user) &&
        String(state.user.id) === String(userId) &&
        state.user.stripe_customer_id === customerId;
      const applied = ownerMatches && !state.fulfilled.has(sessionId);
      if (applied) {
        state.fulfilled.add(sessionId);
        state.updateCount++;
      }
      return [{ owner_matches: ownerMatches, applied }];
    }
    throw new Error(`Unexpected query: ${query}`);
  };
  const fulfillment = await loadFulfillment();
  const route = await loadRoute({
    auth: async () => (authenticated ? { user: { id: "user-1" } } : null),
    sql,
    fulfillment,
  });
  const fetchMock = async () => {
    state.fetches++;
    return Response.json(state.checkout);
  };
  const call = async (body = { session_id: "cs_owned" }) => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = fetchMock;
    try {
      const response = await route.POST({ json: async () => body });
      return { status: response.status, body: await response.json() };
    } finally {
      globalThis.fetch = originalFetch;
    }
  };
  return { state, call };
}

test("Stripe confirmation rejects unsigned-in and malformed requests before contacting Stripe", async () => {
  const signedOut = await harness({ authenticated: false });
  assert.equal((await signedOut.call()).status, 401);
  assert.equal(signedOut.state.fetches, 0);

  for (const body of [null, {}, { session_id: 42 }, { session_id: "" }]) {
    const h = await harness();
    assert.equal((await h.call(body)).status, 400);
    assert.equal(h.state.fetches, 0);
  }
});

test("Stripe confirmation requires the signed-in user, bound customer, and returned session to agree", async () => {
  const variants = [
    (checkout) => { checkout.metadata.user_id = "attacker"; },
    (checkout) => { delete checkout.metadata.user_id; },
    (checkout) => { checkout.customer = "cus_other"; },
    (checkout) => { checkout.customer = null; },
    (checkout) => { checkout.id = "cs_other"; },
  ];
  for (const mutate of variants) {
    const h = await harness();
    mutate(h.state.checkout);
    assert.equal((await h.call()).status, 403);
    assert.equal(h.state.updateCount, 0);
  }
});

test("Stripe confirmation rejects unbound customers, malformed entitlements, and unpaid sessions", async () => {
  const unbound = await harness({ user: { id: "user-1", stripe_customer_id: null } });
  assert.equal((await unbound.call()).status, 403);
  assert.equal(unbound.state.updateCount, 0);

  for (const mutate of [
    (checkout) => { checkout.metadata.plan = "attacker"; },
    (checkout) => { checkout.metadata.credits = "999"; },
    (checkout) => { checkout.mode = "payment"; },
    (checkout) => { checkout.subscription = null; },
  ]) {
    const h = await harness();
    mutate(h.state.checkout);
    assert.equal((await h.call()).status, 400);
    assert.equal(h.state.updateCount, 0);
  }

  const unpaid = await harness();
  unpaid.state.checkout.payment_status = "unpaid";
  assert.deepEqual(await unpaid.call(), {
    status: 200,
    body: {
      ok: true,
      applied: false,
      status: "complete",
      payment_status: "unpaid",
      message: "Checkout payment not complete yet",
    },
  });
  assert.equal(unpaid.state.updateCount, 0);
});

test("Stripe confirmation uses a single replay-safe claim and preserves credits on replay", async () => {
  const h = await harness();
  assert.deepEqual(await h.call(), {
    status: 200,
    body: { ok: true, applied: true, plan: "pro", credits: 50 },
  });
  assert.deepEqual(await h.call(), {
    status: 200,
    body: { ok: true, applied: false, plan: "pro", credits: 50 },
  });
  assert.equal(h.state.updateCount, 1);
  const query = h.state.queries.find(({ query: text }) => text.includes("WITH eligible"))?.query;
  assert.match(query, /FOR UPDATE/);
  assert.match(query, /stripe_checkout_fulfillments/);
  assert.match(query, /ON CONFLICT \(session_id\) DO NOTHING/);
  assert.match(query, /stripe_customer_id = \$2/);
});

test("Stripe confirmation accepts the known lifetime entitlement and an expanded Stripe customer", async () => {
  const h = await harness();
  h.state.checkout.customer = { id: "cus_owner" };
  h.state.checkout.mode = "payment";
  h.state.checkout.metadata = {
    user_id: "user-1",
    plan: "lifetime",
    credits: "200",
  };
  assert.deepEqual(await h.call(), {
    status: 200,
    body: { ok: true, applied: true, plan: "lifetime", credits: 200 },
  });
  assert.equal(h.state.updateCount, 1);
});

test("missing fulfillment schema fails closed before any entitlement update", async () => {
  const h = await harness({ schemaMissing: true });
  const originalError = console.error;
  console.error = () => {};
  try {
    assert.equal((await h.call()).status, 500);
  } finally {
    console.error = originalError;
  }
  assert.equal(h.state.updateCount, 0);
  assert.equal(h.state.fulfilled.size, 0);
});

test("the rollout migration creates a durable primary-key replay barrier and backfills old confirmations", async () => {
  const migration = await readFile(
    new URL("../migrations/20261008_stripe_checkout_fulfillments.sql", import.meta.url),
    "utf8",
  );
  assert.match(migration, /CREATE TABLE stripe_checkout_fulfillments/);
  assert.match(migration, /session_id text PRIMARY KEY/);
  assert.match(migration, /FROM logs/);
  assert.match(migration, /stripe_confirm/);
  assert.match(migration, /stripe_checkout_fulfilled/);
  assert.match(migration, /ON CONFLICT \(session_id\) DO NOTHING/);
});
