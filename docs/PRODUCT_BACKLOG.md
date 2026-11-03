# BackInIt consolidated work plan

Updated 3 November 2026 (Africa/Kampala). New user messages add tasks; they do not cancel earlier work unless the user explicitly changes or withdraws it. Repeated requests are consolidated below. Never include credentials in this document.

## Current delivery: repair the deployed sports experience

Checked items below are locally implemented/verified, not a claim of deployment or complete provider coverage.

- [x] Correct US-calendar/UTC-midnight scoreboard coverage so morning NBA/NHL games are available in Live, Fixtures, Scores and Watch.
- [x] Reconcile known finished/cancelled/postponed games with Watch; a scheduled streaming window must not override a reported match result.
- [x] Make Live a dedicated in-progress view; keep completed results in Scores.
- [ ] Make player/team search reliable across Search, sport pages, Watch and directories. Separate provider-search failure from genuine zero results; provide retry and retain usable cached results.
- [x] Ensure all indexed players use the same profile path (Palmer is an example, not a hardcoded exception).
- [x] Verify followed players/teams/competitions persist for signed-in accounts, guests, reloads and navigation. Show followed entities in Saved even without current fixtures. Do not briefly display an incorrect Follow state during account loading.
- [x] Present tennis sets in a readable format throughout Home, score rows and match headers.
- [x] Fix cropped Watch images/logos at mobile, short desktop and standard desktop sizes.
- [x] Use graphical formations wherever confirmed formation and positions are supplied, and graphical player cards for remaining roster/substitute entries. Retain actual player IDs and supplied photos. Never invent positions, photos or ratings.
- [ ] Verify the same match information/lineups from Home, Live, Fixtures, Scores, Watch, search and team/player history links.
- [x] Remove duplicate Home introductions and keep one clear route into Watch.
- [ ] Test recovery, real provider data and mobile/desktop layouts before claiming release readiness.

## Playback and animation — retained requirements

- [ ] Latest decision: Play must not trigger a BackInIt popup/redirect. Test provider-frame popup/navigation restrictions without claiming control of provider inline ads.
- [ ] A real, supported video pre-roll may precede Play only when a compatible issued integration exists. Use the network's supported close/skip timing, once per intended session, then allow uninterrupted Play/retry/source changes. Never require clicking an advert.
- [ ] If compatible video pre-roll is unavailable, use no BackInIt playback ad gate. Existing HilltopAds Video Slider MultiTag is not a VAST pre-roll and must not be misrepresented as one.
- [ ] Stream is the main view when available; tracker remains beside/below at a smaller size, with a useful tracker-first page when there is no stream.
- [ ] Preserve tracker expiry/error/blank-frame recovery, natural sizing, full visible animation and accurate real match data. Do not manufacture ball movements or scores.
- [ ] Preserve source switching, theatre/fullscreen, session source choice and Multiview slot/layout behaviour. Verify source errors and stalled requests.
- [ ] Continue performance improvements across every major route and reduce avoidable loading; distinguish origin buffering from app delays.

## Accounts and paid ad-free access — deferred by owner

- [ ] Premium is deferred for one working week of using/testing the current site, per the owner’s latest instruction. Keep existing ad-supported access; do not add a checkout or paid-tier UI now.
- [ ] Finish remaining account UX/reliability after sports repairs; verify saved state, in-app notifications, settings and admin access.
- [ ] Pricing proposed to owner: UGX 5,000/month or UGX 50,000/year launch offer. Not yet an approved live billing configuration.
- [ ] Assess/setup a payment provider. Verified current Flutterwave self-service signup offers only Nigeria and sends other countries to Contact Sales; the owner’s onboarding country is locked to Nigeria. Do not submit inaccurate country information. Compare Pesapal Uganda and obtain a merchant fee quote before selecting a replacement. Owner has no existing provider account. Uganda mobile-money/card compatibility, business eligibility, fees and supported renewal methods must be checked. Provider onboarding/identity/terms steps require the owner where applicable.
- [ ] Implement real verified payments/webhooks, idempotency, account entitlement, expiry, cancellation/refunds and server-side verification before selling subscriptions. Never activate premium from an unverified redirect or browser flag.
- [ ] Remove all BackInIt-owned ads for eligible subscribers across Home, browse, match, player, trackers and Multiview. Do not sell a promise to remove third-party inline player ads unless the provider supports it.
- [ ] Keep price, renewal, cancellation and the scope of ad removal explicit in checkout and account controls.

## Original product scope retained

- [ ] Sports-only automated broadcast ingestion and upcoming schedules across sports; reject entertainment/cows/cartoons. Keep marquee games prominently ranked while retaining comprehensive filters/pagination.
- [ ] Watch tabs: Matches, Sports channels, Replays & highlights. Date order: All, Live now, Today (default), Next 48 hours, Tomorrow, This week. Today includes its live and upcoming games.
- [ ] Expand verified sports highlights/replays and ensure replay browsing stays within Watch.
- [ ] Preserve viewer counts sourced from the provider, labelled "watching"; do not invent a BackInIt-only audience count. Retain legally/contractually required attribution and original watermarks.
- [ ] Subtle BackInIt branding on players and trackers without covering content/controls.
- [ ] Home at `/`; logo returns Home. Distinct Watch header action. Consistent visual quality, spacing, dates and useful settings across all routes.
- [ ] Sofascore-style discovery/profiles, lineups/formations, statistics, timeline, H2H, form, standings, favorites and notifications where real data supports them. Record missing provider coverage explicitly; do not claim full proprietary-data parity.
- [ ] Monetization on popular pages through supported, unobtrusive placements. No accidental duplicates, misleading click gates or fabricated video ads. Preserve the user's current cookie implementation unless explicitly authorized to change it; document its failing tests honestly.
- [ ] No paid provider commitments or further provider-support emails without applicable authorization. Earlier SportScore email was explicitly declined.

## Existing shipped foundation (verify rather than rebuild)

- [x] Backend independent entity search/profile APIs and standings are deployed.
- [x] Shared match interface, player-history profiles, unified Watch filtering and refreshed Home were merged in PR #61 by the owner.
- [x] Generic player biography/history supports supplied football/basketball data; partial tennis stats no longer reject the biography.
- [x] Earlier baseline: 161 unit tests passed; 78 full browser checks passed, 2 existing cookie-choice failures, 1 optional external-media check skipped. This baseline is not certification of today's follow-up fixes.
- [x] Existing account credentials and user-edited advertising file are preserved.

## Evidence and handover

Record new test results, production commit/deployment IDs, known limitations and completed tasks here or in the release report. Do not silently remove unfinished items. Relevant prior reports: `UX_AUDIT_2026-11-03.md` and `RELEASE_VERIFICATION_2026-11-03.md` in the parent workspace.

### Repair verification — 3 November, morning

- Production build and typecheck passed. Unit suite: 163 passed / 8 optional skips, including mixed midfield formations.
- Full Chromium browser suite: 84 passed / 1 optional external-media skip. Two existing cookie-choice checks still fail, and the user-edited advertising component is unchanged.
- Signed-in player follow was verified through the actual local account API/database, Saved navigation and reload. Guest following and search-outage recovery passed.
- Actual NBA feed now includes the previous US-calendar day and returned three live NBA games that the old date request omitted.
- Actual Chelsea–Manchester United lineup data resolves both 4-2-3-1 formations and numeric player image URLs. Real browser inspection found only a few supplied photos available; Palmer’s generated ESPN headshot returns 404. Missing images fall back to initials. Comprehensive football-photo coverage still needs a supported image source; it is not finished.
- Additional checks: mixed midfield formation unit check passed; 19 affected browser checks passed, including partial-search retention. Final portrait alignment was inspected in desktop and mobile; final post-audit regression checks remain before commit.
- Owner requested another complete page-by-page visual audit before publication. Premium is deferred; continue current repair and UI verification first.
- No new repair deployment has been claimed. Commit/release identifiers will be recorded after publication.

- Playback investigation: local external frames remained blank with and without a proposed popup restriction, while their direct provider pages loaded. No sandbox change is included without decoded-playback evidence. Provider Play advertising remains an unresolved integration dependency, not a completed repair.

### Final audit corrections

- Saved page hierarchy, rounded search focus, large legible fallback portraits and names beneath pitch portraits are in the final build.
- Live ignores historical date/status parameters and no longer offers a date picker; it does not display a misleading zero count while the initial catalogue is loading.
- Saved profile reopening resolves the player's sport from the verified search identity.
- Profile/directory saved-state outages now expose Retry sync while keeping edits disabled, rather than leaving an unexplained busy control.
- Latest affected browser run: 13 passed. Latest typecheck and build passed. The final broad run had 84 passes, one optional media skip, two existing cookie failures and one test-listener timeout; that listener was corrected and the affected Live test passed on rerun. No failures are hidden or reclassified as passing.
- Current publish status: not merged/deployed. Review artifacts and outstanding provider-media/photo limits before publication.

### Delivery evidence, 3 November 09:34 EAT

- Final: 171 unit tests passed / 8 optional skips; typecheck and production builds passed; 20 affected browser journeys passed.
- The final browser rerun caught and verified a fix for duplicate trackers when a matched broadcast loses its sources.
- College/cup player and team identities now pass all three request boundaries, while path-like league input is rejected. Real college-player bio/history was confirmed through HTTP.
- Player directory cards preserve supplied photos and provider IDs. Missing-photo coverage remains explicitly incomplete.
- Review branch is being prepared without merging or deploying. Premium stays deferred for a working week. The owner-edited advertising component and cookie assertions remain unchanged.

- Review pull request: https://github.com/DouglasBagambe/backinit/pull/62 (code commit a3e4b92). Open for review only; main and production are unchanged.
