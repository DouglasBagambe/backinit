# Vercel Services configuration

This repository uses Vercel Services (currently beta). Import the repository root,
not apps/web, as one project. The selected topology keeps the API internal and
uses the existing Next handlers for all public API requests.

- `web`: Next.js in apps/web. The public catch-all routes every path here,
  including /api/*, which belongs to the existing Next backend-for-frontend.
- `api`: NestJS in apps/api, with its detected src/main.ts entrypoint. Internal
  only: no top-level rewrite targets it. Backend routes retain their existing
  paths (/events, /watch, /account/*, etc.), without an /api prefix.
- `web` calls `api` using the API_INTERNAL_URL service binding. Do not manually
  define this variable. Server functions read it at request time via apiUrl;
  it is never exposed as a NEXT_PUBLIC variable or used by middleware.

Routing /api/* straight to Nest would bypass the Next session-cookie and origin
checks. In particular, browser account requests need the Next handler to convert
an HttpOnly session cookie into an upstream bearer session and remove tokens
from JSON responses. Keep that boundary intact.

For ordinary pnpm dev, API_URL remains an optional local override with a default
of http://127.0.0.1:4000. On Vercel a missing binding fails through the existing
unavailable-service responses rather than falling back to localhost. Next pages
already use request cookies and dynamic rendering; service calls do not run as
build-time data loading.

## Local validation

Use Node 22.23+ and pnpm 10.34.0. Install with pnpm install --frozen-lockfile.
Run pnpm typecheck, pnpm test, pnpm build, then run vercel dev from the repository
root to exercise both services with injected bindings. Use vercel dev -L for
local-only operation on a CLI version supporting Services. Check /, /watch,
/scores, /profile and /api/watch. Registration/login/logout must pass through
Next; verify cookies remain HttpOnly and Secure on the deployed HTTPS origin.
The internal /health endpoint is only callable through the binding, not publicly.

APP_ORIGIN, if set, must match the actual public origin exactly. Do not copy
localhost APP_ORIGIN or WEB_ORIGIN values from .env.example into Vercel. Confirm
origin checks and secure cookies on both production and preview deployments.
Keep SPORTS_DATA_MODE=real and BBC_FEED_LICENSED=false unless separately approved.

## Verification of this change

TypeScript checks, both production builds, formatting, and all 46 unit tests
passed locally. The test suite passed with one worker after a password-hashing
test hit its five-second timeout during the parallel build/test run. Binding URL
smoke checks also passed, including runtime changes and missing-binding failure.

Vercel CLI installation did not complete, so vercel dev and Vercel's service
binding injection have not been verified. No cloud deployment was attempted.

## Remaining deployment blocker: durable state

Services solves routing and service discovery, not storage. The API currently
opens SQLite at startup for accounts, sessions, favorites, source records and
audit. Its default local .data path cannot provide durable state in Vercel
Functions; /tmp or :memory: would lose data and diverge between instances.
Do not use those as a production workaround. A durable database adapter and
migration are required before this configuration represents a working production
release. No database has been provisioned or migrated by this change.

Provider caches, throttles and the ingestion timer are process-local. The timer
is not a reliable background scheduler in Functions. Shared caching, request
attribution and scheduled ingestion remain operational work. No live sports
broadcast rights or media sources are added by this configuration.

No project creation, deployment or paid resources are part of this change.

References:

- https://vercel.com/docs/services
- https://vercel.com/docs/services/bindings
- https://vercel.com/docs/frameworks/backend/nestjs
- DATABASE.md
