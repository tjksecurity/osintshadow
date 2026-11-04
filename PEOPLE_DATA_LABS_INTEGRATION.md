# People Data Labs integration — local validation

2026-11-04. Original tjksecurity/osintshadow, baseline
ced4b7cc7923ae6d8b370dc3be03c463e92dce96, local acceptance repair branch.
Sole implementation owner: this task. No original assets or stopped drafts changed.

Implemented locally against reviewed docs/api/people-data-labs.md and JSON schema:

- Fixed-origin v5 server adapter for explicitly supplied email/domain targets;
  professional/company field projection plus local allowlist, provenance and
  uncertainty. No contact/home/demographic enrichment or identity-graph promotion.
- Header-only server key, explicit per-investigation opt-in plus PDL_ENABLED=true
  and PDL_API_KEY. No retries/redirects; bounded body/deadline; safe failure states.
- Optional persisted flag through tick and legacy processor, retaining exact legacy
  flag serialization; trial opt-out, existing account/credit behavior unchanged.
- New form opt-in, attributed detail/report output, escaped HTML, exclusion from
  external AI payloads. Removed frontend request-body logging in the touched flow.

Actual checks:

1. Existing full dependency-free suite plus new tests: 185 total, 184 passed,
   1 environment-link-creation skip (before final body-interruption correction).
2. Adversarial review found response-body network interruptions were classified as
   malformed JSON. Corrected; added regression. PDL suite after correction:
   27/27 passed, zero skipped.
3. Both-caller wiring is currently static source coverage; collector, adapter,
   external-AI exclusion and React/report rendering execute with synthetic inputs.
   This does not prove live persistence or provider permissions.
4. git diff --check passed before final correction; rerun before publication.
5. Final full Node regression after correction: 186 total, 185 passed, 1 skipped
   for the same environment link-creation restriction, zero failures; exit 0.
   git diff --check also passed. Full build/typecheck have not run for this change.

Commands from anything/_/apps/web:

`node --import ../../../../../acceptance/register-credits-cache.mjs --test test/people-data-labs.test.mjs`

Full Node suite uses both existing register-auth-cache.mjs and
register-credits-cache.mjs loaders and all 16 test/*.test.mjs entries in package.json.
No dependency installation, live provider request, account creation, secret
retrieval/configuration, migration, remote push or deployment performed for PDL.

Remaining gates: execute both caller paths with fixture persistence; full build/
typecheck/CI using approved dependencies; secure PDL_API_KEY configuration and
explicit activation. Vercel non-decrypted key metadata returned no PDL-named keys
for the existing Preview branch. Never paste a key into chat/source. Provider
credits are distinct from unlimited ShadowTrace credits. A crash before persisted
checkpoint may repeat a provider lookup; exactly-once paid billing is NOT claimed.

Latest user request shifts current focus to deep research of free person-search
APIs. Preserve this local integration while researching; current deployed Preview
remains unchanged. No production readiness or authenticated live acceptance claim.
