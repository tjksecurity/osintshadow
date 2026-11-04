# Public-source adapters v1 (eight-provider extension)

Status: reviewed and approved by planner, 2026-11-04. Additive to original ShadowTrace; no new HTTP route.
Plan: bounded server adapters and shared durable budget/attempt receipts; optional
source selection through existing creation/tick/legacy processors; isolated JSON
persistence, escaped reports/UI, AI exclusion; synthetic acceptance then build.

## Application interface
Existing authenticated POST /api/investigations accepts optional public_sources:
a unique array of at most eight IDs from github, bluesky, stackexchange, openalex,
wikidata, tavily, exa, veriphone. Missing means []; unknown/non-array values
normalize to []. Trials force []. Stored publicSources is optional; legacy rows
without it must remain byte-equivalent on read. Existing ownership/credit/error
responses stay unchanged (400 validation, 401 unauthenticated, 403 credit/trial,
404 missing account/investigation, 500 configuration/persistence). No new auth.
The existing 'name' target is already present; no target schema migration.

Selection normalization rejects the entire selection to [] if not an array,
longer than eight, or containing a non-string/unknown ID; otherwise deduplicates.
Names: trimmed 2-120 Unicode letters/marks plus spaces, apostrophes, dots and
hyphens, at least one letter; no controls or search operators. Generic usernames:
1-100 ASCII letters/digits/underscore/dot/hyphen. GitHub usernames: 1-39 ASCII
alphanumeric/internal hyphens (no consecutive hyphens). Bluesky: multi-label
ASCII domain <=253 characters or did:plc:[a-z2-7]{24}; no guessed suffix.
Veriphone: ^\+[1-9]\d{7,14}$ and existing local phone syntax validator.
Malformed compatible targets become invalid_target before reservation/network.

Only explicitly selected sources and an explicitly supplied name/username/phone
target are sent. Never expand from discovered identifiers. Compatibility:
github username/name; bluesky full-handle/DID username only; stackexchange
username/name (display-name substring); openalex and wikidata name only;
tavily/exa name/username only (public professional profile discovery);
veriphone phone only (explicit international E.164, local validation first).
No email/address/private-contact/face/plate lookup in these adapters.

Store public_sources as array of the adjacent schema at osint_raw.data_json.
Maximum five normalized records/provider, stable source IDs/URLs, UTC timestamp,
static status messages, truncation flag. No raw biographies, contacts, home
addresses, demographics, avatars, social graphs, risk scores or identity merge.
Search returns source title/URL only, not scraped contents/snippets. Provider
results are candidates or identifier validation, never verified identity.
Exclude public_sources from external AI payload and discovery seeds.
Existing reports without this field omit the section.

## Transport and configuration
Server-only fixed HTTPS origins; never user-provided endpoints. No redirects,
retries, auto-pagination, page scraping, or remote image loading. Each adapter has
one 8-second deadline through response body; 256 KiB/response and five results.
Wikidata has at most two sequential requests within the same deadline. Run at
most three provider adapters concurrently. Body/HTTP/network failures are local
nonfatal statuses, never provider exception strings.

Require PUBLIC_SOURCES_ENABLED=true and PUBLIC_SOURCE_<ID>_ENABLED=true.
Credit-based sources additionally require OPENALEX_API_KEY, TAVILY_API_KEY,
EXA_API_KEY, VERIPHONE_API_KEY respectively, header-only. No browser secrets.
No default activation, key retrieval or configuration, billing or deployment.
Public user-agent: ShadowTrace/1.0 (+https://github.com/tjksecurity/osintshadow).
Activation requires provider license/retention review and free-only account
configuration. Local budgets cannot account for other applications using a key.

### Exact requests and projection
- github: anonymous GET api.github.com/users/{validated-login}, or /search/users
  q=quoted-name in:fullname type:user, per_page=5/page=1. Accept GitHub JSON.
  Keep type User only, id/login/name/company; construct github.com/{login}.
  Preserve incomplete_results.
- bluesky: anonymous GET public.api.bsky.app/xrpc/app.bsky.actor.getProfile,
  actor=explicit full handle or did:plc value. Require returned DID/handle.
  Keep did/handle/displayName, construct bsky.app/profile/{did}.
- stackexchange: anonymous GET api.stackexchange.com/2.3/users; fixed
  site=stackoverflow,inname=target,pagesize=5,page=1,sort=name,order=asc.
  No query API key. Keep user_id/display_name; construct stackoverflow.com/users/ID.
  has_more indicates truncation; honor body backoff and quota_remaining.
- openalex: GET api.openalex.org/authors; search=name,per_page=5,
  select=id,display_name,last_known_institutions; Bearer OPENALEX_API_KEY.
  Keep author A-ID/name and institution display names only.
- wikidata: GET www.wikidata.org/w/api.php; action=wbsearchentities,type=item,
  search=name,language=en,uselang=en,limit=5,format=json. Second wbgetentities
  request for <=5 validated Q-IDs,props=claims. Retain only nondeprecated
  P31=Q5; discard all claims; retain Q-ID,label and constructed page URL.
- tavily: POST api.tavily.com/search with Bearer TAVILY_API_KEY;
  query=quoted target public professional profile; topic=general,
  search_depth=basic,max_results=5,auto_parameters=false,include_answer=false,
  include_raw_content=false,include_images=false; include_domains restricted to
  public professional/profile platforms. Keep result title and safe source URL.
- exa: POST api.exa.ai/search with x-api-key EXA_API_KEY;
  query=quoted target professional profile,type=lite,numResults=5,category=people,
  includeDomains same profile domains. Omit contents/outputSchema/agent extras.
  Keep title/id(URL) and safe source URL only.
- veriphone: GET api.veriphone.io/v3/verify with Bearer VERIPHONE_API_KEY;
  phone=explicit international value,mode=static,record=false. Keep phone_valid,
  phone_type,country_code,carrier only. No returned phone/location/owner.
  A false phone_valid is a completed validation, not no_match.

Public result links: construct platform links where possible; search links only
on github.com, stackoverflow.com, bsky.app, orcid.org, openalex.org, wikidata.org,
linkedin.com (including www/subdomains), https only, no userinfo/IP/local hosts,
no query/fragment retained. Merely linking doesn't call/scrape those services.
No raw provider URL is fetched. Display text escaping plus URL validation apply.

## Durable request budget and duplicate safety
Review-only migration creates osint_provider_budgets and osint_provider_lookups,
separate from billing. No migration is applied by code or this task.
Lookup receipts reference investigations(id) with ON DELETE CASCADE; deleting an
investigation erases its retained provider records but never refunds aggregate
budget usage. IDs must be integer-compatible, unique and not reused; verify that
existing column type before applying this migration. No targets or keys in budgets.
Each adapter requires a valid investigation ID and a durable reservation.
A transaction first creates/locks provider budget row; next statement consumes
request units and creates a unique (investigation,provider) attempt receipt.
No outbound request on missing schema, database failure, exhausted budget,
provider backoff, or an existing unresolved attempt. Completed results reuse
cached normalized result; request_started indicates whether this invocation sent.
Cached results retain their original evaluated_at and set request_started=false.
Cache envelope schema_version=1 is required; malformed, outdated or poisoned
cached result shapes/links/fields fail closed as persistence_error, never reused.
An unresolved/crashed attempt is reported lookup_pending, not automatically
retried/billed. Staff reconciliation is required; no delete/reset endpoint.
Result saving failure returns persistence_error without candidates, leaving a
receipt that prevents another call. Provider cooldown write failure is reported
persistence_error; don't silently claim success.

Caps per project/provider (UTC, conservative local safety ceilings, NOT advertised
quotas): github 50/day/1000month interval75s; stackexchange100/2000 interval60s;
bluesky100/2000 interval1s; wikidata100/2000 interval2s (reserve2units);
openalex50/1000 interval1s; tavily30/900 interval5s; exa30/500 interval5s;
veriphone30/900 interval5s. Never automatically raise caps or buy overages.
All attempted calls count, even failures. One API key shared elsewhere may consume
the provider's free allowance; no zero-cost promise. Respect Retry-After,
GitHub reset, OpenAlex reset, StackExchange backoff/quota via durable blocked_until.
A completed cached result remains available during cooldown; do not refetch it.

## Status semantics / acceptance
candidates_found, validated, no_match; not_configured, unsupported_target,
invalid_target, quota_exhausted, rate_limited, lookup_pending, budget_unavailable,
persistence_error, authentication_error, provider_error, timeout, invalid_response.
Unselected sources produce no array entry. Error states have no records/validation.
No_match means this lookup returned no usable candidates, not nonexistence.
402/432/433 become quota_exhausted; 429/backoff and applicable403 become
rate_limited; 401/other403 authentication_error; other HTTP errors provider_error.
Valid empty responses are no_match; malformed envelopes invalid_response.

Test exact request shapes/projections, fixed hosts/headers, schema conformance,
no request before gates, time/body bounds, redaction, hostile HTML/URL, true/false
validation, human Q5 filtering, incomplete pages, retry/backoff, duplicate/crash
receipt, missing schema, serialization, both callers, collector persistence,
external-AI exclusion, escaped report and React form/detail. Synthetic SQL mocks
prove decisions/query structure only, NOT real Postgres concurrency or rollback.
Migration and live provider/account behavior remain separately verified gates.
