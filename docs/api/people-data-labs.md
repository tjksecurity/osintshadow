# People Data Labs integration contract v1

Reviewed/approved by the read-only configuration_requirements planner, 2026-11-04.
Result schema: `people-data-labs.schema.json`.

Implementation plan: adapter and schema tests; optional flag through both existing
processors; isolated persisted result; AI payload exclusion; opt-in UI and escaped
report/detail presentation; synthetic regression suite. No activation/live calls.
Do not inject a missing legacy flag into readStoredProcessingFlags: start/regenerate
compare the serialized stored flags. Callers use literal `=== true` instead.

## Existing application interface (additive)

The authenticated, account-owned investigation creation flow accepts the optional
boolean `include_people_data_labs`, default false. Only literal true opts in.
Trials force false. Persist as optional `includePeopleDataLabs` in existing
processing_flags; legacy rows without it remain valid and mean false. No new
endpoint, auth scheme, database column or migration. Existing ownership checks,
credit checks and route responses remain unchanged.

Both processing paths pass this flag into collectOSINT. Result is stored at
`osint_raw.data_json.people_data_labs`, displayed in OSINT details and escaped HTML
reports. Missing results in historical reports are omitted. Provider failures are
nonfatal to other collectors and are never represented as a successful lookup.
Do not add provider matches to identity graphs, confidence scores or discovery
seeds. Match likelihood is provider-reported (1–10), not verified identity or
ownership. Returned professional/company information can be stale or inaccurate.
Exclude people_data_labs from the existing external AI request so provider matches
cannot be promoted into identity/risk claims or forwarded to another provider.

## Provider service interface

Server only, fixed HTTPS origin `https://api.peopledatalabs.com`, GET
`/v5/person/enrich` for an explicitly supplied valid email target (`email` query),
or `/v5/company/enrich` for a valid domain target (`website` query). No discovered
identifier, phone, username, IP, plate or bulk lookups. Person fields are limited
to professional profile data, never private contact, home, demographic or family
fields. Send `X-Api-Key` from server environment `PDL_API_KEY`; never a query key,
browser variable, log, public status response or report.

Require `PDL_ENABLED=true` AND the per-investigation flag AND a nonempty key.
No default activation or existing investigation upgrades. UI warns that provider
credits are separate from ShadowTrace credits. This change does not authorize a
paid request. Configuration/activation is a separate action; no key in source.

Send `min_likelihood=6`, `pretty=false`, and `data_include` restricted to:

- person: id, full_name, linkedin_url, job_title, job_company_name,
  job_company_website, industry.
- company: id, name, website, linkedin_url, industry, size, founded.

One request per opted-in collector invocation, no retries, no redirects,
10-second total deadline through body consumption, 128 KiB maximum response.
No distributed rate limiter or exactly-once provider billing guarantee; existing
investigation lock/checkpoint applies. A process death before persistence can
repeat a lookup on a later invocation. Activation requires accepting this limit.
Never automatically retry rate limits; 429 is reported as rate_limited. No account
quota is assumed. Keys must be stored server-side in the intended environment.

## Normalization and error semantics

All local statuses conform to the adjacent result schema. Always use static safe
messages; never provider error bodies, request identifiers, target strings or keys.
No HTTP endpoint is added; codes below are the upstream provider responses.

- not_requested: flag absent/false (no network)
- not_configured: enable flag/key absent (no network)
- unsupported_target/invalid_target: no network
- matched: HTTP 200, JSON status 200, likelihood integer 6–10 and nonempty
  whitelisted record. Person source is body.data; company source is body itself.
- no_match: HTTP 404, or otherwise valid 200 response with likelihood below 6;
  no record retained.
- authentication_error: HTTP 401/403
- rate_limited: HTTP 429
- provider_error: all other HTTP codes (including 400/402/422/5xx), network failure
- timeout: deadline exceeded
- invalid_response: malformed/oversized JSON, bad envelope or no usable record

Only matched results retain a record/likelihood. Filter all returned objects with
the appropriate kind-specific field allowlist even if PDL ignores data_include.
Strings are trimmed, empty strings dropped and nonempty strings truncated to 300
characters; non-string values are dropped except founded (integer 1–9999).
Unknown fields are discarded. UI uses React text escaping;
HTML reports use existing escapeReportText. No raw provider URL is made clickable.

## Acceptance

Synthetic tests of the real adapter: opt-in/config/target gates, exact fixed URL
and header/projection, person/company envelope distinction, schema conformance,
field filtering, no-match/auth/quota/network/timeout/malformed/oversize responses,
no retry/redirect, and secret non-disclosure. Integration tests cover old/new/trial
flags, both collector callers, persisted output/report escaping and rendered UI.
Tests do not prove live key permissions, billing, data quality or DB persistence.

Official references: https://docs.peopledatalabs.com/docs/authentication,
https://docs.peopledatalabs.com/docs/input-parameters-person-enrichment-api,
https://docs.peopledatalabs.com/docs/output-response-person-enrichment-api,
https://docs.peopledatalabs.com/docs/input-parameters-company-enrichment-api,
https://docs.peopledatalabs.com/docs/output-response-company-enrichment-api.
