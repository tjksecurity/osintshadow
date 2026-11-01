export const RENEWAL_PLAN_CREDITS = Object.freeze({ starter: 10, pro: 50, agency: 200 });

function objectId(value, prefix) {
  const id = typeof value === "string" ? value : value?.id;
  return typeof id === "string" && new RegExp(`^${prefix}_[A-Za-z0-9_]+$`).test(id) ? id : null;
}

// Signed invoice snapshots support the original subscription field and the
// Basil parent field. Never derive ownership from an email or metadata alone.
export function validateRenewalInvoice(invoice, eventId) {
  const subscriptionId = objectId(invoice?.subscription, "sub") || (
    invoice?.parent?.type === "subscription_details"
      ? objectId(invoice.parent.subscription_details?.subscription, "sub") : null
  );
  if (!subscriptionId) return { supported: false, reason: "no_subscription" };
  if (invoice.billing_reason === "subscription_create") {
    return { supported: false, reason: "initial_entitlement_owned_by_checkout" };
  }
  if (invoice.billing_reason !== "subscription_cycle") {
    return { supported: false, reason: "billing_reason_requires_reconciliation" };
  }
  const invoiceId = objectId(invoice.id, "in");
  const customerId = objectId(invoice.customer, "cus");
  if (!invoiceId || !customerId || invoice.status !== "paid" ||
      !Number.isSafeInteger(invoice.created) || invoice.created <= 0) {
    throw new Error("Paid cycle invoice lacks a valid identity, customer or creation timestamp.");
  }
  return { supported: true, invoiceId, customerId, subscriptionId,
    invoiceCreated: invoice.created, eventId: typeof eventId === "string" ? eventId : null };
}

// This is one non-interactive database transaction. The first statement holds
// the account lock; the second has a fresh READ COMMITTED snapshot after any
// prior claimant commits. No entitlement is changed outside the atomic CTE.
export async function fulfillRenewal(sql, renewal) {
  if (typeof sql.transaction !== "function") throw new Error("Renewal requires transactional SQL support.");
  // Pick a stable account key before starting the lock transaction. This read
  // does not authorize a grant: customer/subscription ownership is rechecked
  // after the account lock, even if a replacement occurred while waiting.
  const owners = await sql`
    SELECT id::text AS renewal_owner_id FROM auth_users
    WHERE stripe_customer_id = ${renewal.customerId}
      AND stripe_subscription_id = ${renewal.subscriptionId}
    LIMIT 2
  `;
  if (!owners.length) return { applied: false, ownerMatches: false, alreadyProcessed: false, stale: false };
  if (owners.length !== 1) throw new Error("Renewal has ambiguous local ownership.");
  const ownerId = owners[0].renewal_owner_id;
  if (typeof ownerId !== "string" || !ownerId) throw new Error("Renewal owner identity is invalid.");
  const [, rows] = await sql.transaction((tx) => [
    tx`
      SELECT id FROM auth_users
      WHERE id::text = ${ownerId}
      FOR UPDATE
    `,
    tx`
      WITH request AS MATERIALIZED (
        SELECT ${renewal.invoiceId}::text AS invoice_id,
               ${renewal.customerId}::text AS customer_id,
               ${renewal.subscriptionId}::text AS subscription_id,
               ${renewal.invoiceCreated}::bigint AS invoice_created,
               ${renewal.eventId}::text AS event_id
      ), owner AS MATERIALIZED (
        SELECT users.id, users.subscription_plan,
               CASE users.subscription_plan
                 WHEN 'starter' THEN 10 WHEN 'pro' THEN 50 WHEN 'agency' THEN 200
                 ELSE 0 END AS credits
        FROM auth_users AS users, request
        WHERE users.id::text = ${ownerId}
          AND users.stripe_customer_id = request.customer_id
          AND users.stripe_subscription_id = request.subscription_id
      ), state AS MATERIALIZED (
        SELECT owner.*, cursor.subscription_id AS cursor_id, cursor.ready,
               cursor.last_invoice_id, cursor.last_invoice_created,
               cursor.user_id AS cursor_user_id, cursor.customer_id AS cursor_customer_id
        FROM owner CROSS JOIN request
        LEFT JOIN stripe_subscription_renewal_cursors AS cursor
          ON cursor.subscription_id = request.subscription_id
      ), candidate AS MATERIALIZED (
        SELECT state.* FROM state, request
        WHERE credits > 0
          AND (cursor_id IS NULL OR (
            ready AND cursor_user_id = id::text AND cursor_customer_id = request.customer_id
            AND request.invoice_created > last_invoice_created
          ))
      ), claimed AS (
        INSERT INTO stripe_renewal_receipts
          (invoice_id, user_id, customer_id, subscription_id, invoice_created, plan, credits, event_id)
        SELECT request.invoice_id, candidate.id::text, request.customer_id,
               request.subscription_id, request.invoice_created,
               candidate.subscription_plan, candidate.credits, request.event_id
        FROM candidate CROSS JOIN request
        ON CONFLICT (invoice_id) DO NOTHING
        RETURNING *
      ), advanced AS (
        INSERT INTO stripe_subscription_renewal_cursors
          (subscription_id, user_id, customer_id, last_invoice_id, last_invoice_created, ready)
        SELECT subscription_id, user_id, customer_id, invoice_id, invoice_created, true FROM claimed
        ON CONFLICT (subscription_id) DO UPDATE
          SET last_invoice_id = EXCLUDED.last_invoice_id,
              last_invoice_created = EXCLUDED.last_invoice_created
          WHERE stripe_subscription_renewal_cursors.ready
            AND stripe_subscription_renewal_cursors.user_id = EXCLUDED.user_id
            AND stripe_subscription_renewal_cursors.customer_id = EXCLUDED.customer_id
            AND stripe_subscription_renewal_cursors.last_invoice_created < EXCLUDED.last_invoice_created
        RETURNING subscription_id
      ), updated AS (
        UPDATE auth_users AS users SET monthly_remaining = claimed.credits
        FROM claimed JOIN advanced USING (subscription_id)
        WHERE users.id::text = claimed.user_id
          AND users.stripe_customer_id = claimed.customer_id
          AND users.stripe_subscription_id = claimed.subscription_id
        RETURNING users.id, users.subscription_plan, users.monthly_remaining
      ), logged AS (
        INSERT INTO logs (log_type, message, metadata_json)
        SELECT 'payment_succeeded', 'Monthly cycle invoice entitlement applied',
          jsonb_build_object('user_id', updated.id::text, 'plan', updated.subscription_plan,
            'credits_added', updated.monthly_remaining, 'invoice_id', request.invoice_id,
            'customer_id', request.customer_id, 'subscription_id', request.subscription_id,
            'invoice_created', request.invoice_created, 'event_id', request.event_id)
        FROM updated CROSS JOIN request
        RETURNING log_type
      )
      SELECT EXISTS (SELECT 1 FROM owner) AS owner_matches,
             EXISTS (SELECT 1 FROM updated) AS applied,
             EXISTS (SELECT 1 FROM stripe_renewal_receipts AS receipt, request
               WHERE receipt.invoice_id = request.invoice_id) AS already_processed,
             EXISTS (SELECT 1 FROM state WHERE cursor_id IS NOT NULL AND NOT ready) AS needs_reconciliation,
             EXISTS (SELECT 1 FROM state, request WHERE ready
               AND last_invoice_created = request.invoice_created
               AND last_invoice_id <> request.invoice_id) AS ambiguous,
             EXISTS (SELECT 1 FROM state, request WHERE ready
               AND last_invoice_created > request.invoice_created) AS stale,
             EXISTS (SELECT 1 FROM state, request WHERE cursor_id IS NOT NULL
               AND (cursor_user_id <> id::text OR cursor_customer_id <> request.customer_id)) AS cursor_conflict,
             EXISTS (SELECT 1 FROM stripe_renewal_receipts AS receipt, owner, request
               WHERE receipt.invoice_id = request.invoice_id
                 AND (receipt.user_id <> owner.id::text OR
                   (receipt.customer_id IS NOT NULL AND receipt.customer_id <> request.customer_id) OR
                   (receipt.subscription_id IS NOT NULL AND receipt.subscription_id <> request.subscription_id))) AS receipt_conflict,
             EXISTS (SELECT 1 FROM owner WHERE credits = 0) AS unsupported_plan
    `,
  ], { isolationLevel: "ReadCommitted" });
  const result = rows?.[0];
  if (!result) throw new Error("Renewal transaction returned no fulfillment status.");
  if (result.receipt_conflict || result.cursor_conflict) throw new Error("Renewal ownership requires reconciliation.");
  if (!result.already_processed && (result.needs_reconciliation || result.ambiguous || result.unsupported_plan)) {
    throw new Error("Renewal invoice ordering or legacy state requires reconciliation.");
  }
  return { applied: Boolean(result.applied), ownerMatches: Boolean(result.owner_matches),
    alreadyProcessed: Boolean(result.already_processed), stale: Boolean(result.stale) };
}
