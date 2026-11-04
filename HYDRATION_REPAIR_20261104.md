# Browser-injected document sibling repair

## Verified cause

Original repository: `tjksecurity/osintshadow`; base
`c9eaa40be68be1eb6315f2f14b78ed67f3d50d13`. Existing Preview only; main and
Production are not changed. Prior repairs, assets and recovery bundles remain.

In the signed-out Preview `dpl_CjvkcQS1QWxA2PVwXwNgHd9TeVN4`, temporary supported
browser debugging paused at the first React 18 error 418 (not recovery error 423).
The app bundle's `Wr`/`popHydrationState` was completing the `html` fiber, with an
unexpected next DOM node: a direct-child DIV named
`codex-browser-sidebar-comments-root`, after BODY. Its parent had HEAD, BODY,
then that DIV. No user data, tokens or script state were read.

The in-app browser injects its comments widget outside BODY. The error is timing
dependent: a subsequent reload had no new errors when injection happened after
hydration. A temporary attempted relocation on that reload was a no-op because
the widget did not yet exist; it is not counted as proof of the fix. Debugger
pauses were disabled and page execution resumed. No access settings changed.

The prior font parity repair remains valid, but did not address this separate
browser-injection race. Source rendering remains unchanged.

## Scoped fix

- Keep Router 7's default StrictMode/startTransition/document hydration entry.
- Before hydration, watch only HTML's direct children and scan existing children.
- Move only the known misplaced DIV into BODY's tail, preserving the same DOM
  object, contents, attributes, shadow root and listeners. Do not clone or delete
  it, sanitize other nodes, suppress errors, or change framework versions.
- Stop observing when the single-child wrapper commits, on pagehide, or after a
  synchronous hydration failure; rethrow failures unchanged.
- No account, provider, pricing, database, credential or deployment-setting change.

Moving a connected subtree can affect focus/custom-element lifecycle. Synthetic
identity tests do not prove every browser-widget interaction; live verification
must confirm the widget remains and repeated initial page loads have no 418/423.

## Regression evidence and delivery gate

New preservation/timing regressions first ran against an inert helper: 4 passed,
2 failed (widget stayed beside BODY; observer absent). The fix then passed all
9 focused tests. Added coverage also checks nested content and unchanged useId
tree positions; final full-suite result is recorded in the workspace's
`acceptance/PREVIEW_DELIVERY_20261104.md`.

Commands from `anything/_/apps/web` using existing cached locked dependencies:

```text
node --import ../../../../../acceptance/register-credits-cache.mjs --test test/root-hydration.test.mjs
node --import ../../../../../acceptance/register-auth-cache.mjs --import ../../../../../acceptance/register-credits-cache.mjs --test --test-reporter=../../../../../acceptance/compact-test-reporter.mjs test/*.test.mjs
git diff --check
```

The first full-suite candidate run: 304 total, 303 passed, 0 failed, 1 skipped
(synthetic package-link creation unavailable). No local dependencies installed;
full typecheck/build remain hosted-CI checks. Synthetic DOM fixtures check the
guard and entry lifecycle, not real React DOM hydration. Final remote SHA, CI,
Preview identity and browser results must be verified after the authorized push
and recorded in the existing acceptance record. No duplicate deployment request.

Final pre-push full suite including useId coverage: **305 total, 304 passed,
0 failed, 1 skipped**, 3375.9242 ms. Focused hydration coverage: 10 passing tests.
`git diff --check` passed. Independent read-only review found no blocking issue.

Authenticated investigations/reports, database migrations/concurrency, provider
activation and live paid billing remain separate acceptance gates. This fix
does not claim to verify or activate them.

## Bounded host interaction follow-up

The first Preview published at `e89bced` became unreachable to browser control:
the newly opened tab timed out while binding at `Emulation.setFocusEmulationEnabled`.
That is not proof of an application exception or the cause of the timeout.
Independent source review did reveal a missing bound: if the browser host
reparents its widget back, the observer could repeatedly move it. A synthetic
host-reparent regression failed (10 passed, 1 failed), proving this source risk.

The handler now disconnects **before its first and only relocation**. It never
fights the browser host or repeatedly relocates new/replaced nodes. If the host
insists on invalid placement, hydration may still recover with an error; that
limitation is preferable to a potentially unbounded observer loop. This must
not be described as complete browser acceptance until a new live check passes.
