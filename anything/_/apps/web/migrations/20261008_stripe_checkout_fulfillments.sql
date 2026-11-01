-- Run before enabling the repaired confirm endpoint; this is not runtime DDL.
BEGIN;

CREATE TABLE stripe_checkout_fulfillments (
  session_id text PRIMARY KEY,
  -- Store the canonical textual form without assuming auth_users.id is UUID/int.
  user_id text NOT NULL,
  customer_id text,
  fulfilled_at timestamptz NOT NULL DEFAULT now()
);

-- Block replay of confirmations already recorded by the old endpoint.
-- metadata_json may be text, json, or jsonb, but must contain valid JSON.
INSERT INTO stripe_checkout_fulfillments (session_id, user_id, customer_id)
SELECT DISTINCT ON (metadata_json::jsonb ->> 'session_id')
  metadata_json::jsonb ->> 'session_id',
  metadata_json::jsonb ->> 'user_id',
  metadata_json::jsonb ->> 'customer_id'
FROM logs
WHERE log_type IN ('stripe_confirm', 'stripe_checkout_fulfilled')
  AND NULLIF(metadata_json::jsonb ->> 'session_id', '') IS NOT NULL
  AND NULLIF(metadata_json::jsonb ->> 'user_id', '') IS NOT NULL
ON CONFLICT (session_id) DO NOTHING;

COMMIT;
