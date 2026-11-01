import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";

const root = new URL("../", import.meta.url);
async function sourceModule(path) {
  return import("data:text/javascript;base64," + Buffer.from(await readFile(new URL(path, root), "utf8")).toString("base64"));
}

export async function loadWebhook(sql, fulfillment) {
  const routePath = "src/app/api/stripe/webhook/route.js";
  let source = process.env.SHADOWTRACE_BASELINE_RENEWAL === "1"
    ? execFileSync("git", ["show", "26e719835d6ac68d5224ffd0b0bde5afe9b7b8df:anything/_/apps/web/" + routePath], { cwd: root, encoding: "utf8" })
    : await readFile(new URL(routePath, root), "utf8");
  const key = "__shadowtraceRenewalFixture_" + randomUUID();
  globalThis[key] = { sql, fulfillment: fulfillment ?? await sourceModule("src/app/api/stripe/fulfillment.js"), renewal: await sourceModule("src/app/api/stripe/renewal.js") };
  source = source
    .replace('import sql from "@/app/api/utils/sql";', `const sql = globalThis[${JSON.stringify(key)}].sql;`)
    .replace('import { fulfillCheckout, validateCheckout } from "../fulfillment.js";', `const { fulfillCheckout, validateCheckout } = globalThis[${JSON.stringify(key)}].fulfillment;`)
    .replace('import { fulfillRenewal, validateRenewalInvoice } from "../renewal.js";', `const { fulfillRenewal, validateRenewalInvoice } = globalThis[${JSON.stringify(key)}].renewal;`);
  try { return await import("data:text/javascript;base64," + Buffer.from(source).toString("base64")); }
  finally { delete globalThis[key]; }
}

export function renewalEvent({ id = "in_cycle", eventId = "evt_cycle", created = 1800000000, subscription = "sub_current", customer = "cus_owner", reason = "subscription_cycle", status = "paid" } = {}) {
  return { id: eventId, type: "invoice.payment_succeeded", data: { object: { id, created, subscription, customer, billing_reason: reason, status } } };
}

export async function deliverWebhook(route, payload, { valid = true, fetchMock, timestamp = Math.floor(Date.now() / 1000).toString(), extraV1 = "" } = {}) {
  const secret = "synthetic-webhook-secret";
  const raw = JSON.stringify(payload);
  const digest = createHmac("sha256", secret).update(`${timestamp}.${raw}`).digest("hex");
  const previousSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const previousFetch = globalThis.fetch;
  const previousError = console.error;
  process.env.STRIPE_WEBHOOK_SECRET = secret;
  globalThis.fetch = fetchMock ?? (async () => { throw new Error("Unexpected external request in Stripe fixture."); });
  console.error = () => {};
  try {
    const response = await route.POST(new Request("https://example.invalid/api/stripe/webhook", {
      method: "POST", headers: { "stripe-signature": valid ? `t=${timestamp},v1=${digest}${extraV1}` : "t=0,v1=invalid" }, body: raw,
    }));
    return { status: response.status, body: await response.json() };
  } finally {
    if (previousSecret === undefined) delete process.env.STRIPE_WEBHOOK_SECRET; else process.env.STRIPE_WEBHOOK_SECRET = previousSecret;
    globalThis.fetch = previousFetch;
    console.error = previousError;
  }
}

export async function renewalHarness(overrides = {}) {
  const state = { customerId: "cus_owner", subscriptionId: "sub_current", plan: "pro", credits: 3,
    cursor: null, receipts: new Map(), updates: 0, queries: [], transactions: 0,
    failAudit: false, failOuterAudit: false, schemaMissing: false,
    providerSubscriptionId: null, providerCustomerId: null, subscriptionStatus: "active", ...overrides };
  const sql = async (parts, ...values) => {
    const query = parts.join("?");
    state.queries.push({ query, values });
    if (query.includes("SELECT id::text AS renewal_owner_id")) {
      return values[0] === state.customerId && values[1] === state.subscriptionId
        ? [{ renewal_owner_id: "user-1" }] : [];
    }
    // Baseline operations are retained only to demonstrate the old failure
    // against realistic paid-cycle fixtures before comparing the new source.
    if (query.includes("SELECT id, subscription_plan")) {
      return values[0] === state.customerId && values[1] === state.subscriptionId
        ? [{ id: "user-1", subscription_plan: state.plan }] : [];
    }
    if (query.includes("SET monthly_remaining")) { state.credits = values[0]; state.updates++; return []; }
    if (query.includes("SET subscription_plan = NULL")) {
      if (values[0] === state.customerId && values[1] === state.subscriptionId) { state.plan = null; state.credits = 0; state.subscriptionId = null; state.updates++; }
      return [];
    }
    if (query.includes("INSERT INTO logs")) {
      if (state.failAudit && query.includes("payment_succeeded")) { state.failAudit = false; throw new Error("Synthetic renewal audit failure"); }
      if (state.failOuterAudit && query.includes("stripe_webhook")) { state.failOuterAudit = false; throw new Error("Synthetic outer audit failure"); }
      return [];
    }
    throw new Error("Unexpected SQL outside transaction fixture.");
  };
  sql.transaction = async (builder, options) => {
    assert.equal(options.isolationLevel, "ReadCommitted");
    const queries = builder((parts, ...values) => ({ query: parts.join("?"), values }));
    assert.equal(queries.length, 2);
    assert.match(queries[0].query, /FOR UPDATE/);
    assert.match(queries[0].query, /WHERE id::text =/);
    assert.equal(queries[0].values[0], "user-1");
    assert.match(queries[1].query, /users\.id::text =/);
    assert.match(queries[1].query, /ON CONFLICT \(invoice_id\) DO NOTHING/);
    assert.match(queries[1].query, /INSERT INTO stripe_subscription_renewal_cursors/);
    assert.match(queries[1].query, /INSERT INTO logs/);
    assert.match(queries[1].query, /UPDATE auth_users/);
    state.queries.push(...queries);
    state.transactions++;
    if (state.schemaMissing) throw new Error("relation stripe_renewal_receipts does not exist");
    state.beforeTransaction?.(state);
    const [invoiceId, customerId, subscriptionId, created, eventId] = queries[1].values;
    const owner = customerId === state.customerId && subscriptionId === state.subscriptionId;
    const receipt = state.receipts.get(invoiceId);
    const cursor = state.cursor;
    const cursorConflict = owner && cursor && (cursor.userId !== "user-1" || cursor.customerId !== customerId);
    const receiptConflict = owner && receipt && (receipt.userId !== "user-1" || (receipt.customerId && receipt.customerId !== customerId) || (receipt.subscriptionId && receipt.subscriptionId !== subscriptionId));
    const needsReconciliation = owner && cursor && !cursor.ready;
    const ambiguous = owner && cursor?.ready && cursor.created === created && cursor.invoiceId !== invoiceId;
    const stale = owner && cursor?.ready && cursor.created > created;
    const credits = { starter: 10, pro: 50, agency: 200 }[state.plan] ?? 0;
    const applied = Boolean(owner && !receipt && credits && !cursorConflict && !receiptConflict && !needsReconciliation && !ambiguous && !stale);
    // This is a statement model, not a PostgreSQL engine/concurrency proof.
    // Throw before committing the fixture state when its atomic audit fails.
    if (applied && state.failAudit) { state.failAudit = false; throw new Error("Synthetic atomic renewal audit failure"); }
    if (applied) {
      state.receipts.set(invoiceId, { userId: "user-1", customerId, subscriptionId, created, eventId });
      state.cursor = { ready: true, userId: "user-1", customerId, invoiceId, created };
      state.credits = credits;
      state.updates++;
    }
    return [owner ? [{ id: "user-1" }] : [], [{ owner_matches: owner, applied, already_processed: Boolean(receipt),
      needs_reconciliation: needsReconciliation, ambiguous, stale, cursor_conflict: cursorConflict, receipt_conflict: receiptConflict,
      unsupported_plan: owner && !credits }]];
  };
  const route = await loadWebhook(sql);
  const fetchMock = async (url) => {
    if (url.startsWith("https://api.stripe.com/v1/subscriptions/")) {
      const id = url.split("/").at(-1);
      return Response.json({ id: state.providerSubscriptionId ?? id, customer: state.providerCustomerId ?? "cus_owner", status: state.subscriptionStatus });
    }
    if (url.startsWith("https://api.stripe.com/v1/customers/")) return Response.json({ id: url.split("/").at(-1) });
    throw new Error("Unexpected Stripe URL in synthetic fixture.");
  };
  return { state, route, deliver: (payload = renewalEvent(), options = {}) => deliverWebhook(route, payload, { fetchMock, ...options }) };
}
