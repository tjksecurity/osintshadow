# Intelligence tools

The authenticated `/intelligence` page contains seven explicit operations: browser
fingerprinting, a persistent visitor cookie with revocation, IPinfo lookup, Have I
Been Pwned lookup, public X profile extraction, one onion-page retrieval through
Tor, and browser-local TensorFlow binary-classifier training/evaluation/prediction.
Dashboard, investigation-list, and new-investigation navigation expose the page.
Existing investigation collectors, billing, authentication, and stored data remain
on their existing paths.

## Server configuration

Use Node.js 24 and the repository's pinned Bun 1.4.3 runtime for this app.

Use the existing approved server-secret interface. Never place real secrets in
source, browser variables, screenshots, test fixtures, or this document.

| Variable | Used by |
| --- | --- |
| `DATABASE_URL`, `AUTH_SECRET` | Existing application authentication and API configuration guard |
| `IPINFO_TOKEN` | Explicit-IP IPinfo lookup |
| `IPINFO_API_MODE` | `legacy` by default; select `lite` or `lookup` only for the verified account endpoint |
| `HIBP_API_KEY` | Have I Been Pwned email lookup |
| `X_API_MODE` | `browser` by default; `api` selects the official X HTTP adapter |
| `X_API_BEARER_TOKEN`, `X_INCLUDED_ACCESS_VERIFIED` | Official X API credentials and independently verified included allowance; the flag must be the literal string `true` |
| `PUPPETEER_EXECUTABLE_PATH` | Optional override for an existing Chrome/Chromium executable; installed Chrome is otherwise detected when browser actions run |
| `TOR_SOCKS_PROXY` | Tor SOCKS proxy used only for onion retrieval |
| `INTELLIGENCE_WORKER_URL`, `INTELLIGENCE_WORKER_TOKEN` | Optional server-only remote browser-worker origin and token; configure both together |

The authenticated Node API always executes IPinfo, HIBP, and explicitly selected
official X API operations locally with this app's server-side provider keys. It
does not send those keys to the browser worker. Existing investigation collectors
and accounting paths remain on their existing routes.

Browser-mode X extraction and onion retrieval can use a hosted browser worker.
Set `INTELLIGENCE_WORKER_URL` to its HTTPS origin, with no credentials, path,
query, or fragment. A trailing `/` is allowed. Production rejects loopback names
and addresses. Set `INTELLIGENCE_WORKER_TOKEN` to the matching server-only bearer
token, at least 32 characters long and without whitespace. No worker settings
belong in `NEXT_PUBLIC_*` or browser code.

With both worker variables absent, local Node/Chrome/Tor behavior is preserved.
Partial or invalid worker configuration fails closed for browser operations;
HTTP-provider operations continue using their local adapters. Hosted serverless
deployments need a configured and independently deployed worker for browser
operations. Setting these variables does not publish a worker, approve billing,
or establish live connectivity.

`src/app/api/intelligence/remote.js` validates and normalizes the action before
making one `POST /intelligence` request. It forwards only the action, its allowed
input, and the worker bearer header. It never forwards browser cookies, user
authorization, provider keys, or the app environment. Responses are limited to
1.2 MB, checked against the requested profile/onion target, and reduced to the
expected result fields. Unexpected upstream error text is not exposed.

The remote deadline is 65 seconds, including response-body reading. There are no
automatic retries. A Cloudflare HTTP 202 starting response becomes app HTTP 503
with `WORKER_STARTING` and `Retry-After: 5`; the user decides when to try again.
Worker authentication failures return a server-configuration error rather than
changing the user's authenticated app session.

For an onion operation, the browser uses a temporary local SOCKS gate before the
configured Tor proxy. The gate allows only the requested onion host and blocks
unrequested browser/background hosts before they reach Tor. The document may
upgrade from HTTP to HTTPS on that same onion host; cross-host navigation and
subresources remain blocked. The gate and browser are cleaned up after the
operation. This network scoping does not establish anonymity.

`POST /api/intelligence` accepts `{ "action": "ipinfo|breach|profile|onion",
"input": { ... } }`. Input is respectively `{ "ip": "..." }`, `{ "email":
"..." }`, `{ "username": "..." }`, or `{ "url": "..." }`. Responses use
`{ "ok": true, "data": ... }` or `{ "ok": false, "error": { "code": "...",
"message": "...", "retryAfter": 30 } }` with a meaningful HTTP status. Requests
require the existing authenticated session, same-origin browser requests, JSON
content, and a body no larger than 8 KiB. The global missing-configuration guard
continues to return HTTP 503 before route execution.

`GET /api/intelligence` is also authenticated and returns only configuration
presence booleans keyed by their environment-variable names. An absent browser
override does not disable automatic Chrome detection. Those booleans do not
establish provider connectivity, key validity, browser availability, or working
Tor routing. `remoteBrowser` contains only worker URL/token presence booleans;
it does not reveal their values. `providers` includes safe mode enums, credential
presence, and configured allowance flags, explicitly marked as metadata without
live checks.

## Browser operations

Fingerprint collection runs only when the user presses **Capture this browser**.
Cookie creation runs only when the user presses **Enable visitor cookie**. Revoke
removes the visitor identifier; it does not change authentication cookies. These
tools concern the current browser and do not identify a person.

Classifier datasets are JSON objects with `featureNames: string[]` and
`samples: { features: number[], label: 0 | 1 }[]`. The page can download or load a
clearly marked synthetic example. Uploaded datasets are used directly and never
sent to an API. Training uses the supplied two-64-unit-hidden-layer/sigmoid
architecture, evaluates held-out rows, and exposes prediction for the same feature
order. Model/data remain in the current tab; leaving the page disposes the model.
Labels define what the classifier predicts. Prediction is not a causal claim
about persuasion or proof of useful performance on future data.

## Verification and limits

`node --test test/intelligence.test.mjs` checks the actual route handlers with
injected authentication/provider boundaries, including failed authentication,
cross-origin requests, malformed/oversized bodies, all four dispatch actions,
configuration redaction, rate limits, and unexpected-error redaction.
It also exercises the actual remote-dispatch helper: default local behavior,
browser-only routing, provider-secret isolation, invalid-input rejection before
network/compute, URL/token validation, cold-start responses, worker errors,
bounded/stalled response bodies, target matching, and timeout cancellation.

`src/app/intelligence/page.test.jsx` exercises sign-in gating, all seven visible
tools, explicit fingerprint/cookie actions, provider-form request/result/error
handling, selected dataset training, prediction, and model disposal. Browser and
provider dependencies are isolated in those interaction tests; their synthetic
results are not live-provider evidence.

Run `bun run test`, `bun run typecheck`, `bun run build`, and
`node scripts/smoke-built.mjs` from the web directory after installing with the
checked-in lockfile. Real provider credentials, Tor connectivity, authenticated
database use, production deployment, and external personal-data lookups need
separate evidence. An absent provider or failed lookup remains an explicit error.

Explicit HTTP onion URLs keep their requested protocol and port in the isolated browser; Chromium's opportunistic HTTPS upgrade is disabled for these Tor jobs. A server-directed upgrade to HTTPS on the same onion hostname remains allowed, while other origins and HTTPS-to-HTTP downgrades are blocked. The final installed-Chrome test fetched the official Tor Project onion through the existing local Tor SOCKS service; this verifies that route at the test time, not future onion availability.
