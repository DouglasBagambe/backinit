# Navigation performance investigation

Baseline production measurement: `/fixtures` took 12.319 seconds to first byte and 12.862 seconds to complete on 31 October 2026. Every page called the entire sports catalogue, including News, privacy and account pages. Normal score refreshes also rerendered the whole route every thirty seconds.

Changes:

- News and utility/account pages do not request unused sports data. Public news responses are cached separately.
- The backend coalesces concurrent catalogue requests, reuses recent snapshots and refreshes them in the background. Callers receive independent copies. Live source timestamps older than one minute become explicit stale/unknown snapshots; saved scores are retained.
- Public live feed and match reads bypass the persistent frontend cache; the backend already coalesces and caches scoreboards. This avoids an older web-cache snapshot suppressing current match updates. Catalogue-dependent page rendering has a 1.5-second budget; Watch owns its separate lightweight discovery feed. Missing initial data is fetched in the background, with skeletons while it loads. Healthy client data survives navigation instead of being replaced by an empty render.
- Score and match updates fetch data rather than rerendering the entire route. A match already present in the catalogue renders without waiting for another summary request; detailed stats refresh separately.
- A viewed football match queries one day rather than eight future schedule days. Full fixture pages still retain the future schedule.
- Related broadcasts use their own Watch response, so a fast match open does not lose the sidebar while the optional catalogue is cold.
- Stream discovery cannot overlap or wait indefinitely. Native playback has a 15-second loading deadline; a withdrawn source does not automatically cycle into another source already known to have failed. Manual Retry remains available.

Tests cover catalogue request coalescing, background refresh, copy isolation, stale live status, unused data avoidance, known-match rendering without a second summary request, single-day football lookup, and existing browser playback/revocation flows. Production response measurements and browser verification are required after deployment; the baseline is not an after-result.

Infrastructure limit: [Render Free](https://render.com/docs/free#spinning-down-on-idle) sleeps after fifteen idle minutes and documents roughly one minute to wake. Caching and bounded rendering avoid holding every public page behind that wake-up, but do not turn the free backend into an always-on service. No paid compute change was made.

Follow-up from public verification: utility page responses fell from roughly 1.26 MB to 22–23 KB. However the complete catalogue still made individual game documents roughly 1.27 MB, and rendering 772 fixture rows made Scores/Fixtures roughly 2.75 MB. Individual games now serialize only their own event; Watch skips the unused server catalogue entirely and owns discovery in the browser. Fixture lists render sixty events initially with an explicit Show more control; search and date filters still operate over the complete event list before batching. A browser test verifies expansion to 120 events and finding an event outside the initial batch.
