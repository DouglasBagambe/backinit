# Verification — 27 October 2026

## Local evidence

- Strict TypeScript across all three packages and production Next/Nest builds pass.
- 26 Vitest tests pass: provider normalization/cache/rate limits/stale fallback, provenance boundaries, accounts/session authorization, source validation/revocation/versioning, RSS parsing and origin checks.
- Final 26-test Playwright suite passes (1.9 minutes), including administrator source mutation/audit/revocation, account outage preservation, calendar export and the full theme/layout matrix.
- Layout matrix: 21 routes × seven widths (360, 390, 430, 768, 1024, 1440, 1920) × both themes, checking page overflow, footer-only theme control and persistence. Representative screenshots captured and visually inspected.
- Real external feed: 312 provider events returned; OpenLigaDB and Jolpica both available. Bundesliga goal detail, 18-team standings and latest F1 classification verified. No demo provenance in the real feed.
- Real browser smoke: home, football Match Centre and F1 detail at 360/1440 in light/dark (12 reviews), no serious/critical axe violations or page errors. Goal navigation changes the event, real standings render, and real calendar export has valid folded lines without demo labels.
- Actual decoded external playback: HLS `currentTime=2.018996`, `readyState=4`, `320×184`, playing; DASH `currentTime=2.022844`, `readyState=4`, `768×432`, playing. These are Big Buck Bunny test films, not sports broadcasts.
- `pnpm audit --prod`: no known vulnerabilities at this check. Formatting and diff whitespace checks pass.

## Defects caught during this milestone

Fixed real-page demo disclaimer, a stale tracker color caption, server-persistent clearing of account events, origin validation behind Next's internal URL normalization, account outage preservation, keyboard focus on scrollable standings/classification tables, expiry timer behavior and shared-domain Turbo cache invalidation. Source evidence URLs require HTTPS. Browser traces also exposed stalled external Google Fonts responses; the same families now ship locally. Search links expose the team/athlete/competition directories. Player failures/retries and authorization denials are tested rather than inferred from rendering.

## Reproduce

```sh
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm build
pnpm exec playwright install chromium
CI=1 pnpm test:e2e
pnpm audit --prod
pnpm format:check
```

Stop existing preview servers before CI-mode browser execution. E2E uses a fresh isolated SQLite path. With built API/web servers running, the following optional network-backed probes exercise current providers and actual media decoding:

```sh
node scripts/probe-real.mjs
node scripts/probe-playback.mjs
```

External probes intentionally remain separate from deterministic CI because provider/CDN uptime is outside this repository's control. Screenshots under ignored `artifacts/` include `review-*`, `real-*` and `playback-*`. CI uploads browser evidence and failure traces.

## Limits

Chromium only. Native Safari HLS, iOS fullscreen/PiP, Firefox, Android, screen-reader testing, load/performance budgets and a production penetration review remain open. No production deployment, sports broadcast, live positional feed or enabled licensed-news ingestion is claimed. SQLite/cache/limiter behavior is single-instance; no scale or backup guarantee is implied. Remote CI is reported separately from local tests. No merge or public deployment performed.
