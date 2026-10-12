# osintshadow web app

Use Node.js 24 and the checked-in Bun lockfile. From this directory run
`bun install --frozen-lockfile`, `bun run typecheck`, `bun run test`, and
`bun run build`. On Windows, if Bun's shared cache is on another drive, use
`--backend=copyfile --cache-dir=<a directory on the checkout drive>`.

`bun run start` runs the built Node/Hono server at `http://127.0.0.1:43304`.
`PORT` overrides the port and `HOST` overrides the loopback host. `bun run dev`
uses the same default local address. The build retains SSR and bundles all API
route modules; it does not require a source directory next to the server output.
Catch-all URLs are handled at runtime rather than prerendered as invalid filenames.

`node scripts/smoke-built.mjs` boots a separate built server on an available
loopback port and verifies homepage serving, signed-out session, bundled API
parameter routes, explicit missing-configuration responses, and API 404s.
It uses no credentials or provider calls and stops only its own child process.

The local homepage and account screens work without external credentials.
Authentication and stored/API investigations require `DATABASE_URL` and
`AUTH_SECRET`; registered API routes report missing configuration as HTTP 503.
Provider-backed intelligence, uploads, AI and billing also depend on their
existing service configuration. This repair does not configure or exercise paid
services, replace the backend, or bypass authentication. Keep `.env` private.

TypeScript remains strict for TypeScript modules. `allowJs` is enabled because
the route modules are JavaScript/JSX; `checkJs` is false for the existing untyped
JavaScript source. React Router's generated route types can now resolve them.
Standard TypeScript include patterns cover all application, server and plugin
modules, with build output and caches excluded. Vitest discovers only the app's
`src/` and `test/` tests, avoiding third-party tests stored in Bun's local cache.
