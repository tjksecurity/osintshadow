# Bounded local validation follow-up — 2026-11-04

Starting and source implementation commit:
`4ec2ff21f58e1f7c6413c593f82491887e3d1d18` on
`codex/local-acceptance-repairs-20261101`, original `tjksecurity/osintshadow`.
Initial `git status --porcelain=v1` was empty. Agent inventory showed no other
active writer. One scoped test contributor subsequently edited only
`anything/_/apps/web/test/public-sources-integration.test.mjs`; root owns the record.
No application source, dependencies, lockfile, settings or assets changed.

## Additional acceptance

Added one regression: `executed tick report stage retains persisted source
provenance and unavailable/error states without provider requests`.

It executes the actual report-stage tick and actual `insertReport` against injected
synthetic SQL, reading saved `public_sources`. It checks source ID, safe source URL,
original UTC timestamp, unverified-identity wording, `not_configured` and
`provider_error` statuses, completed checkpoint/status, released lease, unchanged
source evidence and zero provider requests. This closes a test gap, not an
observed application defect. Existing tests already execute legacy processing,
tick OSINT collection, duplicate receipt reuse, unresolved-receipt no-retry,
configuration/error isolation and escaped report provenance.

Run from `anything/_/apps/web`:

```text
node --import ../../../../../acceptance/register-credits-cache.mjs --test test/public-sources-integration.test.mjs
```

Exit 0: 12 passed, 0 failed/skipped.

```text
node --import ../../../../../acceptance/register-auth-cache.mjs --import ../../../../../acceptance/register-credits-cache.mjs --test --test-reporter=../../../../../acceptance/compact-test-reporter.mjs test/*.test.mjs
```

Exit 0: **294 tests, 293 passed, 0 failed/cancelled, 1 skipped**, 3,321.7199 ms.
The unchanged skip is synthetic package-link creation, which this environment
does not permit. Mock SQL is not evidence of real PostgreSQL locking, rollback,
persistence or provider/customer acceptance.

Additional offline check, from the workspace containing `original-shadowtrace`:

```text
node --import ./acceptance/register-credits-cache.mjs ./acceptance/check-public-source-static.mjs
```

Exit 0 at clean implementation commit `4ec2ff2`: 25 source/test files parsed,
2 JSON files parsed, 83 local imports resolved, 8 literal dynamic imports inspected.
Eight external module specifiers intentionally not resolved. Zero network calls
or application modules executed. This is syntax/path validation, not typecheck,
CSS/render validation or a full dependency build. The later test-only addition is
covered by the successful Node suite above.

## Exact build-tooling blocker

Read-only `Test-Path` confirmed no application `node_modules` directory or
`.bin/react-router.cmd`, `.bin/vitest.cmd`, `.bin/tsc.cmd`; generated
`.react-router/types` and `build` directories are also absent.
`createRequire(web/package.json).resolve(name)` returned `MODULE_NOT_FOUND` for
each of the following; existing `bun.lock` pins are:

| Missing from project resolution | Locked version | Required for |
|---|---|---|
| `@react-router/dev` | 7.6.0 | `react-router` CLI, build and route type generation |
| `react-router` | 7.6.0 | Router runtime/toolchain peer |
| `vite` | 6.3.5 | Application bundler |
| `vitest` | 3.2.4 | Standard `npm test` first stage |
| `typescript` | 5.8.3 | `tsc --noEmit` after route type generation |

Node v24.18.0 and npm 11.16.0 are on PATH. Bun was not found on PATH and
`C:/Users/gloss/.bun/bin/bun.exe` is absent; this does not claim a whole-machine
installation inventory. A small identity-checked package cache supports isolated
tests but is not an installed application dependency graph.

The prior `npm run build`, `npm run typecheck` and `npm test` failures occurred
before application compilation: missing `react-router` / `vitest` commands.
They were not needlessly rerun. No code fix or dependency substitution is justified
by these errors. Existing CI `.github/workflows/web-check.yml` specifies Bun 1.4.3
and `bun install --frozen-lockfile --backend=copyfile --cache-dir=.bun-cache`.
That install was NOT run. There is no `package-lock.json`; do not regenerate the
project's dependency resolution with an unreviewed npm install.

## Exact connection-access blocker

Existing saved evidence: the loopback-only visual harness compiled and listened
on `127.0.0.1:43306`, but a Node read failed `connect EACCES` (errno -4092).
Browser attempts made before that denial was known timed out. The harness was
stopped. The precise denying OS/policy subsystem is not established by the error;
do not describe it as a proved firewall, application or Vercel defect.

No probe, server restart, alternative browser route/executor, tunnel or access/
security/network-setting change was attempted in this pass. Browser layout and
interaction acceptance remain blocked, not passed.

## Preservation and next action

`git bundle verify ../acceptance/public-sources-redesign-4ec2ff2.bundle` passed.
Unchanged SHA-256:
`5FE8F7AEEC401489F7C211619793C8437C44A32DE359189CD2E649E572A21C76`.
It contains `4ec2ff21f58e1f7c6413c593f82491887e3d1d18` and prior PDL commit,
requiring existing base `ced4b7cc7923ae6d8b370dc3be03c463e92dce96`.
The follow-up local commit/bundle identifiers are recorded after creation in
`../acceptance/public-sources-redesign-backup.md`; earlier artifacts are preserved.

Remote backup remains pending: this branch has previously triggered an automatic
Vercel Preview on push, and this follow-up explicitly forbids push/deployment.
Remote SHA and CI were not queried; no publication or new CI result is claimed.

Next dependency-bound action requires the already-pending permission to restore
the locked dependency tree (and approved pinned Bun availability), then run full
typecheck, Vitest, production build and built smoke checks. Browser acceptance
separately requires an authorized resolution of the current loopback access
denial before any retry. Provider activation additionally needs reviewed terms,
separate database-migration approval and secure server-key configuration; these
were neither requested again nor performed. All migrations remain unapplied,
unconfigured providers inactive, existing deployment unchanged.
