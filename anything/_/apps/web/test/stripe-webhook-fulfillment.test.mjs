import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("nested Stripe routes resolve the shared fulfillment module from their parent", async () => {
  for (const route of ["confirm", "webhook"]) {
    const source = await readFile(
      new URL(`../src/app/api/stripe/${route}/route.js`, import.meta.url),
      "utf8",
    );
    assert.match(source, /from "\.\.\/fulfillment\.js"/);
    assert.doesNotMatch(source, /from "\.\/fulfillment\.js"/);
  }
});

async function loadFulfillment() {
  const source = await readFile(
    new URL("../src/app/api/stripe/fulfillment.js", import.meta.url),
    "utf8",
  );
  return import(
    `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`,
  );
}

async function loadWebhook(sql, fulfillment) {
  let source = await readFile(
    new URL("../src/app/api/stripe/webhook/route.js", import.meta.url),
    "utf8",
  );
  const key = `__shadowTraceWebhook_${randomUUID()}`;
  globalThis[key] = { sql, fulfillment };
  source = source
    .replace('import sql from "@/app/api/utils/sql";', `const sql = globalThis[${JSON.stringify(key)}].sql;`)
    .replace('import { fulfillCheckout, validateCheckout } from "../fulfillment.js";', `const { fulfillCheckout, validateCheckout } = globalThis[${JSON.stringify(key)}].fulfillment;`);
  try {
    return await import(
      `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`,
    );
  } finally {
    delete globalThis[key];
  }
}

async function harness() {
  const state = { fulfilled: new Set(), updates: 0, queries: [] };
  const sql = async (strings, ...values) => {
    const query = strings.join("?");
    state.queries.push({ query, values });
    if (query.includes("WITH eligible AS MATERIALIZED")) {
      const [, , sessionId] = values;
      const applied = !state.fulfilled.has(sessionId);
      if (applied) {
        state.fulfilled.add(sessionId);
        state.updates += 1;
      }
      return [{ owner_matches: true, applied }];
    }
    if (query.includes("INSERT INTO logs")) return [];
    throw new Error(`Unexpected query: ${query}`);
  };
  return { state, route: await loadWebhook(sql, await loadFulfillment()) };
}

async function invoiceHarness() {
  const state = {
    customerId: "cus_owner",
    subscriptionId: null,
    plan: "pro",
    credits: 3,
    updates: 0,
    queries: [],
  };
  const sql = async (strings, ...values) => {
    const query = strings.join("?");
    state.queries.push({ query, values });
    if (query.includes("SELECT id, subscription_plan")) {
      const [customerId, subscriptionId] = values;
      const eligible =
        customerId === state.customerId &&
        state.subscriptionId === subscriptionId;
      return eligible ? [{ id: "user-1", subscription_plan: state.plan }] : [];
    }
    if (query.includes("SET monthly_remaining")) {
      state.credits = values[0];
      state.subscriptionId = values[1];
      state.updates += 1;
      return [];
    }
    if (query.includes("SET subscription_plan = NULL")) {
      const [customerId, subscriptionId] = values;
      if (customerId === state.customerId && subscriptionId === state.subscriptionId) {
        state.plan = null;
        state.credits = 0;
        state.subscriptionId = null;
        state.updates += 1;
      }
      return [];
    }
    if (query.includes("INSERT INTO logs")) return [];
    throw new Error(`Unexpected query: ${query}`);
  };
  return { state, route: await loadWebhook(sql, await loadFulfillment()) };
}

function event() {
  return {
    id: "evt_checkout",
    type: "checkout.session.completed",
    data: {
      object: {
        id: "cs_shared",
        customer: "cus_owner",
        subscription: "sub_shared",
        mode: "subscription",
        status: "complete",
        payment_status: "paid",
        metadata: { user_id: "user-1", plan: "pro", credits: "50" },
      },
    },
  };
}

async function deliver(
  route,
  payload,
  valid = true,
  fetchMock,
  timestamp = Math.floor(Date.now() / 1000).toString(),
  extraV1 = "",
) {
  const secret = "webhook-test-secret";
  const raw = JSON.stringify(payload);
  const digest = createHmac("sha256", secret).update(`${timestamp}.${raw}`).digest("hex");
  const previous = process.env.STRIPE_WEBHOOK_SECRET;
  const previousFetch = globalThis.fetch;
  process.env.STRIPE_WEBHOOK_SECRET = secret;
  if (fetchMock) globalThis.fetch = fetchMock;
  try {
    const response = await route.POST(new Request("https://shadowtrace.test/api/stripe/webhook", {
      method: "POST",
      headers: { "stripe-signature": valid ? `t=${timestamp},v1=${digest}${extraV1}` : "t=0,v1=invalid" },
      body: raw,
    }));
    return { status: response.status, body: await response.json() };
  } finally {
    if (previous === undefined) delete process.env.STRIPE_WEBHOOK_SECRET;
    else process.env.STRIPE_WEBHOOK_SECRET = previous;
    globalThis.fetch = previousFetch;
  }
}

test("a signed duplicate checkout webhook can fulfill one shared session only once", async () => {
  const h = await harness();
  assert.deepEqual(await deliver(h.route, event()), { status: 200, body: { received: true } });
  assert.deepEqual(await deliver(h.route, event()), { status: 200, body: { received: true } });
  assert.equal(h.state.updates, 1);
  const claim = h.state.queries.find(({ query }) => query.includes("WITH eligible"))?.query;
  assert.match(claim, /stripe_checkout_fulfillments/);
  assert.match(claim, /ON CONFLICT \(session_id\) DO NOTHING/);
});

test("invalid signatures and unpaid Checkout events cannot grant an entitlement", async () => {
  const h = await harness();
  assert.equal((await deliver(h.route, event(), false)).status, 400);
  const unpaid = event();
  unpaid.data.object.payment_status = "unpaid";
  assert.equal((await deliver(h.route, unpaid)).status, 200);
  assert.equal(h.state.updates, 0);
});

test("renewals require a stored subscription identity and duplicate delivery does not accumulate credits", async () => {
  const h = await invoiceHarness();
  const invoice = {
    id: "in_renewal",
    type: "invoice.payment_succeeded",
    data: { object: { id: "in_renewal", subscription: "sub_1" } },
  };
  const canceledSubscription = async () => Response.json({
    id: "sub_1", status: "canceled", customer: "cus_owner",
  });
  assert.equal((await deliver(h.route, invoice, true, canceledSubscription)).status, 200);
  assert.equal(h.state.credits, 3);
  assert.equal(h.state.updates, 0);

  const activeSubscription = async (url) => Response.json(
    url.includes("/subscriptions/")
      ? { id: "sub_1", status: "active", customer: "cus_owner" }
      : { id: "cus_owner" },
  );
  assert.equal((await deliver(h.route, invoice, true, activeSubscription)).status, 200);
  assert.equal(h.state.credits, 3);
  assert.equal(h.state.subscriptionId, null);
  assert.equal(h.state.updates, 0);

  h.state.subscriptionId = "sub_1";
  assert.equal((await deliver(h.route, invoice, true, activeSubscription)).status, 200);
  assert.equal((await deliver(h.route, invoice, true, activeSubscription)).status, 200);
  assert.equal(h.state.credits, 50);
  assert.equal(h.state.subscriptionId, "sub_1");
  assert.equal(h.state.updates, 2);
});

test("old or cross-customer cancellation cannot clear a replacement subscription", async () => {
  const h = await invoiceHarness();
  h.state.subscriptionId = "sub_current";
  h.state.credits = 50;
  const deleted = (id, customer) => ({
    id: `evt_${id}`,
    type: "customer.subscription.deleted",
    data: { object: { id, customer } },
  });

  assert.equal((await deliver(h.route, deleted("sub_old", "cus_owner"))).status, 200);
  assert.equal((await deliver(h.route, deleted("sub_current", "cus_other"))).status, 200);
  assert.equal(h.state.subscriptionId, "sub_current");
  assert.equal(h.state.credits, 50);

  assert.equal((await deliver(h.route, deleted("sub_current", "cus_owner"))).status, 200);
  assert.equal(h.state.subscriptionId, null);
  assert.equal(h.state.credits, 0);
  assert.equal((await deliver(h.route, deleted("sub_current", "cus_owner"))).status, 200);
  assert.equal(h.state.credits, 0);
});

test("expired signed webhook payloads fail closed", async () => {
  const h = await harness();
  const expiredTimestamp = Math.floor(Date.now() / 1000 - 301).toString();
  assert.equal(
    (await deliver(h.route, event(), true, undefined, expiredTimestamp)).status,
    400,
  );
  assert.equal(h.state.updates, 0);
});

test("signature rotation accepts any valid v1 signature rather than only the last header value", async () => {
  const h = await harness();
  assert.equal(
    (await deliver(h.route, event(), true, undefined, undefined, `,v1=${"0".repeat(64)}`)).status,
    200,
  );
  assert.equal(h.state.updates, 1);
});

test("subscription identity migration preserves legacy null rows and enforces non-null uniqueness", async () => {
  const migration = await readFile(
    new URL("../migrations/20261029_stripe_subscription_identity.sql", import.meta.url),
    "utf8",
  );
  assert.match(migration, /ADD COLUMN IF NOT EXISTS stripe_subscription_id text/);
  assert.match(migration, /CREATE UNIQUE INDEX IF NOT EXISTS auth_users_stripe_subscription_id_unique/);
  assert.match(migration, /WHERE stripe_subscription_id IS NOT NULL/);
});
