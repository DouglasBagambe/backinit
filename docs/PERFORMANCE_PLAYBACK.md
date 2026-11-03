# Playback and navigation performance

## Implemented behavior

- BackInIt's global popunder tag is removed. Player/detail, multiview and replay-player routes do not load the global Social Bar or Home video-slider tag. Existing labelled display/native placements and voluntary sponsored links remain. The original external player URL and permissions are retained. A proposed popup-restricting sandbox was investigated but not included without decoded-playback compatibility evidence. Provider-controlled ads remain external to BackInIt. Play starts that player; changing source starts the chosen source immediately and remembers the selection for this browser session. No timed house-ad gate or fabricated VAST feed is added.
- Real overview/sport pages render their interface without waiting for the full sports API. Public data loads independently. Detail routes fetch only their fixture, avoiding the preceding all-sports request. A streamed skeleton covers pending work; static invalid routes are rejected before the streaming boundary, retaining their 404 status.
- Event APIs accept validated sport/date filters. Backend provider execution and coalesced snapshots are scoped by sport and date. A tennis request does not invoke football, racing, WWE or broadcast catalogue ingestion. Filters remain isolated in the cache. Real-time provenance and stale-score handling remain intact.
- A bounded 16-entry browser memory cache shares public requests across consumers/soft navigation. Catalogue snapshots expire after 10 seconds; individual event requests use 3 seconds. A departing page cannot abort another page's shared request. Account/private endpoints are excluded, and failed responses are not stored. No fixture data is written into long-term browser storage.
- New display banner loads wait during the five-second startup priority window. Already loaded creatives are retained, rather than refreshed for extra impressions. Off-screen banners remain lazy. Native/video ad formats are not repurposed into forced prerolls.
- Direct HLS retains adaptive quality, caps automatic quality to the player's dimensions and limits back-buffer retention. Fatal network errors receive at most two consecutive delayed restarts, reset after a healthy fragment; a media error receives one recovery per connection. Teardown cancels pending recovery. Existing provider/YouTube players remain responsible for their own buffering and controls.

## Measurement

`scripts/performance-audit.mjs BASE OUTPUT` takes first/repeat HTTP samples without running ad scripts or starting a stream. Browser Performance entries separately record `backinit:public-data`, `backinit:play-request`, `backinit:embed-frame-loaded`, and native-video `backinit:video-playing` / `backinit:video-waiting`. A loaded iframe is explicitly not measured as video playback. There is no external analytics transmission.

Local production-build samples against the same external API (two requests per route):

| Route          | Before headers, ms | After headers, ms |
| -------------- | ------------------ | ----------------- |
| Home           | 1690 / 1538        | 329 / 66          |
| Watch          | 28 / 26            | 75 / 36           |
| Fixtures       | 1519 / 1518        | 26 / 22           |
| News           | 24 / 26            | 48 / 41           |
| Broadcast room | 20 / 19            | 66 / 35           |
| Broadcast API  | 20 / 23            | 38 / 22           |

Raw samples are in `artifacts/performance/before.json` and `after.json` locally. The substantive gain here is removing the overview's blocking catalogue wait. Already-fast routes are not claimed to improve based on this small sample. These measurements exclude browser rendering, first video frame, provider buffering, advertising overhead and genuine hosting cold starts. API availability/cache state and machine load affect them.

## Remaining external constraints

The free backend can sleep. No hosting plan, billing setting or synthetic keepalive is changed. Short-lived snapshots and nonblocking page rendering mitigate visible delay but do not make a sleeping upstream answer immediately. Cross-origin embeds do not expose decoded-frame/buffering telemetry without a supported provider interface; their ad flows cannot be bypassed. The account currently supplies a HilltopAds video-slider tag, not an issued VAST preroll feed. A single skippable preroll needs the correct tag and supported integration; its network skip timing must be preserved.

Cookie-choice code and existing essential-only checks are outside this change. Their existing mismatch is retained and must be reported separately, never hidden by weakening those checks.

## Validation status

Typecheck and production builds pass. The full local browser run has 72 passes and one optional external-media skip. Two unchanged checks fail against the existing cookie-choice behavior: the essential-only storage choice and the native-ad-withdrawal check. They are not suppressed, rewritten or attributed to this performance work. The cookie component has no diff in this branch. The owner has disabled required merge checks. These existing failures are disclosed separately and do not mean GitHub is technically blocking a merge. This paragraph describes the earlier performance run; current repair evidence is recorded in PRODUCT_BACKLOG.md.
