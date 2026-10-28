# Public frontend with a Render API

The founder authorized hosting NestJS in Dyson's Render workspace on 28 October 2026. The backend is now `https://backinit-api.onrender.com`. See [Render operation](RENDER.md) for its intentionally limited data-only mode.

`vercel.json` now builds only the `web` service in `apps/web`; it no longer attempts to run SQLite-backed NestJS in an ephemeral Vercel Function. Import the repository root. The existing Services catch-all still sends every public path, including `/api/*`, to Next.js. Services is currently beta.

The checked-in, non-secret deployment environment selects:

```text
API_BACKEND=external
API_URL=https://backinit-api.onrender.com
ALLOW_DEMO_MODE=false
SPORTS_DATA_MODE=real
```

These are server-side variables. Never expose backend configuration through a `NEXT_PUBLIC_*` variable. If project settings override repository values, align them with these values before deploying. An obsolete `API_INTERNAL_URL` is ignored when `API_BACKEND=external`. External backends must use HTTPS on Vercel. Unconfigured installations fail explicitly instead of silently calling localhost.

The schema still supports the root `env` property, although Vercel marks it deprecated in favor of project environment settings. It is used here only for public configuration so this reviewed branch contains its complete intended routing. No secrets belong in `vercel.json`. The connected account cannot access the site's Vercel team; this branch has not been promoted to the public frontend.

Keep the Next backend-for-frontend boundary intact. Sending browser requests directly to Nest would bypass the Next origin checks and HttpOnly session-cookie handling. `APP_ORIGIN`, if set in project settings, must match the actual public origin; do not copy a localhost value from `.env.example`.

Local development still uses `API_URL=http://127.0.0.1:4000` by default. Install with Node 22.23+ and pnpm 10.34.0, then run `pnpm dev`. A separate installation can still opt into private service bindings by leaving `API_BACKEND` unset and injecting `API_INTERNAL_URL`; the deployed configuration here intentionally selects Render.

## Verification

Run `pnpm typecheck`, `pnpm test`, `pnpm build`, and `pnpm test:e2e`. Then run `node scripts/probe-hosted-api.mjs` to exercise a local production Next build against the actual hosted Render backend, including old demo cookies, discovery, a match page, desktop/mobile layouts and explicit unavailable-source responses. This script does not deploy anything or publish sources.

A reachable data API is not a working broadcast registry. The deployed data-only API serves no accounts, persistent favorites, administrative source management or playable sources. Do not enable those features with ephemeral SQLite.

References: [Services](https://vercel.com/docs/services), [configuration](https://vercel.com/docs/services/config-reference), [Vercel schema](https://openapi.vercel.sh/vercel.json).
