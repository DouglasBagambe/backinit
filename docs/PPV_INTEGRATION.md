# Public broadcast catalogue and multiview

BackInIt's Watch → Broadcasts directory reads `/api/broadcasts` → API `/broadcasts` → PPV's documented public `https://api.ppv.st/api/streams` feed. Every valid entry from every returned category is imported with its stable ID, schedule, source choices, poster and provider viewer count. No sport allowlist or manual upcoming-game list is required.

The running API warms the catalogue on startup and refreshes at approximately 60-second intervals. Requests share one pending refresh and return the previous snapshot during outages; a cold start has a six-second upstream deadline. Failed attempts back off for one minute. The web proxy caches for 60 seconds, and open directories refresh once a minute. Catalogue changes can therefore take a few minutes to reach an already open browser. The free hosting service can sleep, so background updates resume when it wakes. Snapshots are in memory, not durable storage.

`/broadcasts` provides category, status and text filters. `/watch/ppv-ID` opens the original supplied embed only on Play, supports alternate sources, theatre/fullscreen, retry, stop and sharing. `/multiview` supports two, three or four independently removable players with equal/focus layouts and shareable/restorable URL selections. Each third-party player retains its own audio controls: no undocumented remote mute API is assumed.

Embeds retain their original ads and behavior, with no sandbox or hidden media URL extraction. Only known HTTPS provider embed origins are accepted; arbitrary provider HTML is never executed. A new embed hostname needs review before being added. BackInIt's subtle mark sits in a separate rim outside the embedded document. PPV viewer figures are explicitly attributed and are not BackInIt presence counts. A loaded frame and a scheduled Live badge are not proof of decoded video playback; regional restrictions and provider outages remain possible.

The documented live feed does not include an archive API. Four publicly listed sports archive entries link to the provider's full replay pages, separately from official publisher highlights. Those archive links are curated, not automatically synchronized. Official channel ingestion now selects up to eight recent matching videos per channel, retaining existing publisher/embed checks.

Native chat, stream-request moderation and BackInIt viewer presence are not part of this catalogue release. Existing fixture trackers remain independent of the broadcast directory.

## Verification

Unit tests cover malformed entries and embed origins, upcoming/live/ended state transitions, all category preservation, coalesced refreshes, stale recovery and initial-outage backoff. Browser tests cover source switching without sandboxing, click-to-load, independent tile removal, focus layout, shared URL restoration, keyboard-accessible chooser, mobile overflow, accessibility and outage recovery. External provider playback is a separate check from these deterministic tests.
