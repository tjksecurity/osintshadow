# ShadowTrace original-source inventory and acceptance record

## Provenance and preservation

- Product/repository: `tjksecurity/osintshadow` (ShadowTrace), recovered from `https://github.com/tjksecurity/osintshadow.git` on 2026-10-28.
- Recovered revision: `25d7a6a107e29869100d35e44ba0d32ca7e15625` (`main`).
- Original audited revision: `163a22b`; verified as an ancestor of the recovered revision.
- Recovery checkout: this repository. It began clean; all local changes listed by `git status` after recovery belong to this repair.
- Rejected export: `C:\Users\gloss\Documents\Codex\2026-10-18\task\osintshadow\anything\_\apps\web` is explicitly a fixture-only preview. Its own `TEST_PREVIEW.md` states that it omits the production app server, authentication backend, billing route, collector, and persistence. It was not used as the source base.
- Preserved stopped-task material reviewed before mutation: `C:\Users\gloss\Documents\Codex\2026-10-08\task-4\stripe-owner-idempotency.patch`. Its scope was reconciled manually, not blindly applied. The separate named domain-safety patch was not present in the accessible Codex task folders.

## Original application and asset inventory

- Web application: `anything/_/apps/web` — React Router/Hono server, authentication, investigation/report UI, OSINT collectors, Neon SQL adapter, and Stripe routes.
- Mobile application: `anything/_/apps/mobile` — Expo/React Native application and checked-in platform configuration.
- Checked-in original visual assets: `anything/_/apps/mobile/assets/images/adaptive-icon.png`, `favicon.png`, `icon.png`, and `splash-icon.png`; web branding assets include `anything/_/apps/web/src/__create/favicon.png` and `src/components/BrandLogo.jsx`.
- Existing provider configuration remains private and untouched. No `.env` file was copied, printed, modified, or committed.

## Authorized repair completed

The Stripe confirmation endpoint previously accepted a completed Stripe Checkout session without proving that the authenticated account owned its returned customer, and it could apply the same session more than once. The repair:

1. Requires the returned Checkout session ID, `metadata.user_id`, and customer ID to match the signed-in account and that account's already-bound `stripe_customer_id`.
2. Validates plan, credit count, and Stripe mode against the checkout plan map.
3. Requires both `status=complete` and `payment_status=paid` before fulfillment.
4. Adds a reviewable migration that creates a durable session-ID replay barrier and backfills prior confirmation logs.
5. Uses one shared fulfillment module for both browser confirmation and signed `checkout.session.completed` webhooks, so either order can claim a Checkout session only once.
6. Removes raw investigation-request header/body, target-value, and session-token logging while retaining the investigation record and minimal audit fields.
7. Requires an active Stripe subscription before renewal credits are restored and corrects the monitoring route's false "mocked" claim: unsupported sources now truthfully return no posts.
8. Adds a review-only subscription-ID migration: new subscription Checkouts bind their Stripe ID, and renewal/cancellation clear or replenish access only on an exact stored ID match. Legacy rows require trusted reconciliation rather than automatic invoice binding.
9. Fails closed on missing fulfillment schema and rejects stale webhook signatures while allowing Stripe key-rotation headers with any valid `v1` signature.
10. Replaces the original broad 10--15 digit phone regexes in directory/deep-page collection with source-preserving syntax validation. Bare IDs and date-like numbers are discarded; retained values carry `unverified_candidate`, extraction method, and source URL.
11. Keeps public-page phone candidates outside the identity graph and correlation search keys. Reports and UI call them unverified observations, suppress legacy untagged numeric seeds, and treat a user-supplied phone as a search target rather than an ownership finding.

Changed files:

- `anything/_/apps/web/src/app/api/stripe/confirm/route.js`
- `anything/_/apps/web/src/app/api/stripe/fulfillment.js`
- `anything/_/apps/web/src/app/api/stripe/webhook/route.js`
- `anything/_/apps/web/src/app/api/social-monitoring/tick/route.js`
- `anything/_/apps/web/src/app/api/investigations/route.js`
- `anything/_/apps/web/src/app/api/investigations/session/route.js`
- `anything/_/apps/web/src/app/api/investigations/utils/database.js`
- `anything/_/apps/web/src/app/api/investigations/osint/phoneValidation.js`
- `anything/_/apps/web/src/app/api/investigations/osint/directories.js`
- `anything/_/apps/web/src/app/api/investigations/osint/deepweb.js`
- `anything/_/apps/web/src/app/api/investigations/osint/phone.js`
- `anything/_/apps/web/src/app/api/investigations/osint/collector/seedCollection.js`
- `anything/_/apps/web/src/app/api/investigations/osint/collector/targetHandlers.js`
- `anything/_/apps/web/src/app/api/investigations/analysis/ai.js`
- `anything/_/apps/web/src/app/api/investigations/analysis/utils/dataExtractors.js`
- `anything/_/apps/web/src/app/api/investigations/analysis/identity/identityGraph.js`
- `anything/_/apps/web/src/app/api/investigations/analysis/confirmed/confirmedData.js`
- `anything/_/apps/web/src/app/api/investigations/analysis/narrative/actionLog.js`
- `anything/_/apps/web/src/app/api/investigations/analysis/narrative/presentation.js`
- `anything/_/apps/web/src/app/api/investigations/analysis/llm/anthropicEnhancer.js`
- `anything/_/apps/web/src/app/api/investigations/reports/generator.js`
- `anything/_/apps/web/src/components/InvestigationDetail/OSINTTab.jsx`
- `anything/_/apps/web/src/components/InvestigationDetail/ConfirmedDataTab.jsx`
- `anything/_/apps/web/migrations/20261008_stripe_checkout_fulfillments.sql`
- `anything/_/apps/web/migrations/20261029_stripe_subscription_identity.sql`
- `anything/_/apps/web/migrations/README.stripe-confirm.md`
- `anything/_/apps/web/test/stripe-confirm-security.test.mjs`
- `anything/_/apps/web/test/stripe-webhook-fulfillment.test.mjs`
- `anything/_/apps/web/test/investigation-privacy.test.mjs`
- `anything/_/apps/web/test/phone-validation.test.mjs`
- `anything/_/apps/web/package.json`

## Acceptance checklist and evidence

- [x] Recover original source and verify original audited commit ancestry.
- [x] Preserve/identify original app and asset roots without replacing them with fixture records.
- [x] Review the stopped-task Stripe patch and retain its migration prerequisite and scope boundary.
- [x] Add route-level regressions with synthetic Stripe/auth/database boundaries only; they execute the actual handler source.
- [x] Run `node --test test/auth-security.test.mjs test/stripe-confirm-security.test.mjs test/stripe-webhook-fulfillment.test.mjs test/investigation-privacy.test.mjs test/phone-validation.test.mjs` in `anything/_/apps/web`: 35 passed, 0 failed. These are synthetic source-level regressions; they do not validate live collection, provider delivery, or database concurrency.
- [x] Run `git diff --check`: no whitespace errors.
- [x] Run `node --check` on the investigation route plus modified phone extraction, phone lookup, directory, deep discovery, and identity-graph modules: all passed.
- [ ] Run the full `bun run typecheck`, `bun run test`, and `bun run build`. Bun and the dependency tree are unavailable in this execution environment; no installation was performed without approval.
- [ ] Have the database owner review and apply `migrations/20261008_stripe_checkout_fulfillments.sql` before enabling this handler against a production database. This task did not access or alter Neon.
- [x] Coordinate Checkout confirmation and signed `checkout.session.completed` through the same session-ID ledger. Duplicate/reordered deliveries across these two paths cannot apply the same Checkout entitlement twice.
- [ ] Review invoice renewal, cancellation, and other subscription webhook reconciliation separately. This change does not claim global webhook-event idempotency, live provider delivery, or production database concurrency validation.
- [ ] Reconcile legacy accounts with a null `stripe_subscription_id` before expecting renewal/cancellation automation. No signed invoice is allowed to guess and bind that identity, because an older active subscription on the same customer could be incorrect.
- [x] Prevent numeric false positives from becoming phone findings: only contextual/formatted/tel-link candidates survive local syntax checks, retain provenance and uncertainty, and are excluded from confirmed identity output.
- [ ] Validate phone parsing against permitted, benign public pages and regional numbering requirements before treating syntax coverage as complete. No live collection or identity verification was performed here, and syntax validity never proves control or ownership.

## Required rollout and reconciliation order

1. In a non-production copy of the authoritative schema, validate that `logs.metadata_json` is valid JSON and that the application role can create/use the fulfillment table.
2. Apply `20261008_stripe_checkout_fulfillments.sql`; it backfills old confirmation logs and establishes the Checkout replay barrier.
3. Check for duplicate non-null `auth_users.stripe_subscription_id` values (normally none before this change), then apply `20261029_stripe_subscription_identity.sql`.
4. Reconcile legacy paid accounts with null subscription IDs from a trusted Stripe export or operator-reviewed record. Do not infer an ID from a customer alone; a customer can have multiple historical subscriptions.
5. Deploy the application only after both migrations succeed. Missing schema fails closed with HTTP 500 before an entitlement update, but production behavior still requires database validation.

If the application must be rolled back, roll back the application code while retaining both migrations and fulfillment rows. Do not delete fulfillment rows: doing so reopens Checkout replay. If either migration fails, its transaction rolls back; correct the schema/data cause and retry only after review.

## Next step

With operator approval for dependency installation and a non-production database, run the full web checks and validate the migration sequence against the authoritative schema. Then reconcile legacy subscription identities before enabling subscription renewal/cancellation automation. Separately review phone parsing against permitted benign public pages before treating it as broad regional phone support. Do not enable live charges merely by merging this repair.

## 2026-11-01 reconciliation and backup ledger

- Authoritative product binding re-verified: this checkout is `tjksecurity/osintshadow` / original ShadowTrace, not ShadowTrace-Pro, Insight Nexus, SignalForge, or the rejected preview. Its configured origin is `https://github.com/tjksecurity/osintshadow.git`; local `main` and verified remote `main` were both `25d7a6a107e29869100d35e44ba0d32ca7e15625` before this repair branch.
- The original audited `163a22b3d290eb425128b2bf7795682d5c27b1bf` is an ancestor of that base. No original assets were modified.
- Reconciled stopped owner/idempotency patch: `C:\Users\gloss\Documents\Codex\2026-10-08\task-4\stripe-owner-idempotency.patch` (`SHA-256 239E256326605255D7E4CEA90DC68D0403284C618A18439D79D3D229DA2EACD2`) cannot apply cleanly because its migration files already exist and its older confirmation-route hunk has been superseded by the current shared confirm/webhook fulfillment design. Its safe intent is retained by the current fulfillment routes, reviewed migrations, and 35 source-level regressions.
- Preserved separately, without applying SQL or copying it into runtime: stopped untracked draft `signature.js` (`A5F83A0F459DE71A14540D2E6D16338AF16D0C5A6FF49023A728E3799AD2B3F3`), `fulfillment.js` (`674C9C93C84CC5A053051A38B7D38D008E21CAC51E8F69603FB41F222480D0B9`), `20261008_stripe_shared_fulfillment.sql` (`4A37432B633C257F7399913E9327964ECF9B465493482E57581C5C009180F251`), and `stripe-signature.regression.mjs` (`82BF5272132C39B6CD097C64413B9DCABAD919963C9A7E9A50B6291D83BCBC96`) remain in `C:\Users\gloss\Documents\Codex\2026-10-08\task-4\osintshadow-stripe-owner-idempotency\anything\_\apps\web`. The draft fulfillment/migration requires additional schema columns and has no current-schema authorization; it remains an archived review artifact rather than a migration candidate.
- Reconciled stopped domain-safety work: source task base was reported as `163a22b3d290eb425128b2bf7795682d5c27b1bf`, but its Git checkout is currently permission-denied for inspection. Its `implement-domain-safety.py` (`6DA85E48D380537B5BA66136A359AAFD7D9E5D9E36BA5EF1806C8125297731C7`) and `environment-probe.txt` (`0BDBA86F0A4D84006B07B3F2099F35F348EF7038D188C3419407A1E2C6D2248E`) remain preserved at `C:\Users\gloss\Documents\Codex\2026-10-08\task-5`. That incomplete patch would restrict the original platform to domain-only reports and was not imported because it conflicts with the original platform's retained, lawful public-source capability and lacks complete collector coverage or current tests.
- Pending backup action: commit this reconciled source state on the non-production branch `codex/reconcile-shadowtrace-20261101`, push it to the verified origin without force, then compare the remote SHA. No migration, provider call, deployment, or production merge is part of that action.
