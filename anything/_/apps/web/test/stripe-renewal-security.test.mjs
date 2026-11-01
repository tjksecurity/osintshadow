import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { renewalHarness, renewalEvent } from "./stripe-renewal-fixture.mjs";
import { RENEWAL_PLAN_CREDITS, validateRenewalInvoice } from "../src/app/api/stripe/renewal.js";
import { PLAN_CREDITS } from "../src/app/api/stripe/fulfillment.js";

test("renewal replay cannot restore credits consumed after the first paid cycle", async () => {
  const h = await renewalHarness();
  assert.equal((await h.deliver()).status, 200);
  assert.equal(h.state.credits, 50);
  h.state.credits = 47;
  assert.equal((await h.deliver()).status, 200);
  assert.equal(h.state.credits, 47);
  assert.equal(h.state.updates, 1);
});

test("a failed renewal audit rolls back the claim, cursor and entitlement", async () => {
  const h = await renewalHarness({ failAudit: true });
  assert.equal((await h.deliver()).status, 500);
  assert.equal(h.state.credits, 3);
  assert.equal(h.state.receipts.size, 0);
  assert.equal(h.state.cursor, null);
  assert.equal((await h.deliver()).status, 200);
  assert.equal(h.state.credits, 50);
});

test("older invoices cannot overwrite usage after a newer cycle invoice", async () => {
  const h = await renewalHarness();
  await h.deliver(renewalEvent({ id: "in_old", created: 1800000000 }));
  await h.deliver(renewalEvent({ id: "in_new", created: 1800001000 }));
  h.state.credits = 44;
  assert.equal((await h.deliver(renewalEvent({ id: "in_old", created: 1800000000 }))).status, 200);
  assert.equal((await h.deliver(renewalEvent({ id: "in_delayed", created: 1800000500 }))).status, 200);
  assert.equal(h.state.credits, 44);
  assert.equal(h.state.updates, 2);
});

test("equal-created distinct invoices and pending legacy cursors require reconciliation", async () => {
  const h = await renewalHarness();
  await h.deliver();
  h.state.credits = 48;
  assert.equal((await h.deliver(renewalEvent({ id: "in_ambiguous" }))).status, 500);
  assert.equal(h.state.credits, 48);
  assert.equal(h.state.receipts.size, 1);
  const legacy = await renewalHarness({ cursor: { ready: false, userId: "user-1", customerId: "cus_owner" } });
  assert.equal((await legacy.deliver()).status, 500);
  assert.equal(legacy.state.credits, 3);
  assert.equal(legacy.state.receipts.size, 0);
});

test("missing renewal schema fails before any entitlement or receipt mutation", async () => {
  const h = await renewalHarness({ schemaMissing: true });
  assert.equal((await h.deliver()).status, 500);
  assert.equal(h.state.credits, 3);
  assert.equal(h.state.updates, 0);
  assert.equal(h.state.receipts.size, 0);
});

test("outer webhook audit failure does not reopen an already committed invoice", async () => {
  const h = await renewalHarness({ failOuterAudit: true });
  assert.equal((await h.deliver()).status, 500);
  h.state.credits = 46;
  assert.equal((await h.deliver()).status, 200);
  assert.equal(h.state.credits, 46);
  assert.equal(h.state.updates, 1);
});

test("renewal requires bound current ownership and matching provider object identities", async () => {
  for (const overrides of [
    { subscriptionId: null }, { subscriptionId: "sub_replacement" }, { customerId: "cus_other" },
    { subscriptionStatus: "canceled" }, { providerSubscriptionId: "sub_other" }, { providerCustomerId: "cus_other" },
  ]) {
    const h = await renewalHarness(overrides);
    await h.deliver();
    assert.equal(h.state.credits, 3);
    assert.equal(h.state.updates, 0);
  }
});

test("an invoice cannot remap a different subscription or customer onto the local owner", async () => {
  const mismatchedSubscription = await renewalHarness({ providerSubscriptionId: "sub_current" });
  assert.equal((await mismatchedSubscription.deliver(renewalEvent({ subscription: "sub_old" }))).status, 500);
  assert.equal(mismatchedSubscription.state.credits, 3);
  const mismatchedCustomer = await renewalHarness();
  assert.equal((await mismatchedCustomer.deliver(renewalEvent({ customer: "cus_other" }))).status, 500);
  assert.equal(mismatchedCustomer.state.credits, 3);
});

test("replacement during the ownership-lock boundary is rechecked before fulfillment", async () => {
  const h = await renewalHarness({ beforeTransaction: state => { state.subscriptionId = "sub_replacement"; } });
  assert.equal((await h.deliver()).status, 200);
  assert.equal(h.state.credits, 3);
  assert.equal(h.state.receipts.size, 0);
});

test("receipt and cursor ownership conflicts cannot grant an entitlement", async () => {
  const receipt = await renewalHarness({ receipts: new Map([["in_cycle", { userId: "other-user", customerId: "cus_owner", subscriptionId: "sub_current" }]]) });
  assert.equal((await receipt.deliver()).status, 500);
  assert.equal(receipt.state.credits, 3);
  const cursor = await renewalHarness({ cursor: { ready: true, userId: "other-user", customerId: "cus_owner", invoiceId: "in_old", created: 1700000000 } });
  assert.equal((await cursor.deliver()).status, 500);
  assert.equal(cursor.state.credits, 3);
});

test("initial, manual and proration invoices do not invent additional monthly grants", async () => {
  for (const reason of ["subscription_create", "subscription_update", "manual", "subscription"]) {
    const h = await renewalHarness();
    assert.equal((await h.deliver(renewalEvent({ reason }))).status, 200);
    assert.equal(h.state.credits, 3);
    assert.equal(h.state.transactions, 0);
  }
});

test("paid-cycle invoice validation supports expanded and Basil subscription identities", async () => {
  const invoice = renewalEvent().data.object;
  assert.equal(validateRenewalInvoice({ ...invoice, subscription: { id: "sub_current" }, customer: { id: "cus_owner" } }, "evt_1").supported, true);
  const modern = { ...invoice, subscription: undefined, parent: { type: "subscription_details", subscription_details: { subscription: "sub_current" } } };
  assert.equal(validateRenewalInvoice(modern, "evt_1").subscriptionId, "sub_current");
  for (const mutate of [
    value => { delete value.created; }, value => { value.created = -1; }, value => { value.customer = null; },
    value => { value.status = "open"; }, value => { value.id = "bad/path"; },
  ]) {
    const invalid = { ...invoice }; mutate(invalid);
    assert.throws(() => validateRenewalInvoice(invalid, "evt_1"));
  }
});

test("renewal credit values preserve the existing plan map and migration is review-only", async () => {
  for (const [plan, credits] of Object.entries(RENEWAL_PLAN_CREDITS)) assert.equal(credits, PLAN_CREDITS[plan]);
  const migration = await readFile(new URL("../migrations/20261101_stripe_renewal_receipts.sql", import.meta.url), "utf8");
  assert.match(migration, /invoice_id text PRIMARY KEY/);
  assert.match(migration, /subscription_id text PRIMARY KEY/);
  assert.match(migration, /ready boolean NOT NULL DEFAULT false/);
  assert.match(migration, /FROM logs/);
  assert.match(migration, /Existing subscriptions require an operator-reviewed invoice baseline/);
});
