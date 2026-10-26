# Research — checked 26 October 2026

Primary-source documentation informed the foundation. Pricing and licenses must be rechecked at selection time. A free API key is not a sports broadcast license. No subscription or hosted resource was provisioned.

## Sports data

| Candidate                                                                                                                               | Evidence / limits                                                                                                                        | Decision                                                                                                                                                                                            |
| --------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [football-data.org pricing](https://www.football-data.org/pricing), [policies](https://docs.football-data.org/general/v4/policies.html) | Free coverage is limited; registered free clients 10 requests/minute. Live scores and detailed statistics are paid-plan/add-on concerns. | Good initial fixtures/standings candidate. Do not promise free live detail, xG or positions. Check display rights and attribution before enabling.                                                  |
| [API-Sports](https://api-sports.io/)                                                                                                    | Free plan advertises 100 requests/day per API; broad separate sport APIs.                                                                | Too small for per-user live polling; requires centralized cache/ingestion and selected coverage. Contract, endpoint availability and commercial restrictions still need account-level confirmation. |
| [TheSportsDB documentation](https://api.thesportsdb.com/documentation), [terms](https://api.thesportsdb.com/docs_terms_of_use.php)      | Community sports metadata with separate access/usage terms; completeness and artwork rights vary.                                        | Evaluate for metadata/wrestling discovery, not authoritative live play-by-play. No assumption of blanket commercial artwork rights.                                                                 |
| [OpenF1](https://openf1.org/docs/), [authentication](https://openf1.org/auth.html)                                                      | Historical data from 2023 is freely accessible; live/authenticated access is distinct.                                                   | Candidate for historical motorsport views. Real-time service and redistribution terms require separate review.                                                                                      |

No verified zero-cost provider was established for global WWE cards/results, advanced live positions, every major sport and commercial news redistribution. Keep adapters independent. Missing coverage must produce availability states, not scraped or fabricated live content. For news, use licensed feeds/metadata with source link, canonical URL, attribution and publication time; do not republish full articles without permission. Dedicated news-provider evaluation remains in milestone 4.

## Tracker and playback

[Sofascore's explanation of Attack Momentum](https://www.sofascore.com/news/how-sofascores-attack-momentum-changed-sport-analysis) treats momentum as an interpretation of match flow. This is distinct from measured ball positions. The initial BackInIt tracker intentionally replays discrete demo events without synthesizing location or proprietary momentum values.

[HLS.js demo](https://hlsjs.video-dev.org/demo/) and [Shaka Player demo](https://shaka-project.github.io/shaka-player/demo/) demonstrate adaptive streaming in browser players. HLS.js is sufficient for the first HLS slice; Shaka is a candidate for DASH/EME later. Direct playback requires a permitted manifest, browser-compatible codecs, CORS on manifests/segments/keys, valid source entitlements and any required authorized license exchange. Iframes depend on provider permission, frame restrictions, cookies and provider UI. An embedded stream is not owned or controlled by BackInIt.

The initial Sintel CDN probe returned HTTP 403. The selected source is [Big Buck Bunny on the Mux-hosted HLS.js test-stream site](https://test-streams.mux.dev/). [Big Buck Bunny / Blender Foundation](https://peach.blender.org/) is an open movie with CC BY 3.0 attribution. This is a public test endpoint, not an availability SLA or permission to claim sports programming. Do not use it as a production broadcast origin. Test CDN availability remains an external dependency.

## Free-first infrastructure

- [Vercel Hobby](https://vercel.com/docs/plans/hobby): non-commercial personal use restriction. Not an approved free commercial launch target.
- [Render free services](https://render.com/docs/free): idle web services sleep after 15 minutes; free Postgres expires after 30 days. Not a durable production database or low-latency always-on sports service.
- Local Node processes and a future local PostgreSQL installation avoid subscriptions. Hosted PostgreSQL alternatives need current quota, connection, storage, backup and commercial-terms evaluation before selection.
- GitHub Actions is configured, but repository/account quota must be monitored. Do not assume unlimited free private-repository CI.

## Dependencies

Selected versions were resolved against npm at implementation time, then locked. Node 22 satisfies Next's documented [installation requirements](https://nextjs.org/docs/app/getting-started/installation). Review [Next security advisories](https://github.com/vercel/next.js/security/advisories) and `pnpm audit` as part of updates. Registry availability and official website chronology can differ; use installed package versions and audit output as reproducible evidence, never a claim that all future advisories are covered.
