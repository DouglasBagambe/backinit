# Render sports-data API

## Deployed service

The founder requested Dyson's Render workspace. A new **free** Node web service was created there, without modifying the workspace's existing services:

- Name: `backinit-api`
- URL: `https://backinit-api.onrender.com`
- Dashboard: `https://dashboard.render.com/web/srv-dbh3nc3l550s73c2so50`
- Workspace: `tea-d6k1h94r85hc73bscps0` (Dyson's workspace)
- Service: `srv-dbh3nc3l550s73c2so50`, Frankfurt
- Repository: `DouglasBagambe/backinit`, branch `main` (changed on 29 October Africa/Kampala)
- Initial deployed commit: `4a6e002ebe14d1b31d00c3072f16e939cf47646d`
- Initial deploy: `dep-dbh3ncrl550s73c2spl0`, verified `live` on 28 October 2026
- Automatic deployment: disabled. Reviewed backend changes need an explicit deployment.

Build command:

```sh
npx --yes pnpm@10.34.0 install --frozen-lockfile --prod=false && npx --yes pnpm@10.34.0 --filter @backinit/api build
```

Start command:

```sh
cd apps/api && node dist/apps/api/src/main.js
```

Non-secret service environment:

```text
NODE_VERSION=22.23.3
NODE_ENV=production
HOST=0.0.0.0
SPORTS_DATA_ONLY=true
SPORTS_DATA_MODE=real
ALLOW_DEMO_MODE=false
SPORTS_PROVIDERS_DISABLED=false
WEB_ORIGIN=https://www.backinit.live
BBC_FEED_LICENSED=false
```

Render supplies `PORT`. No database, disk or paid compute plan was provisioned.

## Durable accounts release — 29 October 2026 (deployed)

PR #9 merged to main as `e6c07dc1ebb0e05ce9144f396f1c7e39d3b919cb` after all CI checks passed. The restricted Neon `backinit_app` pooled production connection is configured privately as `DATABASE_URL`; `SPORTS_DATA_ONLY=true` remains enabled. The owner connection is not in Render. The backend reports `data+accounts`. Deployments `dep-dbhqvqfb9u1s73fhvjg0` and `dep-dbhqvqr23eus73eibqog` reached `live` on 29 October.

A synthetic account registered through **https://www.backinit.live**, with a Secure/HttpOnly/SameSite=Lax cookie and no token returned to browser JavaScript. Its session and saved favorite survived the second actual Render deployment. Sign-out/sign-in restored the favorite; notification inbox and privacy export returned successfully. Only that synthetic account was then deleted and its session rejected. See [public account evidence](evidence/public-accounts-2026-10-29.json), [public frontend evidence](evidence/public-frontend-2026-10-29.json) and [database operations](DATABASE.md).

Custom source administration remains unavailable in hosted data-only mode; no ephemeral SQLite registry is enabled. Official broadcast discovery and playback continue independently of account storage. Removing `DATABASE_URL` disables account routes without deleting their data. No new broadcast rights, email delivery, verified email addresses or browser push were introduced.

PR #10 subsequently deployed `47a65025dce02153679feea9f1a236ec32bcf866` as `dep-dbhr53m7bikc73fbattg`. Public browser checks verified the new eight-character minimum for signup, password change and recovery, rejection of seven characters, the guest account icon and deletion of only the synthetic check account. See [eight-character password evidence](evidence/public-eight-character-accounts-2026-10-29.json).

The deployment notes below describe historical milestones and limitations at their recorded dates.

## Official broadcasts update — 29 October 2026

The next reviewed release adds stateless official BWF/FIBA live-broadcast discovery and read-only event source/health endpoints. Accounts and custom source administration remain unavailable without durable storage. See [official live evidence and boundaries](OFFICIAL_LIVE_2026-10-29.md). The initial-deployment audit below is historical; public playback must be checked again after this release.

## What this mode does

`SPORTS_DATA_ONLY=true` loads a separate Nest bootstrap which never imports the SQLite account/source modules. `/health` identifies `mode: data-only`. Real event, match-detail, standings and Watch routes use the normal automated providers, request-driven caches, deduplication and rate-limit backoff. Demo requests are forbidden. Provider failure remains explicit and does not substitute test snapshots.

`/account/*`, `/admin/*`, `/streams`, `/streams/*` and `/videos` return HTTP 503 with a persistent-storage explanation. Watch events have no attached video sources. The source registry coverage entry says it is not configured. News remains dependent on an actually configured permitted feed; the BBC permission flag remains false.

This is a data availability milestone, **not a production-complete platform or a live playback milestone**. Existing full mode remains available for development or a properly persistent installation.

## Operational limits and remaining work

A free Render service loses its filesystem on restart, redeploy or idle spin-down, cannot attach a persistent disk, and sleeps after 15 idle minutes. Waking can take about a minute, longer than the frontend's ordinary request deadline. The first request may show an honest unavailable state; retry after wake-up. Monitoring can check `/health`, but does not guarantee continuous availability. Do not hide failures with a fake live response. Free workspace usage quotas are shared with its other services.

Accounts, sessions, favorites, verified sources and audit records need a durable database adapter and migrations before they can be enabled here. Render's free PostgreSQL expires after 30 days and is not a long-term production solution. No temporary database or ephemeral SQLite workaround was provisioned. A durable free external PostgreSQL service would require a separate account/connection and adapter work.

Provider caches and throttling are process-local. This service runs one instance. Undocumented public data endpoints have no uptime guarantee; retain explicit coverage/provenance and review reuse terms for public commercial use. BWF metadata worked locally but was unavailable in the first Render audit; do not claim that discovery or playback is working from this host.

Standard permitted embeds and authorized HLS/DASH remain supported in full mode. Local playback evidence does not establish playback on the public origin. No football broadcast was added by this deployment.

## Reproducible checks

```sh
pnpm --filter @backinit/api build
node scripts/probe-data-api.mjs
pnpm build
node scripts/probe-hosted-api.mjs
```

The first probe proves the data-only process creates no database, rejects demo requests and does not fabricate fixtures when providers are disabled. The hosted probe checks the real Render API and a local production frontend, recording timestamped counts, provenance, coverage, request statuses and desktop/mobile screenshots in `artifacts/`.

Official operational references: [free instances](https://render.com/docs/free), [deploys](https://render.com/docs/deploys), [health checks](https://render.com/docs/health-checks).

## Validation on 28 October 2026

Strict TypeScript and both production builds pass. All 65 unit/integration tests pass; Chromium passes 36 browser tests with one optional external test-media probe skipped. The isolated public-mode and no-database probes pass after the bootstrap split. Full-mode accounts and source administration are tested locally with isolated databases, not claimed as available on this data-only deployment.

The hosted browser probe at 21:22 Africa/Kampala returned 1,048 provider records across 10 sports, six provider-reported live tennis records, and 527 Watch records (including upcoming dates). The selected Today filter showed 19 events. Counts are time-specific, not promised coverage. Both desktop and mobile opened Liverpool–Chelsea's viewing page through the real hosted backend; no in-page source existed. Subsequent direct checks returned 200 for a live tennis detail and standings; news returned an explicitly unconfigured empty feed. Provider timestamps advanced between reads. Timestamped evidence is in `docs/evidence/render-api-2026-10-28.json`; screenshots are `artifacts/render-data-desktop.png` and `artifacts/render-data-mobile.png`.
