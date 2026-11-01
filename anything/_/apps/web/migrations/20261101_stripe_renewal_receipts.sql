-- REVIEW ONLY. Do not apply automatically or without the authoritative schema.
-- Requires the earlier Checkout fulfillment and subscription-identity migrations.
BEGIN;

CREATE TABLE stripe_renewal_receipts (
  invoice_id text PRIMARY KEY,
  user_id text NOT NULL,
  customer_id text,
  subscription_id text,
  invoice_created bigint,
  plan text,
  credits integer,
  event_id text,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  CHECK (invoice_created IS NULL OR invoice_created > 0),
  CHECK (credits IS NULL OR credits > 0)
);

CREATE TABLE stripe_subscription_renewal_cursors (
  subscription_id text PRIMARY KEY,
  user_id text NOT NULL,
  customer_id text NOT NULL,
  last_invoice_id text,
  last_invoice_created bigint,
  ready boolean NOT NULL DEFAULT false,
  CHECK ((ready AND last_invoice_id IS NOT NULL AND last_invoice_created IS NOT NULL AND last_invoice_created > 0)
      OR (NOT ready AND last_invoice_id IS NULL AND last_invoice_created IS NULL))
);

-- Known old invoice IDs must not refill credits after rollout. Historical logs
-- lack reliable Stripe invoice-created/subscription data: do not infer them.
INSERT INTO stripe_renewal_receipts (invoice_id, user_id, plan, credits)
SELECT DISTINCT ON (metadata_json::jsonb ->> 'invoice_id')
  metadata_json::jsonb ->> 'invoice_id', metadata_json::jsonb ->> 'user_id',
  metadata_json::jsonb ->> 'plan',
  NULLIF(metadata_json::jsonb ->> 'credits_added', '')::integer
FROM logs
WHERE log_type = 'payment_succeeded'
  AND NULLIF(metadata_json::jsonb ->> 'invoice_id', '') IS NOT NULL
  AND NULLIF(metadata_json::jsonb ->> 'user_id', '') IS NOT NULL
ORDER BY metadata_json::jsonb ->> 'invoice_id', created_at DESC
ON CONFLICT (invoice_id) DO NOTHING;

-- Existing subscriptions require an operator-reviewed invoice baseline. A
-- first delayed invoice is not allowed to guess that legacy ordering state.
INSERT INTO stripe_subscription_renewal_cursors (subscription_id, user_id, customer_id)
SELECT stripe_subscription_id, id::text, stripe_customer_id FROM auth_users
WHERE stripe_subscription_id IS NOT NULL AND stripe_customer_id IS NOT NULL
ON CONFLICT (subscription_id) DO NOTHING;

COMMIT;

-- Rollout: pause/reconcile the old renewal path, validate/backfill historical
-- logs, apply in a non-production schema first, then establish each pending
-- cursor's last_invoice_id/last_invoice_created from trusted Stripe records and
-- set ready=true. Do not use logs.created_at or a customer alone as that proof.
-- Missing schema fails the new handler before granting credits. A later new
-- subscription ID can establish its cursor on its first paid cycle invoice.
-- Distinct invoice IDs sharing the cursor's created second require review;
-- created is a conservative fence, not a claim of total Stripe event ordering.
-- Keep receipts/cursors when rolling back code: deleting them reopens replay.
-- Do not re-enable an older non-idempotent renewal handler without a reviewed
-- reconciliation procedure. Neither this migration nor reconciliation is run
-- by application startup.
