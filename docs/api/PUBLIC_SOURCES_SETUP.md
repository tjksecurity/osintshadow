# Eight public-source adapters: deployment checklist

Source addition only; none of these services was enabled, queried, purchased or
configured by the implementation task. The original PDL integration is separate
and remains inactive without PDL_ENABLED and its server key.

## Before activation

1. Run locked-dependency build/typecheck, all Vitest and Node tests, and rendered
   desktop/mobile/reduced-motion acceptance on an authorized execution surface.
2. Confirm provider commercial/customer-report and retention rights. Public API
   availability does not imply permission to resell data. Review especially Exa
   and Tavily search-result storage, platform attribution/deletion, and Veriphone.
3. Confirm the chosen provider account is on its intended free allowance, with
   paid overages/auto-recharge disabled. Never change billing settings silently.
4. Verify the original database's investigations.id is integer-compatible and
   never reused. Review/apply migrations/20261104_public_source_budgets.sql only
   with database-change approval. This is independent of older billing migrations.
   Inspect actual column types, primary/check constraints and the investigation
   foreign key's ON DELETE CASCADE action: CREATE TABLE IF NOT EXISTS does NOT
   upgrade an older draft table. Migration exit zero alone is not schema proof.
5. Run real PostgreSQL tests of concurrent reservations, exhausted/day/month caps,
   transaction rollback, duplicate attempts, result-save failure, and deletion
   cascade. Synthetic SQL tests are not a substitute.
6. Configure approved secrets using the deployment environment's secure interface;
   never paste keys into chat, source, browser-side environment variables or URLs.

## Server variables (names only; no secrets)

All sources require PUBLIC_SOURCES_ENABLED=true plus their own enable variable.
All default OFF when unset. No environment values were retrieved or changed.

| Source | Additional enable variable | Key |
|---|---|---|
| GitHub | PUBLIC_SOURCE_GITHUB_ENABLED=true | None; anonymous requests |
| Bluesky | PUBLIC_SOURCE_BLUESKY_ENABLED=true | None; public AppView |
| Stack Exchange | PUBLIC_SOURCE_STACKEXCHANGE_ENABLED=true | None; anonymous |
| OpenAlex | PUBLIC_SOURCE_OPENALEX_ENABLED=true | OPENALEX_API_KEY |
| Wikidata | PUBLIC_SOURCE_WIKIDATA_ENABLED=true | None |
| Tavily | PUBLIC_SOURCE_TAVILY_ENABLED=true | TAVILY_API_KEY |
| Exa | PUBLIC_SOURCE_EXA_ENABLED=true | EXA_API_KEY |
| Veriphone | PUBLIC_SOURCE_VERIPHONE_ENABLED=true | VERIPHONE_API_KEY |

Select compatible sources in a NEW investigation. Selection does not itself
enable an unconfigured provider. Trials exclude the new sources. Existing saved
investigations without publicSources retain their original settings. The name
target already existed in the original form; no new target schema is introduced.

Results are kept separately in public_sources, in the detail view and HTML report.
No provider candidates are added to identity graphs/discovery or sent to the
external AI enhancer. Only explicit user targets are queried. Veriphone validates
number format/range, not ownership. Search/profile outputs are unverified candidates.

## Limits and recovery

Project-wide conservative caps live in publicSourceStore.js. They count attempted
requests, including failures, not verified billing credits. An externally shared
key can consume its free allowance elsewhere, so local caps cannot guarantee zero
charges. Per-source results are bounded to five candidates; no auto-pagination,
retries, paid upgrades, scraping follow-up or arbitrary URLs.

Each (investigation,provider) is reserved before outbound traffic. A completed
receipt is reused. A process death after reservation produces lookup_pending on
later attempts, not another possibly billable call. Database timeouts may leave a
late-committing reservation; inspect that receipt before any manual reconciliation.
No reset/delete-receipt UI is provided. Do not clear a receipt merely to retry.

No schema or database connection means budget_unavailable and zero new provider
requests. Result-save failure means persistence_error, with an unresolved receipt
blocking repeat calls. Provider backoff is shared by all investigation workers.

Deleting an investigation cascades its retained provider records but does not
refund aggregate request usage. Keep this cascade and the existing deletion
authorization checks intact. Provider data-removal obligations need an operational
process before activation; a UI redesign is not retention-policy clearance.

Rollback: disable PUBLIC_SOURCES_ENABLED first, stop new lookup traffic, and roll
back application code while retaining budget/attempt tables. Do not drop/reset
budgets or receipts as a rollback step: that erases duplicate/budget protection.
Review unresolved attempts and preserve original osint_raw/report data.

## Verification boundaries

The checked-in tests use synthetic users/targets, injected transport and SQL.
They do not establish live credentials, provider accuracy, license clearance,
PostgreSQL concurrency, authenticated workflow acceptance or successful deployment.
See the repository's PUBLIC_SOURCES_AND_REDESIGN_20261104.md for exact results.
