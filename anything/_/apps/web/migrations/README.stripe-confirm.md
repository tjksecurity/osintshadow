# Stripe confirm repair

The confirm endpoint requires exact Checkout `metadata.user_id` ownership and an existing matching `auth_users.stripe_customer_id`. It does not bind an unassigned customer. Stripe customers returned as IDs or expanded objects are supported. Only sessions with both `status=complete` and `payment_status=paid` are fulfilled. Free/trial (`no_payment_required`), open, expired, and delayed/unpaid sessions do not grant credits. Plans, credit counts, and Checkout modes must match the existing checkout route.

## Rollout prerequisite

Apply `20261008_stripe_checkout_fulfillments.sql` once before enabling this handler. The repository has no migration runner or authoritative schema dump, so this is a reviewable prerequisite and is not applied by the application. The app role needs `SELECT`/`INSERT` on the new table and its existing `UPDATE`/`INSERT` privileges. The migration backfills historical `stripe_confirm` logs; malformed historical JSON deliberately fails the migration rather than silently leaving replays possible.

The session primary key is the durable replay barrier. Keep fulfillment rows indefinitely; removing one permits replay. Both the authenticated confirm endpoint and signed `checkout.session.completed` webhook now use this one fulfillment claim, so duplicate or reordered delivery across those two paths cannot grant the same Checkout session twice. Invoice renewal, cancellation, and other subscription webhook handling remain separate state reconciliation flows; duplicate audit rows may still occur, and this does not claim global webhook-event idempotency.

## Subscription identity prerequisite

Apply `20261029_stripe_subscription_identity.sql` before enabling subscription identity writes. New subscription Checkouts save their returned Stripe subscription ID atomically with the Checkout fulfillment. Renewal and cancellation only act when the event's subscription ID exactly matches the stored value. A legacy null row is not automatically bound or cancelled by an invoice/event: reconcile it with Stripe before assigning an ID rather than guessing from customer ownership alone. Lifetime Checkouts store a null subscription identity.
