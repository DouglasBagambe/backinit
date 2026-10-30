# Viewing and tracking — 30 October 2026

Watch now admits a fresh provider-reported match with useful scores, periods, statistics or events even without a broadcast. Such rows say **Track**. A live video source takes precedence and says **Watch live**. Bare schedules, stale tracker-only records, demo records and replay-only entries do not qualify as live viewing. Fixtures remains the complete schedule.

An event page places reported match tracking in the main area when no video source exists. With video, a compact tracker sits in the desktop rail or immediately below mobile video. Sport diagrams are decorative courts/fields, not positional measurements. No ball, possession, attack, shot or momentum is simulated. Changes to real reported scores/events fade in once; reduced-motion preferences disable that transition. Tennis displays provider games by set rather than inventing an overall score from sets.

The tracker polls the real event detail endpoint every 30 seconds while visible, prevents overlapping refreshes, aborts on navigation and marks retained snapshots stale on failure. Watch owns its updates; it no longer also performs a competing server-route refresh that could replace newer detail with an earlier schedule snapshot. This race was caught by the repeated-update browser test.

Embed startup is a white, icon-only Play button with an accessible name. It attempts playback after the click; browser/provider policy can still require a native-player gesture. Viewing/privacy/source information remains in a collapsed disclosure, and failure keeps the official source destination accessible. Native provider branding/controls are retained. A source selector appears when multiple sources exist; withdrawal still selects an available alternative.

The hosted data API now serves the public official-video catalogue, library source list and metadata-health endpoints without opening SQLite or requiring account storage. Publisher identity, freshness and allowed thumbnail hosts remain checked; concurrent catalogue requests coalesce. Ingestion-disabled mode returns an empty catalogue without network traffic. The persistent full-mode registry still controls operator revocations. These are replays/highlights, never substituted for live coverage.

## Advertising

An explicit sponsored card has been added to the event rail, alongside the existing below-video sponsor placement. It uses the existing publisher-issued Smartlink and never opens automatically. A responsive rectangle location is ready for approved display delivery. No new ad-click gate, fake ad creative, automatic paid click or invented earnings have been introduced. Passive banner requests remain disabled in production pending the advertising authorization described in ADVERTISING.md. Additional placements do not imply additional income.

## Verification and limits

Local production data API: 18 real official publisher videos across seven sports; catalogue, library and metadata-health returned HTTP 200. The no-database hosting probe confirms disabled ingestion does not substitute snapshots or create a disposable database.

A network-backed browser probe through the public backend decoded the ongoing BWF HYLO Open broadcast at 1280×720. Video time and decoded-frame count advanced; playback continued at mobile width without overflow and through the ordinary source refresh. See the timestamped evidence. This proves that sampled broadcast at that time and location, not every sport, territory or future event.

Automated contracts cover provider identity/failure/cache deduplication, tracker eligibility, consecutive score/event updates, stale preservation, tennis set presentation, no-video fallback, video+tracker responsive placement, icon-only startup, source withdrawal/retry, accessibility and ad isolation. Ad requests in browser tests are intercepted; no paid test clicks are made.

Not completed by this milestone: live ball-coordinate feeds, universal major-league broadcasts, licensed syndicated news, hosted custom-source administration, email recovery delivery or background push. Real positional animation requires an actual positional provider. Account recovery codes and in-app updates are separate existing features. The platform is not claimed complete.

## Publisher-powered animated tracking

Research found the publicly documented SportScore attribution-tier API and match-specific tracker embeds. The integration resolves the provider's fixture listing, requires exactly one match with the same normalized participants and kickoff within ten minutes (tennis allows up to three hours on the same UTC day for moving court schedules), rechecks the match detail, and accepts only a current live tracker. Server and client enforce an allowlisted embed URL, event binding and a short availability lease. Unsupported sports, missing tracker coverage, ambiguous identities, stale metadata, finished events and ingestion-disabled environments use the match-summary fallback. No upstream client IDs, profiles, private endpoints or third-party account credentials are copied into BackInIt.

The provider-controlled frame supplies its own sport-specific visualization and data updates. BackInIt does not turn score snapshots into invented ball paths. Football, basketball, tennis and cricket are supported by the resolver; this is not a claim of verified live action for all four sports or all competitions. The initial real sample is ATP Vienna: Adrian Mannarino–Daniil Medvedev. Provider and upstream attribution remain visible. A single tracker instance is mounted for the active desktop/mobile placement. Renewing availability does not recreate the iframe; theme changes apply the provider's supported theme parameter.

References checked on 30 October 2026:

- [SportScore documented API and attribution tier](https://sportscore.com/developers/)
- [SportScore published embed instructions](https://sportscore.com/embed/)
- [Sofascore official widgets](https://corporate.sofascore.com/widgets): free sharing widgets exist, but the observed live-match-tracker iframe is not itself evidence of permission to reuse that private route.
- [Sofascore API availability](https://sofascore.helpscoutdocs.com/article/129-sports-data-api-availability): no public data API is supplied; media widget inquiries use its partnership route.
- [Sportradar LMT documentation](https://apidocs.sportradar.com/resources/widgets/docs/lmt/lmt): a richer configurable multisport product, requiring the customer's own client identity/entitlement. No paid account or borrowed demo credentials were used.

Remaining limitation: a publisher frame's load event cannot establish content accuracy, continuous ball-coordinate coverage, absence of regional restrictions or a real-world location measurement. Real browser inspection is recorded separately; the fallback is not described as equivalent to the animated provider experience. Commercial white-label/attribution-free use or higher-volume/SLA requirements need the provider's own arrangement. This release retains the published attribution tier.

## Loading recovery follow-up

Publisher navigation now stays mounted after the 20-second soft timeout. The page shows its updating match summary over the pending frame and can recover when the original navigation eventually completes, without a second tracker request. A keyed publisher component prevents cached iframe load events racing against a later loading-state reset. Match-summary and reload controls also let viewers recover from a blank cross-origin visualization that an iframe load event cannot detect.

The published `sportscore:resize` message is supported with exact origin and frame-window checks, finite numeric height validation and a 420–1200px bound. Unrelated windows cannot resize the tracker. Brief score-detail outages retain an already approved tracker only until its existing availability lease expires; a finished match still removes it.

The browser regression delays a publisher navigation beyond 20 seconds, verifies the original frame survives and recovers, exercises manual summary switching without remounting, accepts the publisher's resize message and rejects a host-page message. Other checks cover lease refresh, transient score-feed failures and explicit withdrawal. These isolated contracts do not establish the external vendor's animation availability. On the vendor's own embed page, an inspected live football tracker remained blank before that match finished; a reliable external feed remains a provider dependency.

The tennis schedule tolerance was verified against the live Berrettini–de Minaur fixture: ESPN listed 19:15 UTC and the tracker publisher 19:00 UTC. Exact participants and uniqueness remain required; another day, a gap over three hours or two candidate matches still fail closed.

ESPN tracker resolution now reads the match’s league scoreboard rather than refreshing all sports catalogues first. This avoids unrelated provider delays on a cold match open. The tracker vendor timeout is eight seconds per request, the web route allows thirty seconds for bounded discovery, and the browser request is bounded at thirty-five seconds and aborts on navigation. A contract verifies one exact league scoreboard request with no unrelated provider traffic. Local DNS timeouts were also observed during verification, so the blank-widget observations cannot all be attributed solely to vendor reliability.

A real request confirmed that ESPN’s tennis summary endpoint returns a 400 error for the sampled ATP event, so the isolated tracker lookup uses the working league scoreboard and selects the exact event ID. The original generic summary lookup remains unchanged for its existing consumers.
