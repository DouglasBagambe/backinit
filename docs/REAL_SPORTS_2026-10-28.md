# Real data and live playback — 28 October 2026

This is a verified local milestone, **not platform completion**. The approved design is preserved. No public deployment, merge or paid provisioning was performed.

## Actual broadcasts inside BackInIt

Three distinct HYLO Open badminton court sessions from **BWF TV's official channel** were marked live by the publisher and actually decoded inside BackInIt at `http://127.0.0.1:3000`. These are live court sessions, not highlights, test signals or three alternative feeds of the same match.

| Event   | Publisher-controlled embed                                        | Playback observed (UTC) | Decoded video                         | Local event page         |
| ------- | ----------------------------------------------------------------- | ----------------------- | ------------------------------------- | ------------------------ |
| Court 1 | [epxkdYuTSqU](https://www.youtube-nocookie.com/embed/epxkdYuTSqU) | 10:48:08                | 1280×720; 10122.89 → 10126.90 seconds | `/watch/bwf-epxkdyutsqu` |
| Court 2 | [RuP1j8VdMzA](https://www.youtube-nocookie.com/embed/RuP1j8VdMzA) | 10:49:47                | 854×480; 10166.33 → 10170.35 seconds  | `/watch/bwf-rup1j8vdmza` |
| Court 3 | [VjHaBVMydKQ](https://www.youtube-nocookie.com/embed/VjHaBVMydKQ) | 10:50:12                | 1280×720; 10143.47 → 10147.48 seconds | `/watch/bwf-vjhabvmydkq` |

All three were saved disabled, previewed through the existing admin player, recorded with advancing SDK playback evidence, and enabled in the **local SQLite source registry**. That database is not committed. Browser evidence separately confirms decoded dimensions and advancing media time; SDK reports correctly use `provider-player`, not `native-decoded`.

The standard YouTube embed retains publisher controls and restrictions. No underlying protected media URL was extracted. The founder stated authorization; the official channel link identifies the publisher and does **not** constitute an independently verified worldwide distribution grant. Playback succeeded from this machine, not every region or browser. Official BWF streaming information also describes territorial restrictions: [Swiss Open](https://www.swissopen.com/en/aktuell/live-streaming/), [Canada Open](https://yonexcanadaopen.ca/watch-live/).

Discovery is automated from the official [BWF TV streams page](https://www.youtube.com/channel/UChh-akEbUM8_6ghGVnJd6cQ/streams). Public page metadata must identify that exact channel. A publisher live flag creates an event listing, **not an automatically published playable source**. Each new source still needs the admin playback check. Finished/cancelled events no longer expose sources labelled live. Event/source expiry, revocation, URL fingerprint checks and approved hosts remain enforced.

## Real sports data

Production ingestion no longer concatenates manually maintained other-sport snapshots. The explicit provider-disabled test installation retains clearly labelled official snapshots for deterministic CI.

- ESPN scoreboards: English League Cup, Premier League, La Liga, Champions League, NBA, WNBA, NFL, MLB, NHL, UFC, ATP, WTA and two rugby competitions (Premiership and Top 14).
- Existing OpenLigaDB Bundesliga fixtures/results/goals and Jolpica F1 schedule/classification remain connected.
- WWE: automatically parsed official event listing, with publisher event URLs, dates and venues. **Schedule only; no live wrestling results are claimed.** The location-independent official listing URL is used because `/events` redirects by visitor location.
- BWF: official live court-session listings/status; individual match scores and order of play are not provided by this adapter.
- Cricket and boxing: **no reliable free live feed connected**. Failed/time-out/empty ESPN candidates and ICC's client-loaded schedule were not replaced with invented or manually seeded current fixtures.

The recorded data audit includes 11 sports. A later API audit at 13:21 UTC recorded 10 provider-reported live events across badminton and tennis; see `docs/evidence/provider-audit-2026-10-28.json`. The 10:51 UTC audit found **four provider-reported live event records**: three BWF court sessions and one tennis match. Live counts fluctuate; this is a timestamped observation, not a claim that every record in the season feeds is live. See `docs/evidence/live-2026-10-28.json` and the current local `artifacts/real-sports-audit.json`.

Scoreboards cache for 30 seconds with in-flight deduplication, timeouts, bounded storage and provider cooldown on 429/5xx. Requests to a failed provider do not erase other sports. Stale in-progress snapshots become `unknown`, not falsely live. WWE schedules cache for 15 minutes; F1 remains schedule/results data, not live timing. Existing browser feeds now refresh every 30 seconds when visible; SSE remains explicitly a heartbeat, not a fabricated live event stream.

Names, IDs and available artwork come from provider participants. Tennis uses individual competitions nested inside tournaments, including doubles roster names; games per set are displayed separately rather than mislabelled as overall match totals. Postponed/cancelled/delayed/unknown states are retained. UFC uses the card's announced start rather than substituting the first prelim time.

Match Centre statistics, rosters and play-by-play are fetched on demand where the summary endpoint provides them. Real-network examples: Boston–Brooklyn supplied shooting statistics, 27 roster entries and 576 plays; Bradford–Peterborough supplied statistics and 40 roster entries. Tennis set games changed from Navone/Tabilo 1–3 Frantzén/Haase to 3–5 between recorded reads. No synthetic positions, momentum or ball tracking were added.

ESPN's public endpoints are **undocumented** and do not provide an established SLA or commercial reuse agreement. There is no API key or paid service. Coverage may change or fail. No worldwide/comprehensive sports-data license is implied.

## Tonight's football

All five fixtures were independently confirmed through official EFL/club sources in the preceding milestone and returned automatically by the League Cup scoreboard. Existing cup event URLs and viewing information survive scoreboard enrichment when **both participants and kickoff match**.

| Fixture                  | Africa/Kampala | In-page broadcast verified |
| ------------------------ | -------------- | -------------------------- |
| Manchester City–Brighton | 22:30          | No                         |
| Bournemouth–Aston Villa  | 22:45          | No                         |
| Fulham–Crystal Palace    | 22:45          | No                         |
| Sunderland–Brentford     | 22:45          | No                         |
| Liverpool–Chelsea        | 23:00          | **No**                     |

Official evidence: [EFL round-four appointments](https://www.efl.com/news/2026/october/20/carabao-cup-round-four-referee-appointments/), [Chelsea kickoff/broadcasters](https://www.chelseafc.com/en/news/article/date-and-kick-off-time-for-liverpool-carabao-cup-tie-confirmed), [EFL broadcast partners](https://www.efl.com/how-to-watch/broadcast-partners/).

**Liverpool–Chelsea cannot currently be watched inside BackInIt. Football live playback has not been achieved.** UK ITV/Sky coverage is not proof of an embeddable feed in Uganda. The founder's authorization is acknowledged; a compatible actual source still needs to be located and tested. Existing broadcaster information remains supplementary, not a replacement presented as in-page playback.

## Requested source investigation

| Input                            | What was established                                                                                     | Integration outcome                                                                                                     |
| -------------------------------- | -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| FMHY / r/Piracy sports directory | Discovery links, not video endpoints                                                                     | No live fixture-bound source verified                                                                                   |
| GitHub iptv-org                  | Channel/EPG/stream resource documentation; channel identities are not event IDs                          | No listed source was playback-verified and attached to a real fixture in this milestone                                 |
| GuideTV                          | Public page with an initially blank player frame; handoff's sampled listings were stale/simulated sports | No current genuine sporting broadcast verified                                                                          |
| Baked.live                       | Public Cytube-style channel page and replay/channel listings                                             | No documented clean player endpoint or actual live fixture-bound playback verified; no private/protected feed extracted |
| Official BWF YouTube             | Exact publisher identity, current live metadata and standard embedded player                             | Three actual live court broadcasts verified locally                                                                     |

Public technical accessibility, publisher identity, the operator's authorization assertion and successful playback are separate facts. No DRM, account or geographic restriction was bypassed.

## Reproduce and operate

Run the app from the repository root:

```sh
cd /home/db/WORK/backinit/project
pnpm dev
```

Open `http://127.0.0.1:3000/watch`. The API runs on port 4000. Do not start a second copy while these ports are already occupied.

Run a fresh real-provider audit and generate **disabled** source candidates:

```sh
pnpm exec tsx scripts/probe-real-sports.mts
```

It writes `artifacts/real-sports-audit.json`. It does not prove video playback or publish sources. Configure candidates in the existing admin source interface, verify the saved version in the actual browser, then enable it. Rights, validity and territory fields must reflect the intended use. Checks expire after 24 hours at most; these particular local sources also have a four-hour validity window. Session links will eventually finish; do not treat this report's observations as perpetual availability.

Screenshots and detailed local playback evidence are in `artifacts/live-bwf-court-*.png`, `artifacts/public-live-bwf-*.png` and `artifacts/public-live-bwf.json`. Browser test fixtures and test media are never counted as real sports broadcasts.

## Remaining limitations

- Zero verified football feeds, including tonight's five fixtures; no verified NBA/UFC/WWE/F1/cricket broadcasts in this milestone.
- No genuine second broadcaster for the same current event was found. Existing multi-source switching/retry/revocation is covered by controlled tests, not evidence of two working live feeds of one match.
- Cricket/boxing live-data integration, WWE results, F1 live timing, precise tracking coordinates and comprehensive competition coverage remain missing.
- YouTube page metadata and ESPN endpoints can change; adapters fail explicitly rather than inventing coverage.
- Source configurations/checks live in the operator database and require ongoing renewal. No unattended entitlement verification or globally certified broadcast availability exists.
- Safari/iOS and worldwide network/territory certification remain unverified.

## Validation

- Strict TypeScript and production builds pass.
- 54 unit/integration tests pass, including provider refresh/failure handling, nested tennis, UFC card timing, WWE parsing, publisher identity, historical match lookup, SDK evidence and ended-event source withdrawal.
- Full Chromium regression: 35 passed, one optional external test skipped. All nine focused live-viewing/admin/recovery tests passed again after the final source-lookup changes.
- The skipped optional test is HLS/DASH test media, not any of the real badminton checks above.
- Real browser checks found and fixed SDK calls made before player readiness and a two-second registry timeout. Registry lookup now reuses fresh fixture metadata without fetching statistics; observed warm responses were 16–71 ms. Cold fetches have a bounded longer deadline.
- Provider/network startup failures still occur; successful earlier playback is not an availability guarantee. Desktop/mobile screenshots and decoded samples document the exact observations, including unsuccessful attempts.
