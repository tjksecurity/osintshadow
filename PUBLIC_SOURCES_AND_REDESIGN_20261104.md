# Public-source integrations and visual refresh — 2026-11-04

## Source and preservation

Original repository: `https://github.com/tjksecurity/osintshadow.git`.
Checkout: `original-shadowtrace`; web application: `anything/_/apps/web`.
Branch: `codex/local-acceptance-repairs-20261101`.
Starting local commit: `e1af7aea3be7baba060632df864d31870255ad5f` (PDL repairs).
Previously recorded remote/deployed baseline: `ced4b7cc7923ae6d8b370dc3be03c463e92dce96`;
remote state was not refreshed during this implementation.

The existing PDL implementation is retained, including its fixture tests and
inactive-without-key behavior. No original asset was deleted or substituted.
Original pricing, plan commitments, authentication routes, account-credit behavior,
data bindings and investigation architecture remain. This is not the rejected
browser-storage preview or a replacement product.

Scope: eight expressly shortlisted sources (GitHub, Bluesky, Stack Exchange,
OpenAlex, Wikidata, Tavily, Exa, Veriphone), plus landing/dashboard presentation.
No unrelated collectors, database migrations, credentials or live data were used.

## Implemented behavior

- Explicit compatible-source opt-in, strict input whitelist, no trial lookups.
- Fixed HTTPS endpoints, bounded responses/deadlines, no automatic retry or
  pagination, no discovered-identifier expansion or private-contact projection.
- Shared durable attempt/budget design, cached receipt reuse, fail-closed missing
  schema handling, safe errors and source attribution. The SQL migration is a
  review candidate only, NOT applied.
- Candidates are not verified identities. Veriphone validation is not ownership.
  Provider results remain separate from identity graphs and external AI payloads.
- Original collector, legacy processor, tick processor, detail UI and HTML report
  are integrated; no adapter is presented as live when unconfigured.
- Graphite/ice-blue landing and dashboard, original logo, illustrative evidence
  graphic, scroll reveals/progress, responsive navigation, keyboard FAQ and
  reduced-motion behavior. Dashboard uses its existing real API hooks, not fixtures.

The API-contract-first workflow established and reviewed contracts before source
changes. The frontend-design audit guided hierarchy, responsive controls, truthful
states and accessible motion. Its optional `memi` executable was unavailable;
no audit score is claimed. The project GOD MODE workflow kept this work local,
recoverable and off the default branch; it granted no publication authority.

## Exact changed-file inventory

Paths below are relative to `anything/_/apps/web` unless prefixed with `repo:`.

Existing files changed:

- `package.json`
- `src/app/api/investigations/[id]/tick/route.js`
- `src/app/api/investigations/analysis/llm/anthropicEnhancer.js`
- `src/app/api/investigations/osint/collector.js`
- `src/app/api/investigations/processing/processor.js`
- `src/app/api/investigations/reports/generator.js`
- `src/app/api/investigations/utils/processingFlags.js`
- `src/app/dashboard/page.jsx`
- `src/app/investigations/new/page.jsx`
- `src/app/page.jsx`
- `src/components/InvestigationDetail/OSINTTab.jsx`
- `src/components/NewInvestigation/InvestigationForm.jsx`
- `src/hooks/useNewInvestigation.js`
- `test/account-credits.test.mjs` (dependency stub only; existing assertions retained)
- `test/people-data-labs.test.mjs` (dependency stub only; existing assertions retained)

New files:

- `migrations/20261104_public_source_budgets.sql` — UNAPPLIED
- `src/app/api/investigations/osint/publicSourceStore.js`
- `src/app/api/investigations/osint/publicSources.js`
- `src/components/InvestigationDetail/PublicSourceResults.jsx`
- `src/components/Landing/LandingPage.jsx`
- `src/components/Landing/scrollExperience.js`
- `src/components/Landing/shadowtrace.css`
- `src/components/NewInvestigation/PublicSourceOptions.jsx`
- `src/utils/publicSources.js`
- `test/public-source-store.test.mjs`
- `test/public-sources-integration.test.mjs`
- `test/public-sources.test.mjs`
- `test/visual-refresh.test.mjs`
- `repo:docs/api/PUBLIC_SOURCES_SETUP.md`
- `repo:docs/api/public-sources.md`
- `repo:docs/api/public-sources.schema.json`
- `repo:PUBLIC_SOURCES_AND_REDESIGN_20261104.md` (this record)

Local-only supporting artifacts outside the repository, retained in the existing
workspace: `acceptance/compact-test-reporter.mjs`, existing cached-package loaders
`acceptance/register-auth-cache.mjs` and `acceptance/register-credits-cache.mjs`,
and `acceptance/visual-refresh/{server.mjs,preview.jsx,VALIDATION.md}`.
The harness renders actual components with synthetic records and live hooks
disabled; it is not an alternative product or a live result.

## Commands and actual results

Run from `anything/_/apps/web`, using existing cached dependencies; no installs:

```text
node --import ../../../../../acceptance/register-auth-cache.mjs --import ../../../../../acceptance/register-credits-cache.mjs --test --test-reporter=../../../../../acceptance/compact-test-reporter.mjs test/*.test.mjs
```

Exit 0: **293 tests; 292 passed, 0 failed, 0 cancelled, 1 skipped**.
New coverage: 69 adapter tests, 15 store tests, 11 integration tests, 12 visual
refresh tests. Existing suite includes all 27 PDL tests.
The single skip is `dereferences installed package links and refuses links
escaping package content`: this environment does not permit synthetic package
link creation. It is not a pass.

Both real investigation-processing callers execute in isolated tests, with real
collector/adapter/result insertion code and injected transport/SQL. Coverage also
includes safe report/React rendering, external-AI exclusion, trial/legacy flags,
receipt reuse, malformed providers/results, timeouts, quota handling, original
pricing, unlimited credits, scroll cleanup and reduced-motion lifecycle.
SQL mocks do not establish PostgreSQL concurrency, transaction rollback, actual
persistence, provider accuracy or authenticated end-to-end operation.

```text
node --check src/app/api/investigations/osint/publicSources.js
node --check src/app/api/investigations/osint/publicSourceStore.js
node --check src/utils/publicSources.js
git diff --check
```

Passed. Git emitted only LF-to-CRLF normalization warnings.

```text
npm run build
npm run typecheck
npm test
```

All exited 1 because local project dependencies are absent. Build and typecheck:
`'react-router' is not recognized as an internal or external command, operable
program or batch file.` Standard test script: `'vitest' is not recognized as an
internal or external command, operable program or batch file.` The separate Node
suite above passed; it does not substitute for Vitest, typecheck or the full build.

The in-memory visual harness compiled and started on loopback port 43306.
A read probe failed `connect EACCES` (errno -4092). Browser attempts already made
before that denial was known timed out (`ERR_CONNECTION_TIMED_OUT`). No further
route, executor, tunnel or network-setting change was used to bypass the denial.
The fixture server was stopped. Desktop/mobile browser appearance and interactive
visual acceptance remain NOT VERIFIED; there are no accepted screenshots.

## Rollout, rollback and next steps

Follow [PUBLIC_SOURCES_SETUP.md](docs/api/PUBLIC_SOURCES_SETUP.md) in order:

1. Restore approved locked dependencies on an authorized surface, then run full
   build, typecheck, Vitest and browser desktop/mobile/reduced-motion acceptance.
2. Verify provider terms, retention/customer-report rights and free-only account
   settings. Local request budgets do not guarantee a shared key cannot incur costs.
3. Review the original database's ID type and actual constraints; separately
   authorize/apply only `20261104_public_source_budgets.sql`. `IF NOT EXISTS` does
   not upgrade an older draft. Verify the cascade FK, then test real database
   concurrency/rollback/duplicate/save-failure/deletion behavior.
4. Configure approved server-only credentials and individual enable flags through
   a secure credential interface, then separately authorize publication and
   bounded live acceptance. Do not reuse another application's database.

All new provider flags default off. PDL remains separately gated by its own flag
and key. No environment values were read or changed and no provider request was
made. Earlier billing migration/reconciliation gates are not resolved by this work.

Rollback starts by disabling new-source lookups and reverting application code,
while retaining budget/attempt tables and original reports. Never clear unresolved
receipts or reset usage to retry: a timed-out transaction may commit late, and a
provider may already have processed the request. Investigation deletion cascades
retained source receipts but does not refund aggregate usage.

## Delivery state

Source saved and regression-checked locally. The local commit and verified recovery
bundle are recorded after creation in `../acceptance/public-sources-redesign-backup.md`
to avoid a self-referential commit hash. No push, new remote backup, deployment,
schema application, provider activation or authenticated live acceptance occurred
in this implementation. The existing deployed preview is unchanged.
