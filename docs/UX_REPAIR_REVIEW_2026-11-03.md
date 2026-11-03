# Sports experience repair and visual review

Work in progress — 3 November 2026. This report records inspected behavior, not a promise of complete Sofascore parity. Publication waits for the final review/checks. Premium is deferred for one working week at the owner's request.

## Fixed findings

| Area | Finding | Repair |
| --- | --- | --- |
| Live coverage | US-calendar NBA/NHL games after UTC midnight absent | Fetch requested and previous venue day, deduplicate IDs |
| Watch status | Broadcast time windows kept known finished matches live | Reconcile recent authoritative completed/cancelled/postponed/suspended fixtures |
| Live navigation | Results duplicated Scores; date picker conflicted with live-only purpose | Dedicated in-progress list, ignore old status/date URL parameters |
| Search | Profile-request failures could cool down independent search; failure looked like zero results | Isolate search cache, bounded retry, useful partial results, explicit recovery |
| Following | Saved only showed events; Follow briefly displayed before synchronization | Following cards in Saved; authoritative account response; guest synchronous storage; loading state |
| Saved hierarchy | New Following panel appeared before the page heading | Move it below the Saved title |
| Tennis | HTML collapsed spaces between set values | Explicit centered-dot separators |
| Watch artwork | Wide team logos cropped into narrow image strips | Contain full artwork; wider compact desktop image column |
| Home | Two large introductions repeated the Watch invitation | Keep one introduction |
| Lineups | IDs/photos dropped; valid mixed midfield formation failed | Carry provider identities/photos; merge adjacent midfield roles only where reported formation fits |
| Lineup fallback | Tiny initials and names aligned awkwardly beside pitch portraits | Consistent portrait/initial badges; names below; jersey badges and player cards |
| Search focus | Large square inner focus outline | Visible rounded outline around the whole search field |
| Play | Provider Play can still initiate its own advertising | No BackInIt click-to-ad handler or fabricated pre-roll; provider integration remains an open dependency |

## Scope of remaining limitations

- Football headshot coverage is incomplete. A real Chelsea–Manchester United inspection found few supplied images; the generated Palmer CDN URL returns 404. Missing photos use initials. Full coverage needs another supported source. Do not claim every player has a photo.
- Formation graphics need confirmed starters and coherent positions/formation. Other roster entries use portrait cards; do not invent a formation for incomplete data or apply a football pitch to other sports.
- The external live player inspected remained connecting; its media playback is not certified by an iframe loading or by mocked tests. Inline ads and source buffering remain provider-controlled. The blank local embed persisted even with original permissions, while the same source loaded directly. A proposed sandbox was removed from this repair because decoded-playback compatibility was not verified. Do not claim provider ads are removed.
- Existing cookie-choice and native-ad-withdrawal failures remain, with no changes to the user-edited advertising component or those assertions.
- Payment/provider eligibility and billing are deferred. See PREMIUM_PLAN.md.

## Verification so far

- 163 unit checks passed; 8 optional tests skipped.
- Typecheck and production builds passed.
- Full Chromium suite: 84 passed, 1 optional media skip, 2 existing cookie-choice failures.
- Additional affected suite: 19 passed, including signed-in follow/Saved/reload, search outage/recovery, partial-result retention and known-finished Watch suppression.
- Real basketball response returned three live NBA games omitted by the old date request.
- Real Chelsea–Manchester United: both 4-2-3-1 formations render; roster photo fallbacks visually inspected. Parma's mixed midfield 3-5-2 is covered by a unit test.
- Final post-visual-adjustment checks and route inventory to follow below.

## Final review results

The broad route inventory was exercised at 360, 390, 430, 768, 1024, 1440 and 1920 pixels in both themes: Home, Live, Scores, Fixtures, News, Watch, Videos, playback diagnostics, Saved, Search, Settings, Account, Admin, Competitions, Teams, Athletes, Privacy, football/WWE/Formula 1/tennis sport pages and representative match centres. This verifies layout overflow and route rendering, not every provider or every possible match.

Real-data visual inspection focused on Home, Live, Fixtures, Scores, Search results, Saved, Settings, Account, News, Watch matches/channels, real player profiles, Chelsea–Manchester United lineups and Atalanta–Parma lineups at 360px. Complete poster artwork is visible at the reported 989×620 size. Signed-in following, source switching, theatre/fullscreen, tracker recovery, keyboard/a11y and multiview are also covered by the repository browser journeys.

Latest full run: 84 passed, one optional media check skipped, two known cookie failures plus one timeout in a newly added request listener. The listener expected a question mark after an unfiltered URL; it was fixed. Final affected run: 13 passed, including Live's date/status isolation, reopening Saved player profiles with the sport label, and saved-status outage recovery. Final typecheck/build passed. Unit result remains 163 passed / 8 optional skips.

During real ad-enabled inspection a network-supplied floating offer overlapped the upper navigation. This is recorded as an outstanding placement/configuration issue; the user-edited advertising component is unchanged. It is not represented as a passed ad UX check.

The feature repair can be reviewed as a separate change. Universal player-photo coverage, verified playback for all external embeds and control over provider Play advertising are not completed. No premium/checkout UI was added. No production deployment is asserted by this report.

### Delivery check, 3 November 09:34 EAT

- Final unit run: **171 passed, 8 optional skips**. All four typechecks pass. Production frontend/API builds pass.
- Final affected browser run: **20 passed**, including the duplicate-tracker regression found during the previous run. No test assertion was weakened to hide that defect.
- League validation is fixed in the browser proxy, API controller and provider adapter. Six route-boundary tests cover hyphenated/underscored IDs and reject path-like input. A real HTTP request through the repaired backend returned Messiah Hampton (American football, Wide Receiver) with five appearances, confirming college player profiles beyond the Palmer example.
- Player directory indexing preserves supplied portrait URLs and provider IDs. Athlete cards now include image/initial marks as team cards do.
- Media privacy copy now reflects automatic player loading when opening a broadcast/source; it no longer incorrectly promises the request waits for Play.
- Added/retained review blockers: comprehensive football photos, external player playback/ad integration, network overlay placement and unchanged cookie-choice failures. These are not silently marked complete.
