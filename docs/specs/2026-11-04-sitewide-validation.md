# Sitewide theme validation

Source: original `tjksecurity/osintshadow`, baseline
`967fd8bfe622d9660a92a48e4bed87c9bbd0007d`. Sole writer: this existing task.
Delivery: existing `codex/reconcile-shadowtrace-20261101` branch, automatic
`osintshadow-test` Preview only. No production/settings/credentials/data changes.

## Implemented

- Shared Theme/product.css extends the original homepage palette, typography,
  navigation, cards, inputs, buttons, responsive spacing and visible focus.
- Theme/AccountLayout.jsx unifies five account screens with the original logo,
  editorial intro, labelled form card and mobile layout. Existing handlers kept.
- Operational routes and all investigation/form components use the same tokens.
- Not-found screen includes branding and drops the fixed 850px minimum width.
- Report viewer chrome updated; white report canvas and security attributes kept.
- Homepage, dashboard, logo artwork, API routes, utilities, original assets,
  prices, entitlements, provider configuration and stored records are unchanged.
- 12 new synthetic presentation/control regressions in sitewide-theme.test.mjs,
  included in the existing CI test command.

## Local results

Commands run from anything/_/apps/web using existing cached packages:

```
node --import ../../../../../acceptance/register-auth-cache.mjs --import ../../../../../acceptance/register-credits-cache.mjs --test --test-reporter=../../../../../acceptance/compact-test-reporter.mjs test/sitewide-theme.test.mjs
```

12 passed, 0 failed. Actual components rendered with isolated auth/network stubs;
password-reveal controls exercised without submission or credentials.

```
node --import ../../../../../acceptance/register-auth-cache.mjs --import ../../../../../acceptance/register-credits-cache.mjs --test --test-reporter=../../../../../acceptance/compact-test-reporter.mjs test/*.test.mjs
```

318 total: 317 passed, 0 failed, 1 skipped. Skip: synthetic package-link creation
is not permitted by the local environment. This is not a pass for that case.

`git -c core.safecrlf=false diff --check`: passed.

Local AST comparison against the baseline passed for all 45 modified JSX/TSX
files: non-presentation logic and existing event bindings are unchanged after
excluding JSX markup/imports and presentation-only class strings. Comparison
script: task acceptance/check-site-theme-behavior.mjs. Initial comparator runs
flagged class-name template strings; those were presentation differences, not
application defects, and the comparator was narrowed accordingly.

Direct cached Tailwind CLI attempt could not run: `Cannot find module 'arg'`.
No installation attempted. Full typecheck/build and compiled CSS acceptance
remain the existing hosted CI/deployed-browser gates, not claimed local passes.

## Delivery gates

Exact commit, remote equality, Windows/Linux CI, automatic Preview ID, public
desktop/mobile browser evidence and recovery-bundle hash are recorded after
delivery in the task's durable acceptance/SITEWIDE_THEME_20261104.md file.
No additional deployment is submitted when the branch push already triggers one.

Authenticated routes were not opened against live records: dashboard/detail
pages can automatically tick investigations. Fixture rendering is not login,
collection, provider activation, billing or live report acceptance. Previously
recorded browser-injected document hydration errors are separate and not claimed
fixed by this presentation change.

## Review follow-up

Read-only independent review identified two visual defects before final handoff:
plain CSS-variable colors with Tailwind 3 alpha modifiers were not emitted, and
the solid-button substring selector also matched translucent selected controls.
The follow-up uses RGB channel tokens for alpha utilities and an exact CSS class
token selector. Actual installed Tailwind color parsing now has regression
coverage, including selected-target contrast. No event/data handlers changed.

Final local suite: 320 tests, 319 passed, 0 failed, same 1 environment-limited
package-link skip. New theme suite now contains 14 tests. Full hosted checks and
the final deployment identity remain in the task's delivery record.
