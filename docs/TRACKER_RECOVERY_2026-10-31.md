# Tracker transport and recovery

Public production checks found matched animation metadata for five of six live tennis matches, while the browser could not connect to SportScore's outer embed document. A broken iframe navigation could fire load and be incorrectly revealed as ready. Layout-only tests did not catch this.

BackInIt now relays the original matched public embed document through its backend. This retains the publisher's nested widget and attribution. It does not copy a third-party client ID into a new direct widget integration or invent ball positions. Only schema-approved SportScore embed URLs from current, exact match resolution may be fetched; redirects, non-HTML responses and documents lacking the publisher widget are rejected.

The frontend route serves this third-party document in an opaque sandbox, without access to BackInIt's cookies or DOM. Its bridge reports nested-frame loading, size and errors to the exact parent frame. A bare browser load event is never readiness. Frame-load reporting still is not proof of upstream event-data freshness: production visual checks must confirm real match content separately.

Errors keep real score summaries visible. Reconnection is bounded to two attempts with backoff. Discovery refreshes every 30 seconds to renew the short metadata lease before expiry. An unsupported or unmatched game still cannot be presented as having animation. No universal coverage or video stream is implied.

Regression tests cover failed iframe documents, recovery, bounded reloads, preservation across lease refresh, arbitrary-destination rejection, sandboxing, attribution and slow navigation. Live rendering must be verified after release; mocks alone are insufficient.
