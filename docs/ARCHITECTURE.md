# Architecture

## Implemented flow

Browser → Next App Router/BFF → NestJS → provider adapters → Zod-normalized domain models. Real is the default edition. Provider outages yield explicit unavailable or bounded stale data; real requests never substitute demo scores. The separate demo edition may use a labeled local fallback.

- `apps/web`: preserved responsive shell, semantic CSS tokens, footer theme control, Match Centre, directories, accounts and lazy playback engines.
- `apps/api`: NestJS controllers, provider cache, SQLite accounts/sessions/favorites/source registry/audit, Helmet and throttling.
- `packages/domain`: validated discriminated sport models, provenance/coverage contracts, source contracts and explicit demo fixtures.
- `tests`: provider, account, source, origin and browser behavior checks.

Strict TypeScript, Next/React, NestJS, Zod, HLS.js, lazy DASH.js, Vitest and Playwright remain the stack. Turbo global inputs include shared domain sources so API cache entries cannot survive domain changes unnoticed.

## Provider boundary

OpenLigaDB normalizes Bundesliga schedule/results/goals and current standings. Jolpica normalizes season schedule and the latest race classification. The bounded in-memory cache deduplicates concurrent requests, applies timeouts, rejects redirects, honors provider cooldowns and labels stale snapshots (maximum 24 hours). Cache lifetimes range from five minutes to one hour. No per-visitor direct provider traffic, invented live clocks or synthesized ball coordinates. No-key coverage is deliberately narrow.

BBC RSS parses headlines and links only, rejects DTD/entities, validates links and dates, deduplicates URLs and caches responses. It is disabled unless an operator confirms applicable permission through configuration. It is not a substitute for a news license.

Feed provenance is mandatory. Football goals and race classifications are sport-specific detail fields. Future basketball periods, tennis sets and combat results need dedicated contracts. No generic football-detail placeholders should be presented as real coverage of other sports.

## Persistence and security

SQLite WAL provides real single-installation durability with no paid service. Users, hashed opaque sessions, typed favorites, source records and audit entries are stored server-side. Passwords use salted asynchronous scrypt; session tokens use cryptographic randomness and only SHA-256 token digests are stored. Account roles are server-owned; an explicit local operator script grants/revokes access, revokes sessions and audits changes.

Next BFF mutation routes enforce Origin and fixed upstream destinations. Cookies are HttpOnly, SameSite=Lax, Secure over HTTPS. Source writes require server-side admin authorization and optimistic versions in transactions. Audit is append-only through application endpoints, not tamper-proof against database operators. Recovery uses five random 128-bit, hashed, one-use codes after password reauthentication. Password resets revoke every session. Async scrypt uses N=32768/r=8/p=3 with bounded concurrency and upgrades legacy hashes on login. Persistent hashed-account attempt counters survive restart; admin sessions last 15 minutes. Export and password-confirmed deletion are available. Public launch still needs email verification/delivery, trusted proxy attribution, stronger distributed abuse controls, published retention policy and monitored backups.

SQLite, cache and limiter are single-instance choices. Moving to multiple API replicas requires shared durable storage, centralized provider budgets and distributed limiting. PostgreSQL/Prisma and optional Redis remain migration options, not pretend infrastructure.

## Playback

The typed registry distinguishes HLS, DASH and permitted embeds. Records include rights owner/evidence, event mapping, WORLD or PROVIDER territory, validity, version and revocation. Only reviewed HTTPS hosts are accepted; no arbitrary fetch proxy or redirect-following health check exists. Sports entries require an event ID. Direct HLS/DASH requires WORLD rights. Official embeds use PROVIDER territory and delegate playback restrictions to the official player; regional direct-stream entitlement/geolocation is not implemented.

HLS uses native Safari support or HLS.js; DASH.js loads on demand. Engines clean up on source changes, retries and unmount. Health checks recur each minute; revoked sources stop and validity is checked during viewing. Embeds require explicit consent and retain provider controls. Fullscreen/PiP use browser-native controls where supported. Test films are separate from sports sources. No DRM extraction, protected-feed discovery or rebroadcasting is implemented.

## Official viewing and updates

Nine allowlisted official YouTube channels are queried through public RSS and oEmbed, with channel/author validation and 15-minute caching. Sources expire after 24 hours unless rechecked. Administrative edits/revocations survive refresh. The browser loads the official SDK only after consent; images contact the publisher before playback consent. Metadata is not evidence of decoded playback. The catalogue contains replays/highlights, never inferred live streams.

A one-minute API poll observes real, non-stale provider revisions. Enabled accounts receive deduplicated persisted updates for saved events or followed participants/competitions/sports; the first snapshot establishes a baseline. Notifications retain up to 100 entries per user for 30 days. The account page polls visible updates. No email or background push is claimed.

## Design and launch

The shell, bottom navigation, typography and light palette remain; Watch now leads the homepage and navigation. Official footage/artwork replaces promotional filler, and genuine crests replace invented team monograms. DM Sans and Manrope are bundled locally through Fontsource, so rendering does not depend on Google Fonts requests at runtime. Dark surfaces are navy/charcoal with restrained steel accents. Light/Dark/System lives only in the footer and follows system changes when selected. Layout tests cover seven widths and both themes; motion respects reduced-motion preferences.

Metadata and semantic rendering remain, but public indexing is intentionally disabled until approved launch. TLS, strict CSP, operational monitoring, licensing and production security review are outstanding. No merge or public deployment without founder approval.

## Event-first viewing milestone — 28 October 2026

`/watch` joins normalized fixtures to compatible, active sports sources by exact event ID or exact provider/fixture reference. `/watch/:id` places the player beside event switching and above provider-supported information. The archive catalogue moved to `/videos`; public test signals live on `/playback` and cannot bind to sports events.

EFL imports fixed official schedule HTML without executing scripts; validated stale verified facts provide an explicit fallback. Other verified snapshots expose schedule-only/date-only/conditional details. They are neither an exhaustive feed nor inferred live status. Direct sources use operator-reviewed exact hosts; generic iframe adapters are separately reviewed and sandboxed.

`source_checks` stores authenticated administrator-reported playback evidence, source version, URL/format fingerprint, browser and check time. Native verification requires actual decoded playback; live direct broadcasts require a genuine live window. Metadata/manifest reachability is insufficient. Checks expire after 24 hours; edits invalidate compatibility; revocation/expiry withdraw public availability and trigger player cleanup. Generic frames without a trusted SDK use explicit operator observation, not claimed automatic decoding. Rights evidence remains an operator record separate from technical verification.
