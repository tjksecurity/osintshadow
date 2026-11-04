# Owner investigation credit display — 2026-11-04

User request: make my account have unlimited credits. Original repository
`tjksecurity/osintshadow`, base `5a21b8b57f4c6755ad70248340e654fa5122f667`.
Root remains sole writer; a second agent performed read-only review.

## Existing entitlement, not a new role grant

Both `investigations/utils/auth.js` and the atomic creation statement already
exempt DB role `admin` or the original owner address `glossontravis@gmail.com`
from trial limits and credit decrements. Those rules are unchanged. No account
row, role, plan, balance, billing event, provider, secret or schema was mutated.
No finite sentinel, large balance, fake subscription or admin promotion was used.

The connected browser exposes only a signed-out session, not the ambient new
investigation tab. The user's actual app email was asked asynchronously and was
not yet confirmed when this record was written. Do not claim a new entitlement
was granted to an unidentified account. A different non-exempt account requires
identity verification and a credit-only entitlement design; it must not be
promoted to admin to satisfy this request.

## Defect and repair

JWT sessions include identity but not current DB credits/plan/role. The old UI
rendered missing balances as zero and always said one credit would be deducted,
including for accounts the backend already treats as unlimited.

- New read-only `GET /api/user/credits`: authenticates, reads only current
  session-user ID, uses existing backend entitlement policy, returns a minimal
  `credits_unlimited`/remaining/trial summary with private no-store headers.
  No query/body account selector or write method exists. Errors never expose DB
  details or become a fabricated zero balance.
- `useInvestigationCredits`: account-keyed query, abort support, no-store fetch,
  response-identity and shape checks, refresh on focus. This does not alter the
  auth session or provide admin privileges. Current Auth.js session identity also
  gates the result, masking the stale profile exposed by the existing useUser
  hook during account changes.
- New-investigation warning/form, dashboard and billing read actual entitlement
  and show Unlimited for an exempt account. Unknown/error states remain explicit
  and cannot be mistaken for a purchase requirement. Creation remains enforced
  by the unchanged atomic backend. Unlimited is separate from `isAdmin` UI gates.
- Existing billing confirmation refreshes the credit read. No prices, Checkout
  behavior, grants or customer commitments changed.

## Verification

Local tests used already-cached React18.3.1, ReactDOM18.3.1 and TypeScript5.8.3
through the task-only `acceptance/register-credits-cache.mjs`. No packages were
installed. Component assertions render real component code through React's server
renderer; unrelated child input controls are stubbed. API/SQL tests use synthetic
records, not live DB data or investigations.

Initial test run: 8 total, 2 passed, 6 failed (two reproduced misleading UI;
four covered new endpoint/hook contracts before implementation). After repair:
14 credit-display/API/hook tests plus13 credit/creation tests all passed.
One intermediate assertion mistakenly matched the correct phrase “no credits are
deducted”; it was narrowed to the actual bad “no credits remaining” warning.

Full local Node suite: **159 total,158 passed,0 failed,1 skipped**. Existing skip
is the environment-denied synthetic package-link/junction test. New tests are in
the normal package test command. Changed JS syntax, JSX parsing with the cached
compiler, and `git diff --check` passed. These are not live DB/concurrency proofs.
The account-switch test controls the useQuery boundary; it is not a full mounted
React Query/browser lifecycle test. Trial messaging is neutral about remaining
eligibility; the unchanged creation route enforces the one-trial rule.

Exact full command from `anything/_/apps/web`:

```powershell
node --import ../../../../../acceptance/register-auth-cache.mjs --import ../../../../../acceptance/register-credits-cache.mjs --test test/auth-security.test.mjs test/auth-persistence.test.mjs test/auth-csrf.test.mjs test/stripe-confirm-security.test.mjs test/stripe-webhook-fulfillment.test.mjs test/stripe-renewal-security.test.mjs test/investigation-credit-atomicity.test.mjs test/investigation-privacy.test.mjs test/investigation-runner.test.mjs test/account-credits.test.mjs test/phone-validation.test.mjs test/report-safety.test.mjs test/serverless-entry.test.mjs test/deployment-preflight.test.mjs test/package-runtime.test.mjs
```

All original assets and prior patches/bundles are preserved. Intended publication
is only the existing `codex/reconcile-shadowtrace-20261101` Preview branch, never
main/production. Exact final SHA, remote equality, CI, deployment, local backup
and remaining live-account gate are recorded in the task acceptance file after
verification, without triggering an extra deployment to update evidence.
