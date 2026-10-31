# Tracker transport and recovery

## Production verification correction

The separate-origin relay loaded the nested widget but its live provider returned "This domain is unauthorized". A successful nested frame load is not proof of usable animation. Production metadata now selects the original publisher embed instead of the relay, retaining the authorized publisher origin. The original Hugo Gaston–Vit Kopriva embed was visually verified with live point scores and a Double Fault event. Its load event only reveals the publisher document, and cannot certify cross-origin data readiness or detect every browser-generated error. Match summary and manual reload remain available. The relay transport described below is retained only for compatibility; it is not selected by current production metadata.

Live fixture discovery now applies the documented `status=live` filter before the 200-result cap. The unfiltered football list omitted Chelsea–Manchester United, while the live-only list included exact teams and 12:30 UTC kickoff.

Public production checks found matched animation metadata for five of six live tennis matches, while the browser could not connect to SportScore's outer embed document. A broken iframe navigation could fire load and be incorrectly revealed as ready. Layout-only tests did not catch this.

BackInIt now relays the original matched public embed document through its backend. This retains the publisher's nested widget and attribution. It does not copy a third-party client ID into a new direct widget integration or invent ball positions. Only schema-approved SportScore embed URLs from current, exact match resolution may be fetched; redirects, non-HTML responses and documents lacking the publisher widget are rejected.

Production serves the document from the separate backend origin in a credentialless frame. Its restrictive document policy blocks connections, forms, workers and popups in the outer document, and permits only the publisher widget as a child. Same-origin permission is needed by the nested widget for its own data requests; it does not give access to the BackInIt frontend. The opaque frontend relay remains a fallback. The bridge watches only the real publisher widget, excluding hidden analytics/challenge frames, and reports loading, size and errors to the exact parent frame. A bare browser load event is never readiness. Frame-load reporting still is not proof of upstream event-data freshness: production visual checks must confirm real match content separately.

Errors keep real score summaries visible. Reconnection is bounded to two attempts with backoff. Discovery refreshes every 30 seconds to renew the short metadata lease before expiry. An unsupported or unmatched game still cannot be presented as having animation. No universal coverage or video stream is implied.

Regression tests cover failed iframe documents, recovery, bounded reloads, preservation across lease refresh, arbitrary-destination rejection, sandboxing, attribution and slow navigation. Live rendering must be verified after release; mocks alone are insufficient.

Single-match refreshes now query their own league directly and skip unsupported tennis summaries. Match pages fetch detail and catalogue concurrently, with a five-second limit on the nonessential catalogue, preventing unrelated ingestion from turning a valid match into a timeout/404.
