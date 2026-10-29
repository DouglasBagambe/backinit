# Official live broadcasts — 29 October 2026

## Working integration

BackInIt's existing Watch and event viewing pages now use automatically discovered broadcasts from the official BWF TV and FIBA Basketball channels. Channel HTML and RSS discover public video IDs; publisher watch-page metadata independently supplies channel identity, start/end timestamps, live status and the explicit embedding setting. Titles never establish live status. No media manifests, signed URLs, footage or private playback API responses are stored or distributed.

The broadcast's case-sensitive video ID binds the event to its player. This milestone creates publisher event/session records; it does not guess a link to ESPN team fixtures. Court-session scoring, individual order of play and detailed FIBA statistics are not supplied by these video metadata feeds. They remain unavailable rather than fabricated.

Only fresh, publisher-reported live broadcasts with `playabilityStatus.status=OK` and `playableInEmbed=true` receive in-page sources. Sources expire after two minutes without a successful metadata check. Ended, scheduled, stale, unknown, wrong-channel and embedding-disabled records do not become playable live listings. An official external destination remains available separately. Actual browser playback and server metadata checks are distinct; a health endpoint never claims video was decoded.

These sources are derived in memory and require no persistent database. Public data-only hosting can therefore serve `/streams?event=...` and source health without enabling accounts, arbitrary source writes or administration. Those features still require durable storage. Full-mode administrator sources retain their existing verification and authorization requirements.

## Playback evidence

`docs/evidence/official-live-local-2026-10-29.json` records a real, automatically discovered HYLO Open Court 2 broadcast inside the local production frontend:

- 29 October, approximately 19:05 Africa/Kampala.
- Native decoded video at 1280×720; 284 frames after the initial ten-second sample.
- Mobile layout at 390px: no horizontal overflow; decoded playback continued.
- After the normal 60-second source poll, video had advanced another 65 seconds and reached 2,307 decoded frames without a player restart.
- This is local-origin evidence, not proof of playback on the public deployment or in every country.

Run `PROBE_WEB_URL=http://127.0.0.1:3000 node scripts/probe-official-live.mjs` against a running app while a supported publisher is on air. The script uses real provider data, normal consent and Play actions, records playback measurements and saves screenshots under ignored `artifacts/`. It never records footage or stores media URLs. No available live broadcast produces `LIVE PLAYBACK NOT ACHIEVED`, not a demo substitution.

## Boundaries

YouTube controls its player, branding, ads, availability and geographic restrictions. A publisher's embedding choice is not a grant to extract or restream its media. BackInIt does not proxy playback, bypass restrictions or replace blocked media with unofficial feeds. No claim of worldwide access is made.

Public pages are a free but undocumented metadata integration and can change or rate-limit datacenter requests. Requests are bounded, cached, deduplicated and respect provider cooldowns. Missing or stale metadata withdraws availability; no schedule snapshot becomes a live substitute. A documented API integration remains the preferred next step if public metadata proves unreliable in hosting.

Sources: [YouTube embedding](https://support.google.com/youtube/answer/171780), [IFrame Player API](https://developers.google.com/youtube/iframe_api_reference), [BWF TV](https://www.youtube.com/channel/UChh-akEbUM8_6ghGVnJd6cQ/streams), [FIBA Basketball](https://www.youtube.com/channel/UCtInrnU3QbWqFGsdKT1GZtg/streams).

## Public deployment and documented metadata API

PR #5 was merged with the founder's explicit approval. Render deployment `dep-dbhn1hu7bikc73f21620` of main commit `ac948c91020cf19899e7e3ae3aa944e0e5392d7d` became live on 29 October. The public probe at 19:15 Africa/Kampala found **zero eligible live sources** despite the successful local playback. Render discovered scheduled/finished metadata, but did not produce the live metadata needed for admission. The cause is not established; do not claim that it is definitely a geographic block. Evidence: `docs/evidence/official-live-public-2026-10-29.json`.

The follow-up adds `YOUTUBE_API_KEY` on the backend. With it configured, metadata is read from the documented YouTube Data API `videos.list` endpoint in one sorted batch per publisher, cached for a minute. It uses explicit `snippet.channelId`, `snippet.liveBroadcastContent`, `status.embeddable`, `status.privacyStatus` and `liveStreamingDetails` start/end timestamps. No title inference, media extraction or geography bypass is introduced. The key is sent in Google's documented `X-Goog-Api-Key` header, never in public URLs or returned data. Without a key, the existing public-page fallback remains available.

For two continuously polled publishers with stable candidate sets, a minute cache would use approximately 2,880 `videos.list` units per day, below the documented default combined allocation of 10,000 units for ordinary endpoints. Candidate changes, retries and extra replicas can increase usage. No quota extension, billing or paid service was requested.

Setup: create/select a Google Cloud project, enable YouTube Data API v3, create an API key restricted to that API, and put it in Render's backend environment as `YOUTUBE_API_KEY`. Do not use browser HTTP-referrer restrictions for this server key, expose it as `NEXT_PUBLIC_*`, commit it, or send it in chat. Google project/key provisioning remains with the founder. Public live playback must be retested once the key and follow-up release are active.

References: [videos.list](https://developers.google.com/youtube/v3/docs/videos/list), [video resource fields](https://developers.google.com/youtube/v3/docs/videos), [quota and setup](https://developers.google.com/youtube/v3/getting-started), [API-key header](https://cloud.google.com/apis/docs/system-parameters).

## Public playback verified after API-key setup

The founder configured the backend key and redeployed. PR #7 additionally admits the documented `uploaded` state only for an already-started, ongoing public broadcast; rejected/failed/deleted/unknown uploads remain unavailable. Render deployment `dep-dbhnli0473hc73af9djg` of main commit `5689898e171db151a63b739da8360b3f0cfb73a9` became live.

At 19:58 Africa/Kampala, the public-origin probe found three publisher-reported live candidates and **decoded one actual live sports broadcast inside BackInIt**: HYLO Open Court 2, BWF TV, `/watch/bwf-fb0qojgb7k8`. The video advanced from 12 to 313 frames over ten seconds at 1280×720, remained playing at mobile width 390px without horizontal overflow, and advanced to 1,959 frames after the ordinary source refresh. The permitted publisher embed was `https://www.youtube-nocookie.com/embed/FB0qoJGB7K8`.

Evidence: `docs/evidence/official-live-public-after-key-2026-10-29.json`. Screenshots were visually inspected and are retained under ignored `artifacts/official-live-{desktop,mobile}.png`; no footage or media manifests were saved. This establishes playback for that session and test location, not every candidate, region or future session. No Premier League, WWE, Sky Sports or other subscription coverage is implied. The earlier failed public probe remains preserved as historical evidence.
