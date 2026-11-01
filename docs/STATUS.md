# Production status — 1 November 2026

Public website: https://www.backinit.live. Backend: https://backinit-api.onrender.com. Application release: `26190717eaa6194f52348c9af424ae8d6e06ef96` (PR38), Render deploy `dep-dbj9vpvb9u1s73deip10`, verified live. This is a time-specific verification record, not a promise of universal upstream coverage.

## Delivered and checked

- Green 2 dark theme, football/broadcast branding, skeleton loading and subtle logo animation; distinct account states without initials.
- Eight-character minimum passwords, durable accounts/favorites, recovery codes, account export/deletion and administrator sessions. The owner's existing account reaches the production broadcast editor through Account → Manage broadcasts. No password is stored in this document.
- Durable PostgreSQL source registry, version checks, playback evidence and audit records. Runtime has restricted table permissions; migrations ran before release. No test sources were published.
- Exact-match publisher animation discovery with score fallback, recovery controls and responsive primary/side layouts. A real tennis animation was checked on desktop and 390px mobile; a longer check retained the frame while set/game values changed. No substitute fixture or invented positional data was used.
- News is publicly populated: 15 real sports headlines rendered on a 390px mobile screen without overflow or recorded page errors. GDELT attribution, original links and indexed dates are visible. Successful API responses are cached at the edge; a second public request returned `x-vercel-cache: HIT`.
- Direct Native Banner and voluntary labelled Sponsored offers. Account/admin pages exclude passive ads. Tests intercept vendor calls rather than producing real ad clicks.
- Public Watch, Fixtures, Live, Scores and News page responses were HTTP 200 in 1.9–3.6 seconds from the audit connection. A free backend cold start can still be slower.
- Final application CI: typecheck and production build passed, 131 automated tests and 57 browser tests passed; one optional external-media test skipped. Separate real PostgreSQL integration checks passed. Earlier production account checks verified persistence through a backend restart and cleaned their synthetic accounts.

## External access or owner decisions still required

1. **Coverage beyond the free provider.** SportScore publishes animation for football, basketball, tennis and cricket, with gaps by fixture. Universal multi-sport animations need an entitled provider. The free Sportradar enquiry has no reply/client ID yet. No paid agreement was accepted. Cross-origin embeds remain subject to publisher/browser availability; fallback and recovery do not constitute an animation guarantee.
2. **Premium video rights.** No authorized free Chelsea–Manchester United broadcast was verified for the visitor's region. Adding arbitrary unofficial URLs would not establish rights. The source editor is ready for a genuinely authorized source and playback verification.
3. **Additional advertising formats and payouts.** Adsterra rejected iframe-wrapped ad tags and does not support the requested VAST flow. No forced ordinary-ad click unlock is installed. Direct Native Banner and the voluntary Smartlink are active integrations; payout, identity/tax information and withdrawal require the account owner. No earnings or withdrawal are claimed.
4. **Free-host operations.** Render idle wake-up, provider quotas, distributed caching, backup retention/restore ownership and capacity remain operational limits. There is no new paid compute, automatic backup schedule, email verification delivery or background push.

These dependencies are not hidden behind a "100%" claim. Existing requested application fixes have production evidence; universal streams, animations and monetization cannot be certified from the access currently supplied.

Operational detail: [database](DATABASE.md), [News](NEWS.md), [advertising](ADVERTISING.md), [tracker coverage](TRACKER_COVERAGE_AUDIT_2026-10-31.md), [Render](RENDER.md).
