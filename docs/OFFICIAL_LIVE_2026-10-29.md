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
