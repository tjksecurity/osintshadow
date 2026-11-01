-- Review and apply separately from application deployment; this is not runtime DDL.
BEGIN;

ALTER TABLE auth_users
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text;

-- A Stripe subscription belongs to at most one local account. Null legacy rows
-- remain allowed until a signed active renewal safely binds their identity.
CREATE UNIQUE INDEX IF NOT EXISTS auth_users_stripe_subscription_id_unique
  ON auth_users (stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;

COMMIT;
