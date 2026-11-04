# Local Auth.js CSRF repair — 2026-11-04 UTC

## Defect and scope

Both deployed `26e7198` and earlier local repair `a0f6a91` passed Auth.js's `skipCSRFCheck` symbol in `anything/_/apps/web/__create/index.ts`. Auth.js 0.37.4 deliberately returns 404 for its CSRF endpoint in that mode and bypasses cookie-token verification. Earlier synthetic preflight responses did not establish the real server contract. This defect was not repaired by the prior authentication persistence/token changes.

The local fix removes that import and configuration property, enabling the library's default CSRF checks. Existing providers, prices, session strategy, embedding-related cookie settings and credentials are unchanged. No database/schema/provider change is included.

## Regression evidence

`test/auth-csrf.test.mjs` extracts the actual server configuration and invokes real installed/locked `@auth/core`, with synthetic persistence/hash implementations and external fetch explicitly forbidden. It covers secure token issuance; missing, mismatched and tampered cookie/token pairs for both credential providers; successful synthetic sign-in/signup; and sign-out validation using an issued synthetic session. With `X-Auth-Return-Redirect`, rejection is asserted from `error=MissingCSRF` plus zero persistence calls, not an incorrect assumption of HTTP 403.

- Before the fix: 15 tests, 14 failed, 1 passed. The real CSRF endpoint returned 404 and the bypass symbol remained configured.
- After the fix: 15 passed, 0 failed, 0 skipped. A test-only sign-out assertion was corrected to supply an issued session cookie before expecting deletion.
- Full existing Node suite plus this file: 125 tests, 124 passed, 0 failed, 1 skipped. The unchanged skip requires permission to create a synthetic Windows package-link/junction; this environment returns EPERM.
- `git diff --check` passed.

Normal installed-dependency command from the web directory:

```text
node --test test/auth-csrf.test.mjs
```

This checkout has no linked dependencies. The successful local run used Node 24 and a separate task-only `acceptance/register-auth-cache.mjs` resolver to read already-present exact lockfile-matched Bun cache packages. No installation, package copy, cache modification, credential access or network request was required. The normal package test command now includes the new test. Full Vitest, typecheck and production build remain unrun here because linked build dependencies are absent.

## Deployment and remaining gate

This source repair is **local only**. The separately approved one-time configuration redeploy completed as `dpl_3mhhW5oRggfrupHcqB6WfwWkaUz9`, READY, still at `26e719835d6ac68d5224ffd0b0bde5afe9b7b8df`; it does not contain this repair or the other unpublished local changes.

The new tests prove real-library behavior with the source configuration and synthetic storage, not deployed Hono/browser interoperability, real PostgreSQL compatibility, an existing-account login or report operation. Keep deployment protection unchanged. Publication needs its applicable Preview source/deployment approval and full build/CI, followed by safe signed-out checks and separately authorized existing-account/data acceptance. Do not treat the rendered sign-in form or restored configuration as a working end-to-end product.
