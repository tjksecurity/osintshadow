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
- [x] Run `node --test test/auth-security.test.mjs test/stripe-confirm-security.test.mjs test/stripe-webhook-fulfillment.test.mjs test/investigation-privacy.test.mjs test/phone-validation.test.mjs` in `anything/_/apps/web`: 36 passed, 0 failed. These are synthetic source-level regressions; they do not validate live collection, provider delivery, or database concurrency.
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
- Backup completed: commits `569de3e2766021c548b50abcc4afa57f148134d4` and `4b5d819716eeb2a85f661154f6d1999ffecf39e8` were pushed without force to the non-production branch `codex/reconcile-shadowtrace-20261101`. After the corrective commit, local and remote branch SHA were exactly `4b5d819716eeb2a85f661154f6d1999ffecf39e8`; `main` remained at `25d7a6a107e29869100d35e44ba0d32ca7e15625`.
- CI follow-up resolved: the first branch run (`41287596400`) exposed a real build error: nested `stripe/confirm/route.js` and `stripe/webhook/route.js` used `./fulfillment.js` instead of the parent-relative `../fulfillment.js`. The imports and their data-URL source-test loaders were corrected; the regression suite now includes a route-resolution assertion. Run `41287971982` for `4b5d819` completed successfully on Ubuntu and Windows, including frozen install, typecheck, tests, production build, and built-app smoke check.

## 2026-11-01 Vercel preview verification

- The original-app root was saved in the existing non-production Vercel project `osintshadow-test` as `anything/_/apps/web`. Project activity records this change and the related automatic disabling of root/dependency unchanged-deployment skipping. No production setting was edited.
- The existing empty-root preview deployment remains `dpl_6qeN6moeQ8zVghTJHBex5YZncxhv` for source `21b06f2c9f3aae239a0efd46809a8d36ec5a7729` on `codex/reconcile-shadowtrace-20261101`; it is not evidence of the saved root configuration and its aliases previously returned Vercel 404s.
- One Preview-only redeploy was submitted through Vercel's confirmation dialog for that exact source, with Preview selected and the build cache left off. The dialog closed, but project activity and the deployment list contained no new deployment-created event or deployment ID after repeated read-only refreshes. No second redeploy was issued. As a result there is no new preview URL, homepage result, or signed-out-session result to claim.
- Required follow-up: determine why Vercel accepted the dialog without recording a deployment (project activity/support-visible event history) before any new deployment request. Do not use the prior 404 aliases to assess the saved root configuration.

## Preview hosting repair follow-up

- With explicit user approval, commit `7712436bca994e80f1539360a7bb15d91c5fb058` was pushed to `codex/reconcile-shadowtrace-20261101`. `git ls-remote` confirmed the same remote SHA. GitHub Actions `41353881801` passed on Windows and Ubuntu. The Vercel commit status reports deployment completion at `https://vercel.com/glossontravis-7006s-projects/osintshadow-test/GNJvviKqk3PguZTbCwG5sh4XpKRG`; that status alone does not prove the application serves requests.
- Vercel connector reads for the known project returned 404 and its deployment listing returned 403. No alternate credential, browser, CLI, or route was used to bypass those denials. Anonymous preview checks were redirected into Vercel's authentication surface, so HTTP 200 after redirects was not counted as an application success.
- Source inspection identified an additional concrete hosting gap: `react-router-hono-server@2.13.0` produces a standalone Node listener, and the app had neither a Vercel function entry nor a mapping from its generated server/client output to Vercel. The root-directory correction alone cannot establish SSR/API hosting.
- Prepared a dependency-free hosting adapter: `__create/index.ts` supports explicit fetch mode using the same Hono auth/API middleware and React Router SSR; `api/index.mjs` selects that mode before importing the compiled server; `vercel.json` publishes `build/client`, includes `build/server/**`, and routes application requests to the function. Standalone server behavior remains available.
- Regression: the two new hosting tests failed against the missing entry/config and pass after repair. All 38 dependency-free Node regressions pass; `git diff --check` passes. The built smoke check now tests the real compiled fetch entry, including homepage, signed-out session, API routes and absence of an extra HTTP listener. Full typecheck/build and that compiled smoke require the existing hosted CI dependency environment; no local software/dependency installation was performed.
- Pending: review and publish the hosting repair to the same preview branch, then validate the resulting deployment. Vercel connector permission remains a gate to private deployment diagnostics; no auth bypass or credential expansion is authorized.

## Hosting implementation and packaging evidence

- User explicitly approved `701ae0c` and subsequent necessary preview repairs. Published hosting commits are `701ae0c`, `3fa72db`, `e4baa4e`, and `2b002ef` on the same non-production branch. No merge, production promotion, migration, provider call, or local dependency installation occurred.
- Hosted CI first caught an unnecessary TypeScript directive, then a real cyclic bootstrap caused by awaiting the SSR build during server initialization. The fetch adapter now loads the React Router build lazily, matching the standalone adapter. Authentication reads the Node environment and explicitly uses the existing `/api/auth` route prefix. Synthetic configured-auth smoke tests cover that path without credentials or database calls.
- Full CI run `41355299944` passed on Ubuntu and Windows for `2b002ef0d77f6a56a058ca36eb441bead1b99a9c`. Nevertheless the hosted homepage failed: its original error view reported missing `react-router-dom/dist/index.js` from the generated SSR split build. The signed-out `/api/auth/session` endpoint returned `null` in the authenticated browser. This is a concrete deployment packaging failure, not successful application acceptance. Adding an explicit SSR trace edge did not resolve hosting, so it was removed.
- The packaging correction stages the exact installed production closure used by generated server imports under `build/server/node_modules`, including nested versions, installed peers, optional dependencies and native files. It uses existing Babel build tooling to find external package roots, introduces no dependencies, refuses existing output, and fails above 200 MiB. It does not copy the checkout's development dependency tree or environment files.
- The compiled smoke now copies only deployable server files and the API entry into an isolated temporary directory, then checks homepage, signed-out session, bundled API/configuration behavior and absence of an HTTP listener with and without synthetic auth. It cannot accidentally resolve omitted dependencies from the checkout.
- Local verification of this correction: 42 dependency-free Node tests passed, zero failed, one synthetic package-link test skipped because this Windows sandbox disallows link creation; syntax and whitespace checks passed. Actual artifact size and compiled isolated smoke remain hosted-CI acceptance gates until that correction is pushed.

## Reconciled preview result and historical CI failures

- Hosting source is now `bb09cd09376f4686a584f62371df21459fe8f030` on `codex/reconcile-shadowtrace-20261101`; `git ls-remote` confirmed that exact remote SHA. All earlier repair commits remain in its ancestry. No source assets were replaced.
- Historical failed run `41354622479` (`701ae0c`): TypeScript failed on `__create/index.ts` with `Unused '@ts-expect-error' directive`; corrected in `3fa72db`.
- Historical failed run `41354750539` (`3fa72db`): the standalone smoke passed, then fetch smoke exited 13 with `Detected unsettled top-level await` at `await import('./smoke-fetch.mjs')`; lazy SSR initialization corrected the cycle in `e4baa4e`.
- Historical failed run `41355011995` (`e4baa4e`): standalone and unconfigured fetch smoke passed; configured-auth session returned 400 instead of 200, with Auth.js `UnknownAction: Cannot parse action at /api/auth/session`; the explicit existing auth base path corrected it in `2b002ef`. Windows was cancelled by matrix failure, not established independently failing behavior.
- Run `41355299944` (`2b002ef`) passed both OS jobs, but hosted browser testing still exposed missing SSR dependencies. `a1b4cad` added the production package closure and isolated-deployment smoke. Ubuntu run `41355907778` reports 108 runtime packages / 75.1 MiB, all 43 Node tests passing, plus standalone and isolated fetch smoke passing with synthetic auth both absent and present.
- Browser testing then exposed `react-idle-timer` named-export interop under Vercel's CommonJS loader. `bb09cd0` bundles that package in the existing Vite SSR build. Its Vercel deployment status is successful at `https://vercel.com/glossontravis-7006s-projects/osintshadow-test/EeQNobJkEysi7mjnSj18L3FgSgKm`.
- Verified in the user's existing authenticated browser: the stable branch preview `https://osintshadow-test-git-codex-23e252-glossontravis-7006s-projects.vercel.app/` fully loads the original ShadowTrace landing page after hydration; `/account/signin` shows the original sign-in form; `/api/auth/session` returns `null` when signed out. The old immutable `7rr2hnlha` URL is an older deployment and must be replaced with this branch URL.
- Final source CI `41356047228` for `bb09cd09376f4686a584f62371df21459fe8f030` passed on Ubuntu and Windows: frozen install, typecheck, full tests, production build, standalone smoke and isolated fetch smoke with synthetic auth both absent and present. Ubuntu reports all 43 Node tests passed and 107 runtime packages / 75.0 MiB. The earlier package run `41355907778` also finished successfully on both OSes.
- Hosting file inventory (relative to `anything/_/apps/web`): modified `__create/index.ts`, `vite.config.ts`, `package.json`, `README.md`, and `scripts/smoke-built.mjs`; added `api/index.mjs`, `vercel.json`, `scripts/smoke-fetch.mjs`, `scripts/smoke-packaged.mjs`, `scripts/package-runtime.mjs`, `scripts/stage-runtime.mjs`, `test/serverless-entry.test.mjs`, and `test/package-runtime.test.mjs`. `ORIGINAL_SOURCE_HANDOFF.md` records the exact evidence. Original assets, pricing and lockfile were unchanged.
- Limits: browser acceptance here covers homepage, sign-in rendering and signed-out session only. It does not validate account login, schema rollout, reports persisted to Neon, provider-backed collection, or live billing. Earlier migration/provider/legacy-subscription gates remain in force. No access settings, credentials, production deployment, main merge, live investigation or paid provider call was changed or invoked.

## Local-only acceptance repair follow-up (2026-11-01)

Source-only repairs based on `26e719835d6ac68d5224ffd0b0bde5afe9b7b8df` address demonstrated auth configuration/signup/reset, report escaping/iframe isolation, signed renewal replay/ordering and investigation credit/configuration atomicity defects. Exact file inventory, unchanged assets/commercial behavior, commands/results and schema/migration/legacy reconciliation gates are in `LOCAL_ACCEPTANCE_REPAIRS.md`. Fresh dependency-free verification reports 90 tests: 89 passed, zero failed, one sandbox link-fixture skip. All 21 modified/added JS/MJS/TS files passed native syntax checks; whitespace checks passed. Full dependency-backed typecheck/Vitest/build and actual database/provider acceptance remain unrun for this repair.

The repair is committed only to local `codex/local-acceptance-repairs-20261101` and preserved in a local patch/bundle; exact resulting SHA and artifact verification are recorded in `../acceptance/LOCAL_REPAIR_VALIDATION.md`. It is not pushed or deployed, and the existing preview stays at the previously verified hosting source. All migrations, including the new renewal receipt/cursor candidate, remain unapplied. Historical stopped-draft/denied-checkout backup gaps above are not closed by these current repairs.

## Operational readiness correction (2026-11-03)

Live browser GET `/api/investigations` reports missing `DATABASE_URL` and `AUTH_SECRET`; `/api/auth/error` also returns the configuration error. The earlier homepage/form/session observations above are historical hosting-only evidence, not a usable authentication/persistence acceptance. The known project and deployment are currently not visible through the connected Vercel account, even with the verified team ID. No environment-variable, credential, database, push or deployment mutation was submitted during the new repair attempt; do not substitute a new project, database or untested URL.

The local-only acceptance safeguard adds a read-only deployed preflight and synthetic false-ready regressions, labels the old build smoke as hosting-only, and retains explicit real login/database/core workflow gates. Details and file scope are in `LOCAL_ACCEPTANCE_REPAIRS.md`; exact command results, project lookup failures, commit/recovery artifact evidence and the remaining external visibility prerequisite are in `../acceptance/LOCAL_REPAIR_VALIDATION.md`. It is not a fix for missing deployed configuration and must not be represented as one.
