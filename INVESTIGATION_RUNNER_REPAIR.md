# Investigation halt repair — 2026-11-04

## Source and scope

Original repository: `https://github.com/tjksecurity/osintshadow.git`.
Base: `2393a53e9d6757f08d61769dde1a6a70ad814c52`.
Local branch: `codex/local-acceptance-repairs-20261101`; existing Preview branch:
`codex/reconcile-shadowtrace-20261101`. Root is the sole writer. A second agent
performed source-only review. No original assets, retained stopped patches,
prices, credentials, provider configuration or schema were changed.

User requested investigation halt diagnosis and repair. These are reproduced
source defects, **not an established diagnosis of the user's particular live row**.
The supported connected browser twice redirected the investigations list to the
blank sign-in form, including the user-requested retry. Its available tabs do not
match the signed-in investigation tab described by ambient UI context. No account
credentials, customer findings, live ticks, regenerations, collectors or paid calls
were used. Do not open a detail page for read-only diagnosis: it starts ticks.

## Reproduced and fixed

- Progress selected the first 200 events forever. It now displays the latest 200
  chronologically and reads completed step keys separately, preserving earlier
  checkpoints in the UI.
- Tick selected only the latest 300 events, forgetting completed collectors after
  noisy progress. It now queries distinct terminal checkpoints across the run.
- The client shared an in-flight flag across investigation IDs; an obsolete
  request could block the new ID and rearm the old loop. Each effect now owns and
  retires its request/timers. Permanent/configuration failures and terminal status
  stop retries. The redundant racing `/start` call was removed; `/tick` already
  performs the validated queued-to-processing transition.
- Checkpoint persistence errors could be swallowed and reported as success.
  Terminal checkpoint failures now stop processing, including optional stages;
  existing results remain stored.
- Exceptions after lease acquisition could leave the lease until expiry. A final
  token-scoped release now covers early completion, history reads and error paths.
  Report completion responses now say completed rather than processing.
- `/start` now validates saved settings before saying a queued job is processing,
  rechecks the exact settings at the UPDATE boundary and reports a changed-state
  rejection honestly.
- Regeneration formerly deleted artifacts separately before validating settings.
  It now rejects incomplete settings/running states, locks ownership, rechecks
  status/settings/no-held-token/lease, and performs cleanup + requeue + first
  progress event in a single transaction. Client displays guarded rejections.
  This endpoint was **not invoked against live records**.
- UI explicitly states the existing browser-driven execution requirement. No
  autonomous worker, queue service or paid infrastructure was invented.

## Exact local validation

From `anything/_/apps/web`:

```powershell
node --test test/investigation-runner.test.mjs
node --import ../../../../../acceptance/register-auth-cache.mjs --test test/auth-security.test.mjs test/auth-persistence.test.mjs test/auth-csrf.test.mjs test/stripe-confirm-security.test.mjs test/stripe-webhook-fulfillment.test.mjs test/stripe-renewal-security.test.mjs test/investigation-credit-atomicity.test.mjs test/investigation-privacy.test.mjs test/phone-validation.test.mjs test/report-safety.test.mjs test/serverless-entry.test.mjs test/deployment-preflight.test.mjs test/package-runtime.test.mjs test/investigation-runner.test.mjs
git diff --check
```

Initial corrected harness: **9 tests, 1 passed, 8 failed** against original source.
Expanded repaired runner suite: **19 passed, 0 failed, 0 skipped**. Full Node suite:
**144 tests, 143 passed, 0 failed, 1 skipped**. The existing skipped package-link
test requires synthetic junction/symlink creation denied by this execution
environment; it was not turned into a pass. New tests are included in the normal
package test script. All fixtures are synthetic; no collector was loaded.

`node --check` passed for the changed API modules and new regeneration helper.
Already-cached TypeScript 5.8.3 parsed the changed JSX and hook with zero syntax
diagnostics. This is **not** full typechecking or a production build. No software
was installed. Hosted exact-commit CI/build status must be verified separately.

## Remaining integration and recovery boundaries

- Actual authenticated user/job status, last stage and core report acceptance
  remain unverified. Last 30-minute deployment runtime-log query returned no
  matching investigation console logs; project error query returned no errors.
  Neither result inspects database progress or proves the job worked. A 24-hour
  log query exceeded retention and was not treated as an empty result.
- Missing legacy settings remain fail-closed. Original creation sometimes failed
  to save row flags but independently logged them. Future recovery must inspect
  all original creation records for the ID, validate complete exact flags,
  owner/type/timestamp consistency, conflicts with explicit stored settings and
  legacy target agreement where present. Logs survive deletion; ID reuse/import
  history is unknown. No permissive defaults or automatic restoration were added.
- Tests model persistence boundaries; they do not prove real PostgreSQL rollback,
  constraints, migrations or concurrency. No migrations were applied or added.
- Existing long-running stages have no durable autonomous worker or full
  stale-worker token fencing on every result write. Token-scoped release does not
  prove exactly-once provider execution. Regeneration refuses held tokens even
  when their lease expired; it does not forcibly unlock a potentially live worker.
- Keep production, auth settings, original DB binding and billing unchanged.
  Do not restart jobs or delete artifacts to obtain a passing demonstration.

Publication SHA, remote equality, exact CI/deployment result and next action are
recorded outside the checkout in the task acceptance record after verification,
so updating the evidence does not cause another automatic Preview deployment.
