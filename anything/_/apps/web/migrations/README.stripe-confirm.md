# Stripe confirm repair

The confirm endpoint requires exact Checkout `metadata.user_id` ownership and an existing matching `auth_users.stripe_customer_id`. It does not bind an unassigned customer. Stripe customers returned as IDs or expanded objects are supported. Only sessions with both `status=complete` and `payment_status=paid` are fulfilled. Free/trial (`no_payment_required`), open, expired, and delayed/unpaid sessions do not grant credits. Plans, credit counts, and Checkout modes must match the existing checkout route.

## Rollout prerequisite

Apply `20261008_stripe_checkout_fulfillments.sql` once before enabling this handler. The repository has no migration runner or authoritative schema dump, so this is a reviewable prerequisite and is not applied by the application. The app role needs `SELECT`/`INSERT` on the new table and its existing `UPDATE`/`INSERT` privileges. The migration backfills historical `stripe_confirm` logs; malformed historical JSON deliberately fails the migration rather than silently leaving replays possible.

The session primary key is the durable replay barrier. Keep fulfillment rows indefinitely; removing one permits replay. Both the authenticated confirm endpoint and signed `checkout.session.completed` webhook now use this one fulfillment claim, so duplicate or reordered delivery across those two paths cannot grant the same Checkout session twice. Invoice renewal, cancellation, and other subscription webhook handling remain separate state reconciliation flows; duplicate audit rows may still occur, and this does not claim global webhook-event idempotency.

## Subscription identity prerequisite

Apply `20261029_stripe_subscription_identity.sql` before enabling subscription identity writes. New subscription Checkouts save their returned Stripe subscription ID atomically with the Checkout fulfillment. Renewal and cancellation only act when the event's subscription ID exactly matches the stored value. A legacy null row is not automatically bound or cancelled by an invoice/event: reconcile it with Stripe before assigning an ID rather than guessing from customer ownership alone. Lifetime Checkouts store a null subscription identity.

## Renewal receipt prerequisite (local repair; unapplied)

Review `20261101_stripe_renewal_receipts.sql` after the two prerequisites above. It is not executed at startup and was not applied during this repair. The signed renewal path requires these tables before it can grant credits. Existing plan quantities remain starter 10, pro 50 and agency 200; a cycle resets the remaining balance rather than accumulating credits.

The invoice primary key is the replay barrier. A per-subscription cursor rejects older invoices; different invoice IDs with the same creation second require reconciliation instead of guessing an order. The transaction locks the stable account ID, then rechecks customer/subscription ownership in a fresh Read Committed snapshot. The invoice claim, cursor, balance reset and entitlement audit are one statement within that transaction. Real schema, isolation, rollback and permissions must still be tested against a designated non-production PostgreSQL database; synthetic fixtures do not establish database concurrency.

Only paid `subscription_cycle` invoices authorize this reset. `subscription_create` remains owned by Checkout fulfillment, avoiding a second initial grant. Manual invoices, subscription-update/proration invoices and unsupported billing reasons are logged as skipped and require operator reconciliation, not a new automatic entitlement policy.

Rollout order:

1. Review the authoritative schema, constraints, permissions and triggers, and validate all migrations against a non-production copy. Historical malformed JSON/credit values intentionally fail backfill rather than silently opening replay.
2. Pause or otherwise coordinate delivery to the old non-idempotent renewal implementation while taking a consistent historical baseline. Do not let it grant credits after the baseline is recorded.
3. Apply the Checkout fulfillment migration, then the subscription identity migration; reconcile null identities from trusted records, not customer ID alone.
4. Apply the renewal receipt migration. Historical invoice IDs are retained as receipts. Existing bound subscriptions are seeded with `ready=false`; this intentionally blocks reset until their last accepted invoice ID and original Stripe invoice `created` timestamp are reviewed and recorded together with `ready=true`. Log arrival time is not a substitute. A new subscription ID absent from that baseline may establish its cursor on its first valid paid cycle.
5. Enable the repaired source only after schema and baseline validation. Missing new schema fails before granting a renewal. Retry/reconcile queued events under the receipt/cursor rules and check existing usage before making any manual adjustment.

Retain all Checkout and invoice receipts, subscription identities and cursors on rollback. Do not drop the new tables or re-enable an older non-idempotent handler as a routine rollback: that can reopen replay. Coordinate a reviewed reconciliation/paused-renewal procedure instead. Actual provider delivery, out-of-order live records and sandbox checkout remain separate integration gates; no real record or migration was used here.
