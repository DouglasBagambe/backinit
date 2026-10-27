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

Next BFF mutation routes enforce Origin and fixed upstream destinations. Cookies are HttpOnly, SameSite=Lax, Secure over HTTPS. Source writes require server-side admin authorization and optimistic versions in transactions. Audit is append-only through application endpoints, not tamper-proof against database operators. Production still needs recovery/verification, stronger abuse controls, retention/deletion policy, monitored backups and reviewed password-hash resource parameters.

SQLite, cache and limiter are single-instance choices. Moving to multiple API replicas requires shared durable storage, centralized provider budgets and distributed limiting. PostgreSQL/Prisma and optional Redis remain migration options, not pretend infrastructure.

## Playback

The typed registry distinguishes HLS, DASH and permitted embeds. Records include rights owner/evidence, event mapping, WORLD territory, validity, version and revocation. Only reviewed HTTPS hosts are accepted; no arbitrary fetch proxy or redirect-following health check exists. Sports entries require an event ID. WORLD is the only supported territory: regional entitlement/geolocation is not implemented, so region-restricted sources must not be admitted.

HLS uses native Safari support or HLS.js; DASH.js loads on demand. Engines clean up on source changes, retries and unmount. Health checks recur each minute; revoked sources stop and validity is checked during viewing. Embeds require explicit consent and retain provider controls. Fullscreen/PiP use browser-native controls where supported. Test films are separate from sports sources. No DRM extraction, protected-feed discovery or rebroadcasting is implemented.

## Design and launch

The approved layout, rail, bottom navigation, editorial typography and light palette are preserved. DM Sans and Manrope are bundled locally through Fontsource, so rendering does not depend on Google Fonts requests at runtime. Dark surfaces are navy/charcoal with restrained steel accents. Light/Dark/System lives only in the footer and follows system changes when selected. Layout tests cover seven widths and both themes; motion respects reduced-motion preferences.

Metadata and semantic rendering remain, but public indexing is intentionally disabled until approved launch. TLS, strict CSP, operational monitoring, licensing and production security review are outstanding. No merge or public deployment without founder approval.
