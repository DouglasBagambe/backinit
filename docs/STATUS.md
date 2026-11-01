# Production verification baseline — 2 November 2026

Public website: https://www.backinit.live. Backend: https://backinit-api.onrender.com. Verified application baseline: `f425f27aa64091637ea3ff4a09bc760a4c373534` (PR45), Render deploy `dep-dbjqe7jbc2fs73dj8jlg`, live with both Vercel production statuses successful. This is a time-specific verification record, not a promise of universal upstream coverage.

## Delivered and checked

- Green 2 dark theme, football/broadcast branding, skeleton loading and subtle logo animation; distinct account states without initials.
- Eight-character minimum passwords, durable accounts/favorites, recovery codes, account export/deletion and administrator sessions. The owner's existing account reaches the production broadcast editor through Account → Manage broadcasts. No password is stored in this document.
- Durable PostgreSQL source registry, version checks, playback evidence and audit records. Runtime has restricted table permissions; migrations ran before release. No test sources were published.
- Exact-match publisher animation discovery with score fallback, recovery controls and responsive primary/side layouts. A real tennis animation was checked on desktop and 390px mobile; a longer check retained the frame while set/game values changed. No substitute fixture or invented positional data was used. A later Mandlik–Janicijevic animation remained blank both in BackInIt and on its original publisher embed page; its upstream JavaScript bootstrap did not finish. This remains unresolved.
- News refreshes complete through the serverless request lifecycle. Stale responses are not shared-cache successes, and stale RSS triggers archive discovery. Public mobile News returned fresh headlines without overflow, stale labels or page errors; counts vary with current index contents. Original links, attribution and indexed dates remain visible.
- Silent embedded video recovers after 20 seconds without progress, preserving pauses and background tabs. A real FIBA broadcast decoded 720p video in a separate public check.
- Known match URLs survive transient omissions. Catalogue cache reuse respects the individual live-source deadline, preventing an otherwise fresh snapshot from demoting an already-refreshed score to unknown. Weekend cards share Watch discovery rather than downloading the full catalogue twice. Tennis omissions can use exact player/complete-partnership search; opponent/time/ambiguity checks remain strict.
- Direct Native Banner and voluntary labelled Sponsored offers. Account/admin pages exclude passive ads. Tests intercept vendor calls rather than producing real ad clicks.
- Public Watch, Fixtures, Live, Scores and News page responses were HTTP 200 in 1.9–3.6 seconds from the audit connection. A free backend cold start can still be slower.
- PR45 application CI: typecheck and production build passed, 141 automated tests and 58 browser tests passed; one optional external-media test skipped. Separate real PostgreSQL integration checks passed. Earlier production account checks verified persistence through a backend restart and cleaned their synthetic accounts.

## External access or owner decisions still required

1. **Coverage beyond the free provider.** SportScore publishes animation for football, basketball, tennis and cricket, with gaps by fixture. Universal multi-sport animations need an entitled provider. The free Sportradar enquiry has no reply/client ID yet. No paid agreement was accepted. Cross-origin embeds remain subject to publisher/browser availability; fallback and recovery do not constitute an animation guarantee.
2. **Premium video rights.** No authorized free Chelsea–Manchester United broadcast was verified for the visitor's region. Adding arbitrary unofficial URLs would not establish rights. The source editor is ready for a genuinely authorized source and playback verification.
3. **Additional advertising formats and payouts.** Adsterra rejected iframe-wrapped ad tags and does not support the requested VAST flow. No forced ordinary-ad click unlock is installed. Direct Native Banner and the voluntary Smartlink are active integrations; payout, identity/tax information and withdrawal require the account owner. No earnings or withdrawal are claimed.
4. **Free-host operations.** Render idle wake-up, provider quotas, distributed caching, backup retention/restore ownership and capacity remain operational limits. There is no new paid compute, automatic backup schedule, email verification delivery or background push.

These dependencies are not hidden behind a "100%" claim. Existing requested application fixes have production evidence; universal streams, animations and monetization cannot be certified from the access currently supplied.

Operational detail: [database](DATABASE.md), [News](NEWS.md), [advertising](ADVERTISING.md), [tracker coverage](TRACKER_COVERAGE_AUDIT_2026-10-31.md), [Render](RENDER.md).
