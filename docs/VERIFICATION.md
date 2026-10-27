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

## Viewing and account milestone — 28 October 2026

- Strict TypeScript and production Next/Nest builds pass. 34 unit tests pass, including single-use recovery/rotation/session invalidation, legacy password upgrades, persistent attempt limits, privacy deletion/export boundaries, notification opt-in/deduplication/ownership, operator source revocation surviving catalogue refresh, and WAL-consistent backup/restore.
- Full 30-test Chromium suite passes (2.2 minutes), including the 22-route × seven-width × two-theme layout matrix, source management, search, favorites, consent/retry and account recovery/privacy flows.
- Four focused Firefox browser tests pass: video filtering/consent/retry, both themes at 360/390/768/1440, recovery/export/notification opt-in/account deletion. This supplements Chromium; it is not a Safari/iOS or full Firefox device certification.
- External official catalogue: 18 videos, nine publishers, seven sports; all publisher feeds/metadata checked in this probe. Metadata success does not guarantee playback. Real artwork and locally served identifying crests/marks were visually reviewed on desktop/mobile in both themes. The real Watch review found no serious/critical axe violations or horizontal overflow.
- Actual Chromium decoded sports playback: UFC fight advanced to 7.77 seconds, readyState 4, unpaused; Australian Open match to 4.58 seconds, readyState 4, unpaused; ICC highlights to 4.51 seconds, readyState 4, unpaused. No inference from a thumbnail, iframe or metadata was used as playback proof.
- The sampled WWE/WWE Vault, FIBA, FIFA and F1 embeds returned provider restrictions. These failures show a clear provider-controlled availability message and preserve an outbound official link. Their broadcasts are **not** claimed to work in-page. Availability in other territories remains unverified.
- Real score probe: 312 events, real goals, 18-team standings and F1 classification; 12 desktop/mobile/theme reviews, calendar behavior and no page errors. A transient Jolpica network failure first produced honest unavailable coverage (306 football events); retry recovered F1 without substituting demo data.
- Production dependency audit found no known vulnerabilities at this check. Formatting and whitespace checks pass.

Browser defects caught and corrected included invalid fixture URL contracts, accessible video-card names missing visible category text, async checkbox state, registration mode surviving sign-out and stale selection when a requested source disappears. Concurrent browser runs initially collided over trace output; Firefox now has a separate output directory and port pair.

Optional reproduction with local preview running:

```sh
node scripts/probe-official.mjs
node scripts/probe-sports-playback.mjs WWE Basketball Tennis Cricket Football 'Formula 1'
pnpm exec playwright install firefox
CI=1 E2E_BROWSER=firefox E2E_WEB_PORT=3200 E2E_API_PORT=4200 pnpm exec playwright test tests/e2e/viewing.spec.ts
```

The preview remains on 3000/4000 while standard production E2E uses 3100/4100. External probes depend on provider/network/territory conditions and remain outside deterministic CI. Screenshots and traces are ignored local evidence, with CI artifacts uploaded independently.

Open limits remain: no direct live sports broadcast sources, universal structured scores/lineups, measured coordinates/momentum, enabled licensed articles, email verification/delivery, background push, reviewed public proxy attribution/shared limiting or production deployment. Code recovery and active-account deletion are now implemented; published retention/operator details and monitored encrypted backups still require launch work. See STREAMS.md and DATABASE.md.

## Event-first live viewing correction — 28 October 2026

Story: discover a genuine fixture → open its event page → resolve only its configured sources → play an authorized source or show an honest unavailable state → administer and withdraw that source safely.

- 39 unit tests pass, including EFL date/time/entity normalization, stale verified-fact fallback, no inferred scores/live status, forbidden test-feed association, exact event/source matching, verification/version checks, invalid host rejection and source revocation/expiry/URL-change handling.
- Production TypeScript and Next/Nest builds pass. The deterministic browser suite includes real cup fixture discovery, Kampala times, calendar UTC export, event switching, role/origin controls, save/verify/enable/revoke, source mismatch prevention, failure/retry/fallback and desktop/mobile/theme accessibility.
- Real external review of Watch and Liverpool's event page at 390/1440 in both themes: no serious/critical axe violations, no horizontal overflow and no page errors. The five cup fixtures resolve to **zero in-page sources** and explicit external-information availability. Liverpool kickoff renders 23:00 Africa/Kampala.
- Actual HLS test decoding: currentTime 1.53 seconds, readyState 4, 320×184, unpaused. Actual DASH VOD: 1.53 seconds, readyState 4, 480×270, unpaused. Both are open testing content, not sports broadcasts.
- Actual live DASH simulator: advancing epoch-based media time, readyState 4, 640×360, unpaused, infinite duration and a moving seekable window of approximately 60 seconds. “Go live” seeks to within five seconds of the window edge. Fullscreen and picture-in-picture were actually opened and exited on all three transports in Chromium.
- An isolated production-mode admin/browser test independently played HLS and live DASH, automatically submitted authenticated decoding evidence and verified persisted source checks/audit state. The HLS check recorded 320×184 and >1 second played; live DASH recorded 640×360 and an actual live window. No test source was attached to a sporting fixture. This optional network test passes separately and is skipped in ordinary CI.
- Supplied Akamai live HLS endpoint could not be connected to from this environment and was not seeded as a working source. Supplied Mux endpoint is reachable and decoded as **VOD**, not claimed live. The DASH-IF simulator is the independently verified live transport test.

Reproduction:

```sh
pnpm typecheck
pnpm test
pnpm build
CI=1 pnpm test:e2e
node scripts/probe-live-viewing.mjs
CI=1 VERIFY_EXTERNAL_MEDIA=true E2E_WEB_PORT=3300 E2E_API_PORT=4300 pnpm exec playwright test tests/e2e/media-verification.spec.ts --output=test-results-media
CI=1 E2E_BROWSER=firefox E2E_WEB_PORT=3200 E2E_API_PORT=4200 pnpm exec playwright test tests/e2e/live-events.spec.ts tests/e2e/viewing.spec.ts
```

The deterministic source-management test simulates administrator media evidence to test authorization and state transitions; it is not cited as real media playback. Actual media proof comes from the separate permitted-feed probes and optional admin test. Evidence screenshots include `live-real-*`, `live-proof-*` and `admin-decoded-*` under ignored `artifacts/`.

No Liverpool/Chelsea or other cup video was decoded, since no authorized in-page source exists. No Uganda broadcaster entitlement, generic third-party iframe decoding, Safari/iOS playback or universal multi-sport coverage is claimed. Source checks are authenticated administrator reports, not cryptographic proof of rights or content identity. See LIVE_VIEWING_2026-10-28.md for the fixture table and exact broadcast requirements.

Final local results for this correction: **34 deterministic Chromium browser tests passed** (2.9 minutes), with the optional network test skipped in that run; **eight focused Firefox tests passed** (1.1 minutes). The external admin decoding test separately passed against isolated production servers (26 seconds). The general matrix now covers 24 routes at seven widths in both themes, with additional live discovery/event-page reviews. Source administration, provider-supported detail, account flows and the footer-only theme selector remain verified.
