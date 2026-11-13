# Provider expansion and external audio controls

Scope: supplement PPV rather than replace it. Keep the current site design and its separate advertising placements. Collect sports-only live events, channels, upcoming schedules and sports replays. Merge equivalent events, deduplicate mirrors, and expose every distinct usable source as Stream 1, Stream 2, etc., with no arbitrary per-event source cap. Use bounded concurrent requests and pagination for operational safety; these must not silently truncate source discovery.

## Links extracted from owner attachments

| Family | URLs from screenshots/notes | Discovery status |
| --- | --- | --- |
| Existing PPV | https://ppv.st | Existing integration; not newly verified for clean playback |
| Streamed | https://streamed.pk | Closure notice confirmed during read-only check; discovery/reference only |
| Strmfree | https://strmfree.pk | Public JSON adapter implemented; runtime catalogue refresh succeeded; decoded playback remains unverified |
| Tim Streams | https://tim-streams.com | Sports-only channel adapter implemented; Node requests time out locally, so disabled by default pending runtime/playback verification |
| Pitsport | https://pitsport.st | Listed on Streamed closure page; integration not verified |
| DaddyLive directory | https://daddylive.pk | Public sports directory adapter implemented through the current `thedaddy.li` redirect. It follows each published channel page to that page's supplied player URL; decoded playback remains unverified. |
| DaddyLive mirrors | https://dlhd.pk ; https://dlhd.st ; https://dlstreams.st ; https://thedaddy.pk ; https://dlive.sx | Listed in screenshot and current directory. The adapter uses one canonical public directory so mirror aliases do not inflate the catalogue. |
| VIPBox | https://vipbox1.com | Sports categories confirmed; embeds/permissions/playback not verified |
| Wrestling | https://watchwrestling.ae ; https://watchwrestlingtv.se ; https://watchwrestling.tf ; https://watchwrestlinghub.com | Extracted from four screenshots; not yet verified as independent stream providers |

Earlier conversation attachments also identify https://mirrors.st and PPV mirror domains https://ppv.tj, https://ppvs.pk, https://ppv.rw, https://ppv.ms, https://ppv.bi, https://ppv.ug. Treat these as PPV discovery/failover candidates, not new independent providers. No assumption that old screenshot online labels remain accurate.

## Required provider evaluation

For each family: determine supported schedule/feed/embed integration and embedding permission; discover sport/event/start time/source identity; match events conservatively; retain provenance internally; verify playback rather than iframe load; record popup/redirect behavior and audio capabilities; reject unrelated entertainment. Never fabricate future schedules that a provider has not published. Do not circumvent login, paywalls, DRM, signed access or anti-bot challenges. No automatic production integration is asserted by this inventory.

## External player audio request

The requested toolbar is `BroadcastPlayer` in `apps/web/app/components/broadcast-player.tsx`, with reload, stop and fullscreen icons. It renders a cross-origin iframe for the selected broadcast URL. Source schema currently provides id/label/url, with no provider-issued volume capability or control protocol. Source selection must not treat an iframe load as proof of audio control.

An iframe has no standard volume/muted property. Browser same-origin isolation prevents BackInIt reaching inside an unrelated provider document to adjust its video. Changing iframe allow/sandbox flags does not grant cross-origin DOM access. A working external mute/unmute and volume slider requires a documented provider player API (with exact-origin messaging and readiness/state confirmation) or a supported direct media source rendered by BackInIt's own video element. Do not ship a decorative control or claim muting worked without verification. Existing native/official video paths can be extended independently, but that alone does not satisfy the requested PPV broadcast toolbar behavior.

Acceptance: toolbar mute/unmute and volume adjustment do not interact with provider overlays, do not reload the stream, reflect confirmed state, and survive supported source/reload transitions. Verify in desktop/mobile and fullscreen. Unsupported embeds must not be labeled audio-controllable. Keep this task alongside provider expansion and playback popup reduction.

References checked: https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Same-origin_policy ; https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/volume .

## Implemented locally, pending review

- PPV plus a cached StreamFree public JSON adapter. One request per minute per provider, single-flight refresh, bounded response bodies, allowlisted HTTPS embed hosts and independent stale snapshots. Empty valid feeds remain valid. No arbitrary source-count cap. Preserve PPV event IDs when matching the same participants, sport and start within 15 minutes; do not merge other dates/replays. Mirrors deduplicate by URL.
- StreamFree live flags are retained. A kickoff timestamp alone does not mark an inactive source live. The feed supplies no end time: the adapter uses an eight-hour listing window, which is an estimate, not verified match duration. Source live flags are provider reports, not decoded video checks.
- External broadcast IDs work in watch pages, event lookups, and Multiview share URLs.
- New player source menu with search above eight sources, selected state, keyboard navigation, Escape/outside dismissal, fullscreen top layer and mobile sizing. Clearer BackInIt branding and larger controls. Theatre screen height is bounded.
- Multiview uses stable iframe positions in the DOM and CSS visual ordering to avoid reloading playing frames when making another stream main. Empty share-URL slots remain empty; duplicate IDs are not instantiated twice. Slot labels identify each stream.
- Competition/promotion filter derives available groups from actual catalogue entries, including explicitly named WWE, AEW, TNA/Impact, NJPW, ROH, MotoGP and Formula 1. This does not manufacture missing coverage.
- DaddyLive public channel discovery walks every published sports row with four bounded workers and no source-count cap. It admits only the exact HTTPS player path supplied by the public channel page, rejects credentials, unexpected hosts and unrelated entertainment, and saves each recovered channel so a long crawl survives restarts.
- Automatic artwork matching uses the public IPTV-org channel/logo metadata catalogue. It excludes NSFW entries, prefers current colored and horizontal artwork, matches normalized channel names plus country suffixes, and keeps a branded fallback when no trustworthy match exists. New metadata is refreshed every 24 hours rather than requiring a manual logo map.
- Watch now has polished searchable Sport, Competition/promotion and Order menus; the duplicate specialist-filter row was removed. Wrestling, boxing, esports, motorsport and other supported sports remain in the main sports navigation and the data-driven Sport menu.
- Channel cards show explicit country labels when the channel name supplies one, wrap long names, use consistent card heights, and label continuous channels as `Live 24/7`. Match cards use real team/player imagery from the event feed when available.
- Watch's rolling seven-day view now loads the full event schedule rather than filtering a single-day response. When a selected sport has continuous channels, those playable options appear above its match/tracker schedule instead of leaving the user at an empty screen.
- Official replay/highlight discovery now covers WWE, WWE Vault, AEW, TNA, NJPW, Wimbledon, US Open, Roland-Garros, ATP, WTA, UFC, ONE Championship and PFL, alongside the existing basketball, cricket, football and Formula 1 publishers. Only videos whose current official metadata matches the expected publisher are admitted.

## Provider readiness and blocked candidates

- StreamFree docs: https://strmfree.pk/api ; feed: https://strmfree.pk/api/v1/streams . Live runtime returned catalogue entries and distinct sources. Full audio/video/popup behavior still requires real browser playback inspection; iframe loading alone is not proof.
- Tim Streams: its public frontend calls `/api/channels` and `/api/live-upcoming`. Read-only channel data had 225 entries, 140 categorized Sports; entertainment and VIP rows/sources are excluded. Current event feed was null, so event field mappings are not guessed. Local Node fetch repeatedly timed out even though a separate HTTP read succeeded. `TIM_STREAMS_ENABLED=true` is an explicit opt-in only after runtime and playback validation. No imported Tim coverage is claimed by default.
- DaddyLive redirects to https://thedaddy.li/ . Its separate webmaster API still requires partner provisioning and is not used. The local adapter only reads the public directory and follows the exact iframe URLs already published by each public channel page; it does not guess routes or bypass partner provisioning.
- Wrestling: sampled `.ae` episode, `.se` episode and `.hub` schedule returned 403; `.tf` episode hostname failed resolution during follow-up. No access-denied pages are embedded or bypassed. Their homepages are not stream URLs.
- VIPBox: public category directory found, supported catalogue/embed API not established. Pitsport: frontend shell found, supported API not established. Both remain unintegrated.
- Replacement research: https://matchora.to/developers and https://api.esportex.site/api document public APIs, but actual API calls returned 403 locally. Leave out rather than circumvent. Other candidates were unavailable; no replacement coverage is claimed.

## Saved follow-ups

- Verify real decoded playback, redirects/popups, long sessions and mobile/fullscreen on each enabled source family before production release. Current automated player tests use controlled embed fixtures.
- Source-favourite and report-a-stream actions; verified quality/language labels where providers supply metadata.
- New sports/promotion adapters only when an accessible supported integration and actual source data are available. Unavailable League Two/MotoGP/wrestling events cannot be promised.
- External per-tile audio is still unsupported for these cross-origin embeds; no decorative mute controls shipped.
- Premium/payments remain deferred per owner instruction.
- Advertising/cookie implementation unchanged. No production deployment or merge in this batch.


## Verification record

- Production build and all four package type checks passed.
- Current provider/artwork/snapshot regression set: 26 passed. A broader run passed 187 and skipped 8; four account/notification cases timed out under concurrent host load, then all 9 affected cases passed when rerun alone.
- Watch/Multiview browser suite: 12 passed. Includes rolling seven-day schedule loading, matching continuous-channel suggestions, keyboard accessibility scans, mobile overflow, channel artwork/fallback behavior, 130-source selection, promotion filtering, external-ID navigation and preservation of playing frame requests during focus/removal. Browser embed fixtures validate BackInIt behavior, not provider video decoding.
- Inspected generated light/mobile, dark desktop and Multiview screenshots under `artifacts/`.
- Advertising file SHA256 unchanged: `56a9d7c2defb5494e80db29a5e33016f37e90d0c5241dea4cd5454bdf49eb7a8`.
- Latest local runtime feed: 500 merged entries, including 403 channels and 391 newly discovered DaddyLive channel entries. Automatic artwork matched 193 of the newly discovered channels, including SuperSport Rugby, SuperSport Tennis, Fight Network and Sky Sports F1 UK. Counts are a point-in-time observation and HTTP/embed discovery is not a successful decoded-playback claim.
- Latest official video refresh returned 80 verified entries: 25 wrestling and 21 Tennis, with the remainder across MMA, basketball, cricket, football and Formula 1. A current Tennis seven-day browser check rendered 75 scheduled matches plus four continuous Tennis channel options. Counts change with publisher feeds and do not imply every scheduled match has a dedicated stream.
- Local web preview serves `/watch` on port 3000; local data API on 4101. Automatic browser-tab access to its existing internal error page was rejected, so owner must refresh the tab. No browser security workaround attempted.

## Catalogue outage repair

Follow-up screenshot showed an empty local catalogue. Direct curl and Node requests confirmed intermittent DNS/connect timeouts before provider data reached the app. No DNS settings, provider blocks or cookie code were changed. Provider requests subsequently recovered: both APIs returned 200, and local API plus web proxy returned 117 entries with a new timestamp and `stale:false`.

Added an atomic file snapshot (`BROADCAST_CACHE_PATH`, default `.data/broadcast-catalogue.json`) to retain a validated successful aggregate across process restarts. Restored data is always marked stale and refreshed in the background; snapshots expire after six hours. Original timestamps are preserved. Invalid, oversized and expired snapshots are rejected. Storage failures do not stop the live catalogue. This survives process restarts only where the host retains that filesystem; ephemeral deployments need a persistent cache path/shared store for cross-deployment retention.

Recovery verification covers snapshot/restart, offline refresh, original timestamp, corrupted/expired file rejection, storage errors, provider isolation and PPV parsing. API and web production builds passed. The real refreshed catalogue was verified through both port 4101 and the frontend `/api/broadcasts` endpoint, and the current Watch page was captured from the running local preview for visual review.
