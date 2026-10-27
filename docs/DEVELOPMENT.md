# Development

## Run locally

Node.js 22.23+ (including `node:sqlite`) and pnpm 10.34.0 are required.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Web: http://127.0.0.1:3000. API: http://127.0.0.1:4000. Both bind to loopback. Real data is the default, with no API key required. The edition control explicitly switches to the separate fictional demo. Demo events are fixed to 26 October 2026. Real Bundesliga crests and selected organization marks are served locally; asset provenance is recorded in `apps/web/public/logos/SOURCES.json`. Marks remain their owners’ property.

```sh
pnpm typecheck
pnpm test
pnpm build
pnpm exec playwright install chromium
CI=1 pnpm test:e2e
```

E2E starts production servers in demo mode with an isolated SQLite database. E2E uses separate ports 3100/4100 so the development preview can keep running. Set E2E_WEB_PORT/E2E_API_PORT to override. Provider maintenance mode makes the browser matrix deterministic; external integration probes are separate. A production-mode local preview uses `pnpm --filter @backinit/api start` and `pnpm --filter @backinit/web start` after building.

## Environment

Defaults work without an env file. Next reads `apps/web/.env.local`; Nest reads exported process variables, not the root example automatically.

| Variable                  | Consumer   | Purpose                                                                                                          |
| ------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------- |
| API_URL                   | Web server | Fixed upstream, default `http://127.0.0.1:4000`                                                                  |
| PORT                      | API        | Default 4000                                                                                                     |
| WEB_ORIGIN                | API        | Exact CORS origin, default `http://127.0.0.1:3000`                                                               |
| APP_ORIGIN                | Web        | Exact public origin for mutation checks; set before a reverse proxy deployment                                   |
| SPORTS_DATA_MODE          | Both       | `real` default; `demo` for deterministic development/tests                                                       |
| DATABASE_PATH             | API        | Default `.data/backinit.sqlite` relative to API working directory; use an absolute persistent path operationally |
| SPORTS_PROVIDERS_DISABLED | API        | `true` returns explicit unavailable real-score coverage for maintenance/CI; never inserts demo data              |
| BBC_FEED_LICENSED         | API        | Set `true` only after obtaining applicable BBC business feed permission; disabled by default                     |

## Working capabilities and limits

- OpenLigaDB Bundesliga fixtures, results, reported goals and standings; Jolpica F1 schedule and latest classification. Provider metadata and stale states are exposed. These are snapshots, **not guaranteed real-time feeds**.
- Real Match Centre goal replay and timeline, standings and race classification. No inferred coordinates, live clock, momentum, lineups or missing statistics.
- Search by events, competitions, teams and reported athletes. Directories derive from available events; they are not comprehensive global databases.
- Registration/login/logout, seven-day opaque sessions, SQLite account favorites, guest local favorites, follows and personalized home. Recovery codes, password changes, session revocation, privacy export and account deletion are implemented. Opt-in in-app match updates are persisted; no email verification, email reset or background push is configured. Calendar export is available for individual events.
- Server-authorized administrator source registry with version checks and audit entries. All new users are ordinary members. Sources have rights evidence, time windows, revocation and approved hosts. Operator review of rights remains essential.
- HLS/DASH player, source selection, availability probes, retry/buffering states and native video controls. Permitted YouTube privacy-enhanced embeds require consent. Official sports YouTube videos are discovered from nine publishers, consent-gated and categorized. See [STREAMS.md](STREAMS.md). Open test films remain separate; **no direct live sports broadcasts are configured**. Availability probes do not prove segment playback or regional entitlement.
- Footer-only Light/Dark/System preference persists locally; dark uses navy, charcoal and steel-blue.
- BBC headline adapter is permission-gated. No syndicated news is enabled by default. Unsupported sports show unavailable coverage; fictional demo remains opt-in.

## Accounts and administration

Use the profile page to register. Grant administrator status only to an independently verified account ID, using the same absolute database path as the API:

```sh
DATABASE_PATH=/absolute/path/backinit.sqlite node scripts/account-role.mjs ACCOUNT_UUID admin
```

Use `user` to revoke the role. Role changes revoke all sessions and add an audit entry. Sign in again afterward. No password or default administrator is embedded. Administrator sessions expire in 15 minutes. Password and recovery operations have persistent per-account attempt limits. Use `DATABASE_PATH=/absolute/path/backinit.sqlite node scripts/backup-database.mjs /private/backup.sqlite` for an online SQLite-aware backup, including committed WAL data. The tool refuses overwrite and verifies integrity. Perform isolated restore drills and define encrypted backup retention before launch. See [DATABASE.md](DATABASE.md). Do not commit databases, credentials or session tokens.

## API

- `GET /health`, `/events?edition=real&sport=Football&q=...`, `/events/:id?edition=real`, `/standings`, `/news`.
- `/updates` emits connection heartbeats only, not live score notifications. Visible browser feeds refresh every 60 seconds through the cache.
- `/watch` returns official videos and publisher coverage; `/streams?library=1` returns active official embeds.
- `/account/recover`, `/account/recovery-codes`, `/account/password`, `/account/export`, `/account/delete`, `/account/logout-all`, `/account/notifications`, `/account/notification-preferences`, `/account/notification-read`.
- `/account/register`, `/account/login`, `/account/logout`, `/account/me`, `/account/favorites`, `DELETE /account/saved-events`.
- `/streams`, `/streams/:id/health`; role-protected `/admin/sources`, `/admin/audit`.
- Browser mutations use same-origin Next BFF routes; sessions stay in HttpOnly, SameSite cookies, Secure over HTTPS. API accepts opaque bearer sessions. No tokens appear in browser JSON.

API limiter: 120 requests/minute per API connection, authentication 5/minute. The BFF currently shares one upstream address, so this is a conservative installation-wide limit. `NODE_ENV=test` raises the general limit solely for the browser matrix. Before public launch, configure trusted proxy attribution, shared rate limiting and abuse controls. Single-process provider caches deduplicate loads, honor Retry-After and retain explicitly stale data up to 24 hours. Multiple replicas require shared ingestion/cache.

## Public launch remains gated

No deployment or merge is authorized. TLS, nonce-based CSP, email verification/delivery, published operator and retention policies, monitored backups/restore drills, monitoring, licensing and production abuse controls remain launch work. Search indexing stays disabled pending launch approval. This milestone is usable locally, not a complete global sports service.
