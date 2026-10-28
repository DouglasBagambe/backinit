# Implementation status and next work

## Delivered foundation and functional milestone

- Approved shell/navigation preserved; navy/charcoal dark theme; footer-only Light/Dark/System preferences.
- Real default feed with OpenLigaDB Bundesliga and Jolpica F1; validated contracts, cache/deduplication, rate cooldowns, bounded stale fallback and coverage reporting. Demo remains explicitly separate.
- Football goals/timeline/replay/table, F1 classification, fixture date browsing, search and derived directories. Missing lineups, advanced stats and coordinates remain explicit.
- HLS/DASH test playback, permitted embed adapter, audited/versioned source registry, availability checks, revocation/expiry and server-authorized administration.
- Persistent SQLite accounts/sessions, typed favorites, follows, personalized home, guest preferences and calendar export.
- Permission-gated news adapter and source-linked headline UI. No news license or sports streams configured.
- Strict TypeScript, production builds, automated provider/auth/source/browser tests and CI evidence capture.

## Next priorities

1. Broaden legitimate free coverage with authorized provider keys and concrete sport-specific contracts. Centralize ingestion budgets before live polling; add persistent event revisions and historical snapshots. Evaluate historical OpenF1 data separately from paid realtime.
2. Obtain a usable live event/lineup/statistics provider before implementing live timelines, SSE revisions, momentum or positional animation. Do not animate invented coordinates.
3. Obtain documented sports source permissions. Add territory/entitlement policies before regional sources, provider-supported DRM only where authorized, and Safari/iOS/Android playback verification.
4. Complete account verification/recovery/deletion, abuse controls and privacy notices. Add opt-in notifications only with a real delivery mechanism and permission management.
5. Enable licensed news, richer athlete/team profiles, localized times and competition history. Current directories derive only from loaded events.
6. Production readiness: shared cache/limiter for scale, reviewed database migration path, monitored backup/restore, strict CSP/TLS, error reporting, performance/load testing, broader accessibility/device review and launch SEO.

## External decisions and blockers

No paid provisioning, deployment or merge is authorized. Broader free APIs often need registration and credentials. Real-time/global coverage and sports broadcasts are not guaranteed by free tiers. BBC ingestion needs applicable permission. Source rights and public launch must be reviewed; the platform is not complete while these capabilities are absent.

## Subsequent milestone — 28 October 2026

Delivered: Watch-first home/navigation, searchable official-video catalogue (nine publishers/seven sports), provider-controlled consent-gated embeds with failure handling, real imagery/crests, brighter dark text, removal of promotional filler, recovery codes/password changes/all-session revocation, privacy export/deletion, opt-in persisted in-app updates, administrator session expiry, persistent account attempt limits and a verified online backup tool. Browser tests now use separate ports so the founder preview remains available.

The earlier “next priorities” list is historical: code recovery, active-account deletion and in-app notification delivery are now implemented. Email verification/reset delivery, background push and published operator/retention details remain open. Global structured scores/lineups/coordinates, licensed syndicated articles, regional direct-stream entitlement and premium sports rights are still absent. Official replays/highlights do not resolve those gaps. See DATABASE.md for supported single-instance operation and the PostgreSQL migration plan; no production database service is provisioned.

## Product direction correction — 28 October 2026

Delivered the event-first Watch flow, EFL fixture ingestion, verified other-sport schedule snapshots, dedicated event viewing and simultaneous-event switching, exact fixture/source association, source preflight/decoded playback gating, generic permitted frames, live-window seeking and explicit native fullscreen/PiP controls. Archive videos and testing signals no longer lead Watch.

**Tonight’s actual in-page cup viewing is still blocked:** no authorized source or embedding agreement was found/configured. Complete status, official evidence and onboarding requirements are in LIVE_VIEWING_2026-10-28.md. Broader multi-sport live data, lineups/statistics and regional direct-stream entitlement remain separate open work. No paid services, merge or public deployment.
