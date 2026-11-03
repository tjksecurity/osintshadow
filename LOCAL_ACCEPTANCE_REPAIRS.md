# Original ShadowTrace local acceptance repairs — 2026-11-01

## Source and publication boundary

Original product: `tjksecurity/osintshadow`, checkout `original-shadowtrace`, web root `anything/_/apps/web`. Base is `26e719835d6ac68d5224ffd0b0bde5afe9b7b8df`; this is not the fixture preview or another ShadowTrace product. Repairs are for a new local-only branch, `codex/local-acceptance-repairs-20261101`. No push, deployment, account, database record, migration, service setting or payment is part of this change. The last verified preview/CI remain those of the base commit, not evidence for these unpublished repairs.

The original assets, branding, pricing, lockfile, collectors and retained stopped-task artifacts are unchanged. The earlier original-source/asset inventory and historical backup limitations remain in `ORIGINAL_SOURCE_HANDOFF.md`.

## Accepted gaps and repairs

The preceding isolated probes ran actual original source bodies with synthetic boundaries. They exposed missing trusted auth configuration handling, orphanable signup, reusable password-reset mutation, unescaped report values, renewal replay/partial failure/ordering and non-atomic investigation credits. These are correctness/security defects in existing capabilities, not a request for new collectors or changed commercial entitlements.

- Authentication: trusted configured URL/cookie selection; absent secret or invalid configuration fails signed out; token responses are not cached. Signup hashes first, then inserts the user and credentials in one SQL statement. Reset performs a cheap read-only preflight, hashes, then atomically revalidates/claims the token and writes credentials.
- Reports: escape all interpolated untrusted text, permit only HTTP(S) public source URLs without embedded credentials, escape raw JSON, add a restrictive report CSP and sandbox the report iframe without scripts/same-origin. Preserve original report sections and phone provenance/uncertainty. Existing explicit app-relative PDF exports remain supported.
- Renewal: validate signed paid cycle identity and exact current customer/subscription ownership. An invoice receipt and conservative per-subscription cursor guard reset; the account lock, receipt/cursor, unchanged plan reset and entitlement audit are transactional. Checkout owns the initial subscription grant. Ambiguous/legacy ordering fails closed instead of guessing.
- Investigation creation: lock the account and recheck trial/paid eligibility in a fresh Read Committed statement, then commit the debit, queued row and normalized capability flags together. Preserve the existing trial limit, paid defaults and admin policy. The retained debit helper refuses non-positive balances. Tick refuses missing/incomplete capability flags with `409 PROCESSING_FLAGS_REQUIRED` before locking or collecting, rather than silently enabling defaults.

## Exact file inventory

Paths below are relative to `anything/_/apps/web` unless noted.

Authentication:

- Modified `__create/adapter.ts`, `__create/index.ts`, `src/__create/@auth/create.js`, `src/app/api/auth/password/reset/route.js`, `src/app/api/auth/token/route.js`.
- Added `src/__create/auth-cookie-options.js`, `test/auth-persistence.test.mjs`.

Report safety:

- Modified `src/app/api/investigations/reports/generator.js`, `src/components/InvestigationDetail/ReportTab.jsx`.
- Added `src/utils/reportSafety.js`, `test/report-safety.test.mjs`.

Investigation quota/configuration persistence:

- Modified `src/app/api/investigations/route.js`, `src/app/api/investigations/utils/database.js`, `src/app/api/investigations/utils/auth.js`, `src/app/api/investigations/[id]/tick/route.js`.
- Added `src/app/api/investigations/utils/processingFlags.js`, `test/investigation-credit-atomicity.test.mjs`.

Renewals:

- Modified `src/app/api/stripe/webhook/route.js`, `test/stripe-webhook-fulfillment.test.mjs`, `migrations/README.stripe-confirm.md`.
- Added `src/app/api/stripe/renewal.js`, review-only `migrations/20261101_stripe_renewal_receipts.sql`, `test/stripe-renewal-fixture.mjs`, `test/stripe-renewal-security.test.mjs`.

Suite/documentation: modified `package.json` to include all new Node regressions; added this repository-root document and an appended entry in `ORIGINAL_SOURCE_HANDOFF.md`. No dependency additions.

## Verification

In `anything/_/apps/web`, with existing Node `v24.18.0`:

```powershell
$taskTests = Get-ChildItem -LiteralPath test -Filter '*.test.mjs' -File | ForEach-Object FullName
node --test --test-reporter=tap @taskTests
```

Result: 90 tests, 89 passed, zero failed, one skipped. The package-runtime synthetic link fixture is explicitly skipped because the Windows sandbox denies link creation. All 11 Node test files are included in the package test script. New auth persistence tests: 18; report safety: 4; investigation credit/configuration: 12; realistic renewal probes: 13. The remaining 43 are retained regressions.

The 13 realistic renewal probes against baseline `26e7198` produced 10 failures and three passes before repair. The earlier external 15-probe baseline audit produced nine failures and six passes. Those external historical loaders assumed the old separate-call SQL/import contract; after atomic operations/imports changed they are retained as baseline evidence, not misrepresented as current regression results. The new in-repository suites exercise the repaired source with matching synthetic boundaries.

`node --check` passed for all 21 changed/added JS, MJS and TS files (including the two TS files using native syntax stripping); `git diff --check` passed. Native TS syntax checking is not TypeScript type checking. Report JSX isolation is source-asserted here, not compiled/browser acceptance.

No Bun, tsc, psql or local dependency tree is available. Full `bun run typecheck`, Vitest, `bun run test`, production build and packaged smoke were not run for this unpublished repair. They require the supported dependency environment; no installation or additional publication was attempted. Prior green CI applies only to the base commit.

## Integration and reconciliation gates

1. Validate authoritative PostgreSQL ID/FK types, defaults, email/account/token uniqueness, processing_flags type, privileges and triggers. Silent trigger suppression is not modeled by the fixtures; a JavaScript post-result guard cannot roll back an already committed successful statement. Test actual Neon transaction API, locking, single-use claims, rollback and competing requests in a designated non-production database. The two-statement Read Committed transaction API was checked against the existing driver's public 0.10.4 declaration, not a database connection.
2. Follow `migrations/README.stripe-confirm.md` for migration order, consistent historical invoice baseline, exact legacy subscription identity/cursor reconciliation and rollback. All three SQL candidates remain unapplied. Preserve replay receipts on rollback; do not simply reactivate the old non-idempotent renewal handler.
3. Queued legacy investigations with incomplete/missing processing_flags now require explicit configuration reconciliation before collection. Do not auto-fill paid defaults or widen trial capabilities. Normal newly-created rows include the complete normalized configuration atomically.
4. Real auth cookie/JWT interoperability, signup/login/reset email flow, durable report rendering/persistence and lawful provider-backed collection remain unverified. No live account or personal target was used. Historical regeneration's separate child-row deletions remain a distinct unaddressed persistence workflow, not covered by creation atomicity.
5. Sandbox Stripe/Neon delivery, Checkout, cancellations and event replay require designated existing test configuration and permission for test records. Mock-backed tests establish source control flow/issued SQL only, not PostgreSQL concurrency, real webhook delivery or production readiness. No paid/live API was called.
6. Review and run full dependency-backed checks before any separately authorized publication. This local commit is not pushed because its prior branch automatically deploys a preview. Keep the currently working preview unchanged.

Exact commit ID, recovery patch/bundle hashes and local clean-worktree evidence are recorded outside this repository in `../acceptance/LOCAL_REPAIR_VALIDATION.md` after the commit, avoiding a self-referential commit ID.

## 2026-11-03 deployment acceptance safeguard

The browser-visible preview was subsequently verified to report both `DATABASE_URL` and `AUTH_SECRET` missing. Earlier homepage/form rendering and signed-out session `null` establish hosting behavior only; they must not be presented as operational acceptance. A source audit found no demonstrated clearing of the runtime values by the application. The connected Vercel account can see the known team, but the exact project and deployment return 404 and scoped project searches return no match. Configuration inspection/repair therefore stopped before any environment mutation or redeploy. This is a current connection/target visibility gate, not proof of deletion or permission to use another product's database.

Added only a credential-free read-only diagnostic, `scripts/check-deployment.mjs`, with `test/deployment-preflight.test.mjs` and package script registration. It rejects missing runtime configuration, deployment-protection redirects and unexpected auth/API responses instead of treating a rendered homepage or null session as readiness. Its result always keeps authenticated-workflow/database/operational acceptance false: a preflight is not a login or database test. Existing compiled smoke output now explicitly labels itself hosting-only and unverified for authentication/persistence. `README.md` records the distinction and remaining actual workflow gates.

These changes do not supply the missing values, configure any service, replace the backend, create accounts or invoke investigation collectors. All original prices, assets, capabilities, migrations and `a0c64c0` repairs are preserved. Full dependency-backed build/typecheck remain blocked by the unavailable local tool/dependency tree. Fresh test results, exact local commit and additional verified recovery exports are recorded in the external validation record after verification. No push or deployment is part of this safeguard.
