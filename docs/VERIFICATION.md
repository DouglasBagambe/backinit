# Verification — 26 October 2026

## Completed locally

- Production build: Next.js and NestJS pass.
- API development startup: verified health response using the TypeScript compiler/watch runner. Direct TSX execution exposed a Nest ESM dependency-resolution mismatch; development now uses the same compiled module graph as production.
- Strict TypeScript: all three workspace packages pass.
- Vitest: 10 passing tests, covering demo contracts, sport separation, combined filters, favorites, malformed upstream payloads, HTTP errors and explicit fallback.
- Playwright: full 15-test suite passed; following the test-source and mobile-label fixes, playback-failure and the additional mobile accessibility/keyboard test also passed. There are now 16 browser tests in the suite.
- Responsive checks: home and football Match Centre at **360, 390, 430, 768, 1024, 1440 and 1920px**, no document horizontal overflow. Screenshots captured for all widths.
- Accessibility: no serious/critical axe violations on home, Match Centre, Watch and Settings in light/dark desktop modes; additional mobile checks for home/Match Centre. This is not a full accessibility certification.
- Functional flows: favorite save/remove/reload, search and empty search, sport filtering, separate wrestling card, tracker replay/step controls, statistics tabs, theme persistence/system changes, expected unknown-route HTTP 404, missing API IDs and invalid filters.
- Production dependency audit: **no known vulnerabilities** after overriding transitive `multer` to patched 2.5.0. No upload endpoint exists in the app. Re-run the audit before releases.
- Real external HLS probe: Big Buck Bunny test stream loaded and played in Chromium. Observed `currentTime: 2.02728`, `readyState: 4`, `320×184`, `paused: false`; the selected rendition is adaptive. This verifies actual decoded playback, not just a visible player.

## Defects discovered and fixed

Initial browser execution began before Chromium installation completed, so browser launch failed; reruns used the installed browser. Subsequent tests found low contrast on light-theme labels, a brand accessible-name mismatch, a streaming not-found response returning 200, and an ambiguous favorites test selector. These were corrected. Mobile inspection found an icon-only search link missing an accessible label; fixed and verified. The original Sintel endpoint returned HTTP 403; replaced with the documented Mux-hosted HLS.js Big Buck Bunny test source. No access restriction was bypassed.

## Reproduce

```sh
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm build
pnpm exec playwright install chromium
pnpm test:e2e
pnpm audit --prod
```

For the optional external playback probe, start production-mode web/API servers, then run `node scripts/probe-playback.mjs`. It requires internet access and is intentionally separate from deterministic CI. Test-stream uptime is outside BackInIt's control.

Browser captures are generated under `artifacts/` and ignored by Git. The CI workflow uploads browser evidence and failure traces. Mobile and desktop home/Match Centre screenshots and the dark settings screen were visually inspected; the local preview was also opened in the integrated browser.

## Limits

Chromium only in this environment. Native Safari HLS, iOS fullscreen/PiP, Firefox, Android and assistive-technology testing remain open. No production performance benchmark, load test, penetration test, hosted deployment, real sports API, database or sports broadcast verification is claimed. SSE provides demo heartbeats only. Source-health automation, DASH, embed adapters, accounts and secure admin mutations remain roadmap work. Remote CI status is reported separately in the PR; local success does not imply CI success.
