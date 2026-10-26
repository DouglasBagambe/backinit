# Development

## Run locally

Requirements: Node.js 22.23+ and pnpm 10.34.0. Use `corepack enable` and `corepack prepare pnpm@10.34.0 --activate` where Corepack is installed, or `npm install -g pnpm@10.34.0`.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Web: http://127.0.0.1:3000. API: http://127.0.0.1:4000. Both bind to loopback; no deployment or account is required. Demo events are fixed to 26 October 2026, not the user's current date. All scores and results are illustrative. Team names identify the demonstration; letter shields are original UI shapes, not licensed club crests.

```sh
pnpm typecheck
pnpm test
pnpm build
pnpm exec playwright install chromium
pnpm test:e2e
```

E2E starts production web/API servers automatically. For a production-mode local preview run `pnpm --filter @backinit/api start` and `pnpm --filter @backinit/web start` in separate terminals after building.

## Environment

See [example values](../.env.example). Defaults work with no file. Next reads an optional `apps/web/.env.local`; the API reads exported process variables (it does not automatically load the root example).

| Variable              | Consumer        | Default / purpose                                                                |
| --------------------- | --------------- | -------------------------------------------------------------------------------- |
| API_URL               | Web server only | `http://127.0.0.1:4000`, server-owned upstream; never accept a URL from visitors |
| PORT                  | API             | `4000`                                                                           |
| WEB_ORIGIN            | API             | `http://127.0.0.1:3000`, exact allowed origin                                    |
| FOOTBALL_DATA_API_KEY | Future adapter  | Not used in this slice; never expose to browser                                  |

## Functional status

| Capability                                                                  | Status                                                                  |
| --------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Home, scores, live filter, sport filters, search                            | Functional with demo data                                               |
| Next server → Nest API → validated provider → rendered events               | Functional with demo data; explicit local fallback when API unavailable |
| Football Match Centre stats, timeline, event replay                         | Functional with demo data for Arsenal–Liverpool                         |
| Other event detail pages                                                    | Score/schedule only; missing detail explicitly labeled                  |
| Wrestling event and bout cards                                              | Functional with fictional performers                                    |
| Motorsport event                                                            | Functional schedule demo; no timing/classification                      |
| Favorite events and theme preferences                                       | Functional browser-local persistence; guest access                      |
| HLS test film, adaptive quality, native controls, errors/retry              | Implemented; see verification for playback evidence and browser limits  |
| News                                                                        | Product guides only; no news ingestion                                  |
| Calendar                                                                    | Fixed demo matchday; arbitrary date browsing not implemented            |
| User accounts, notifications, synced team/athlete favorites                 | Awaiting implementation                                                 |
| Admin                                                                       | Closed informational state, no privileged API or mutations              |
| Real scores, lineups, momentum, standings, H2H, news, authorized broadcasts | Awaiting provider integration and rights                                |
| DASH, embedded provider adapters, source registry and health monitoring     | Next viewing milestone                                                  |

## API

- `GET /health`: provider health metadata, explicitly `realTime: false`.
- `GET /events?sport=Football&q=Arsenal`: validated filters, demo provenance.
- `GET /events/:id`: 404 for unknown IDs.
- `GET /updates`: SSE heartbeats every 15 seconds; **not live score updates**.
- Web `GET /api/events`: server-owned backend request, schema validation and explicit fallback source.

API rate limit: 120 requests per minute per client; one process/in-memory storage only. Never enable proxy trust indiscriminately. Configure the actual trusted proxy topology and a shared limiter before production.
