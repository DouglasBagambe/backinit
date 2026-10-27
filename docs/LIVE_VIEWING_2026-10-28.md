# Live viewing milestone — 28 October 2026

The mission is **not complete**: Liverpool v Chelsea cannot currently be watched inside BackInIt. No authorized, embeddable live source for that match or the other four cup fixtures was found or configured. A broadcaster subscription, publicly reachable URL or test feed does not change that status.

## Tonight's verified fixtures

All times below are Africa/Kampala (UTC+3). London is on GMT on this date.

| Fixture                                  | Kampala   | UTC       | In-page broadcast                                       | Verified external information                                                                                                  |
| ---------------------------------------- | --------- | --------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Manchester City v Brighton & Hove Albion | 22:30     | 19:30     | Unavailable: no authorized source                       | Official fixture; Sky/EFL partner destinations supplied for schedule checks, not claimed match-specific entitlement.           |
| AFC Bournemouth v Aston Villa            | 22:45     | 19:45     | Unavailable: no authorized source                       | Official fixture; partner destinations supplied with “check schedule” status.                                                  |
| Fulham v Crystal Palace                  | 22:45     | 19:45     | Unavailable: no authorized source                       | Official fixture; partner destinations supplied with “check schedule” status.                                                  |
| Sunderland v Brentford                   | 22:45     | 19:45     | Unavailable: no authorized source                       | Official fixture; partner destinations supplied with “check schedule” status.                                                  |
| **Liverpool v Chelsea**                  | **23:00** | **20:00** | **Unavailable: cannot play this match inside BackInIt** | Chelsea confirms ITV and Sky coverage in the UK. ITVX is UK-only; no embedding permission or Uganda feed has been established. |

Fixture evidence: [EFL round-four appointments and schedule](https://www.efl.com/news/2026/october/20/carabao-cup-round-four-referee-appointments/), [Liverpool official match listing](https://www.liverpoolfc.com/tickets/match/liverpool-v-chelsea-english-league-cup-20261028), [Chelsea kickoff/broadcast announcement](https://www.chelseafc.com/en/news/article/date-and-kick-off-time-for-liverpool-carabao-cup-tie-confirmed). Additional checks included [Manchester City fixtures](https://www.mancity.com/fixtures/) and [Fulham's cup announcement](https://www.fulhamfc.com/news/2026/october/19/crystal-palace-newcastle-ticket-updates/).

[EFL broadcast partners](https://www.efl.com/how-to-watch/broadcast-partners/) lists SuperSport and ESPN Africa for Uganda. This general directory does **not** establish which service/channel carries each of tonight's matches, a subscriber's entitlement or permission to embed video. Every cup page labels that distinction. [ITVX's own restrictions](https://help.itv.com/support/solutions/articles/204000074054-can-i-use-my-itvx-premium-benefits-abroad-) limit its service to the UK. We did not log in, purchase access, extract protected feeds or alter geographic access.

The priority local page is `/watch/efl-20261028-liverpool-chelsea`; the other four use stable EFL fixture IDs and have their own viewing/Match Centre pages. No test media is attached to any of them.

## What changed

- Home and Watch lead with real live/upcoming events, date/sport/search/timezone filters and a prominent Liverpool fixture. Replays/highlights moved to `/videos`; test playback moved to `/playback`.
- The EFL adapter fetches a fixed public official announcement, parses its published dates/times without executing page scripts, handles London daylight saving, decodes team-name entities and caches results for 15 minutes. If parsing/network fails, five previously verified fixture facts are returned explicitly stale. No score or live status is inferred from kickoff time.
- Dedicated `/watch/:eventId` pages combine the primary player, official viewing information, source restrictions/evidence, supporting sport information, available statistics/tracking and fast event switching. Viewer timezone is detected and can be selected/persisted. Date-only events and calendars do not invent a kickoff.
- Sources match exact canonical event IDs or exact provider/fixture references. There is no name-only/fuzzy matching that could attach the wrong broadcast to a similarly named event. Known test hosts and all `content=test` entries are forbidden from attaching to sporting fixtures.
- HLS uses native support or lazy HLS.js; DASH uses lazy DASH.js. Reviewed publisher frames and YouTube's SDK are separate adapters. Retry, source selection/fallback, buffering, supported native fullscreen/PiP, quality selection, live-window seeking, engine cleanup and availability checks are integrated.
- Administration supports saving a disabled event source, probing its manifest, playing its saved version, recording authenticated browser evidence, enabling it and revoking it. A direct source cannot be enabled before decoded playback evidence; a live direct source additionally requires a real live window. Verification expires after 24 hours and a URL/format change invalidates it. A mere HTTP success never qualifies as playback.
- Generic publisher frames without a supported SDK cannot report video decoding across origins. Their check is explicitly an administrator's visual observation, not automatic proof. Rights are an operator responsibility independent of playback compatibility.
- Administration/source edits remain role-gated, origin-checked, audited and versioned. Reviewed host configuration is required before admitting a new CDN/player host; no unrestricted URL proxy was introduced.

## Other sports

Discovery also includes the existing F1 feed and a **limited verified schedule snapshot**, not universal live coverage:

- NBA: Lakers at Clippers, 28 October in Los Angeles / 29 October in Kampala, from the [official Clippers ticket listing](https://www.nba.com/clippers/singlegametickets/2026-27/10-28-2026-clippers-vs-lakers). Full NBA game coverage/statistics are not connected.
- WWE: 30 October SmackDown in Charleston from the [official event page](https://www.wwe.com/event/friday-night-smackdown-85). The arena start is distinguished from television timing; featured performers are not invented bout bookings.
- UFC: Moicano v Nolan, 31 October in Las Vegas / 1 November in Kampala, from the [official event listing](https://www.ufc.com/event/ufc-fight-night-october-31-2026). Preliminary bouts have a separate schedule.
- Tennis: Vienna and Basel tournament weeks, 26 October–1 November, from [ATP Vienna](https://www.atptour.com/en/tournaments/vienna/337/overview), [ATP Basel](https://www.atptour.com/en/tournaments/basel/328/overview) and the [LTA calendar guide](https://www.lta.org.uk/news/2026/october/essential-guide-to-the-2026-indoor-hard-court-season/). Individual match times/order of play are unavailable.
- Cricket: ICC CWC Challenge League A matchday from the [official ICC fixtures page](https://www.icc-cricket.com/fixtures-results); individual start times/scorecards are not fabricated.
- Baseball: conditional World Series Game 5 from [MLB's postseason schedule](https://www.mlb.com/postseason), expressly “if necessary.” It is not presented as a confirmed ongoing game.
- NFL: Panthers at Packers, 29 October US / 30 October Kampala, from [the official Prime Video schedule](https://www.aboutamazon.com/news/entertainment/everything-you-need-to-know-about-thursday-night-football-on-prime-video). No Prime Video embed is configured.

Rugby and other unsupported details have official schedule destinations and honest empty states. Snapshot dates, conditional events and missing live statistics remain visible. Listing nine sport categories is **not** a claim to cover every major event or to supply broadcasts for them.

## Platform/source research

| Source                                                                                                                                                       | Established capability                                                                                        | Access/territory/account                                                                                                                                | BackInIt result                                                                                                                                               |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [FIFA+](https://www.plus.fifa.com/) / [FIFA's DAZN announcement](https://inside.fifa.com/organisation/media-releases/fifa-plus-dazn-global-home-of-football) | Selected live football and archives.                                                                          | Territory and service/account rules vary. The direct plus.fifa.com catalogue returned an access restriction during research.                            | No Carabao broadcast or permitted iframe/manifest established. Outbound destination only; no protected-feed extraction.                                       |
| [UEFA.tv FAQ](https://www.uefa.com/uefatv-faq/) / [terms](https://www.uefa.com/uefatvtermsconditions/)                                                       | Selected youth/women's/futsal matches and other programming; additional premium services have distinct terms. | Free registration for ordinary service; some events geo-restricted. Flagship live competitions generally excluded; premium availability is territorial. | No Liverpool–Chelsea coverage or embedding permission established. This is not an EFL source.                                                                 |
| [Official YouTube](https://support.google.com/youtube/answer/171780)                                                                                         | Publisher-enabled embeds; selected genuine live events/replays/highlights.                                    | Publisher controls embedding, region, age and login restrictions.                                                                                       | Optional archive library remains separate. No current cup broadcast was found or relabelled from an archive title.                                            |
| [Chelsea](https://hospitality.chelseafc.com/faq/) / [subscriptions](https://memberships.chelseafc.com/en/subscriptions)                                      | Club video, pre/post-match coverage, audio and updates; some live content depends on rights/subscription.     | Account/product/region conditions vary.                                                                                                                 | Audio/update destination labelled accordingly; no full live men's cup video established.                                                                      |
| [EFL](https://www.efl.com/how-to-watch/broadcast-partners/)                                                                                                  | Official schedules and broadcaster information.                                                               | Entitlement rests with the actual broadcaster/service.                                                                                                  | Fixtures ingested; official partner directory linked. No broadcaster feed or embedding agreement supplied.                                                    |
| [Cloudflare Stream Live](https://developers.cloudflare.com/stream/stream-live/)                                                                              | Ingest an authorized producer's feed and supply player/manifests through managed infrastructure.              | Requires a configured account/input and billable delivery; does not supply sports rights.                                                               | No account, input, subscription or purchase created. Architecture can accept a reviewed authorized output; this is not a free source for third-party matches. |

## Public aggregator UX observations

Read-only review of publicly observable pages using the names [Camel Live](https://www.camel1.tv/) and [TotalSportek](https://totalsport-ek.com/fixtures) showed schedule-first discovery, sports/competition navigation, search, live/upcoming organization and links to event destinations. The TotalSportek page exposes multiple sport categories and a multiview/channels destination. Multiple similarly named domains exist; this is not verification of any operator's identity or rights.

BackInIt applies those useful navigation patterns with explicit source identity, health and availability. A separate fixture catalogue, event/source registry and playback-adapter layer is **our architectural inference/design**, not a claim to know those sites' private feeds, databases, hosting, entitlement checks or source-acquisition methods. No broadcast URLs or protected player traffic were extracted and no content was copied.

## Broadcast onboarding requirements

Before a real sporting broadcast can play here, an operator must obtain:

1. Written distribution/embedding permission for the exact event, commercial use, territory and time window.
2. A permitted HLS/DASH output or publisher-approved iframe/SDK, including codec/CORS/segment/key compatibility and legitimate entitlement requirements.
3. The source owner's evidence URL, event ID/provider fixture reference, programme type (live/replay/highlights) and expiry.
4. A reviewed exact hostname in `STREAM_ALLOWED_HOSTS` for direct media or `STREAM_EMBED_HOSTS` for publisher frames. No wildcard, credentials, arbitrary IP or redirecting proxy.
5. A successful browser playback check on the saved disabled source, then explicit enablement. Check actual target devices/territories; one browser success does not guarantee every viewer's access.

Direct sources currently require worldwide permission because BackInIt does not implement its own regional entitlement enforcement. Provider-permitted embeds may delegate regional enforcement to the publisher. Native DRM license-server integration is not implemented; protected content needs an authorized provider integration, never key extraction or circumvention.

A rights-holder-provided source is the remaining prerequisite for tonight's real in-page viewing. The permitted test signals prove the transport/player pipeline, not ownership or availability of any football broadcast.
