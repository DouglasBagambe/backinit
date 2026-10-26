# Architecture

## First vertical slice

Browser → Next.js App Router server → NestJS read API → SportsProvider → validated discriminated event model. If the API fails or returns invalid data, Next returns local demo fixtures with an explicit footer/source label. It never silently substitutes demo results for a real provider; this application has only a demo provider.

- `apps/web`: custom responsive interface, semantic CSS design tokens, persistent guest state, Match Centre, isolated HLS player.
- `apps/api`: NestJS HTTP API, Zod validation, rate limiting, Helmet and explicit CORS.
- `packages/domain`: shared contract, deterministic fixtures, event filtering and provider interface.
- `tests`: domain invariants, browser flows, responsive and accessibility checks.

Node 22, pnpm workspaces, Turbo, strict TypeScript, current Next/React, NestJS, Zod, HLS.js, Vitest and Playwright form the initial stack. Versions are locked; update through reviewed PRs and security checks. Next and Nest are ESM-compatible in this repository.

## Decisions

1. **Vertical slice before infrastructure.** PostgreSQL/Prisma and optional Redis are deliberately deferred until accounts, ingestion and admin introduce durable writes. No empty database abstraction is presented as complete. Local development needs no cloud account.
2. **Custom semantic CSS instead of Tailwind/shadcn in this slice.** A small cohesive token system plus native controls is sufficient for these screens. This is a documented variation of the recommended baseline, not a framework limitation. Headless primitives can be introduced for dialogs and complex menus later.
3. **Server-rendered initial feeds.** TanStack Query becomes useful for subscription-backed refresh and invalidation; it is not needed to repeatedly fetch deterministic fixtures. Dynamic-import the player so HLS does not burden the discovery bundle.
4. **Events are not all matches.** `score`, `card`, and `race` are separate schema variants. Wrestling bouts hold performers/stipulations. The initial score variant represents only a summary; cricket innings/wickets, tennis sets/tiebreaks, baseball innings, basketball periods, combat rounds and race classification must each get separate detail schemas before real integration. Do not add football-only fields to the base model.
5. **Provenance is mandatory.** Demo provenance is validated, displayed globally and repeated at ambiguous boundaries such as live badges, replay and player. Source timestamps and capabilities belong in real provider envelopes, with explicit stale data states.
6. **No invented tracking.** The pitch is a symbolic background to discrete event replay. It has no ball coordinate or attack-direction simulation. A positional provider may supply measured coordinates later. Momentum must have a documented derivation; it is not random decorative bars.
7. **Fail closed for privileged features.** Admin has no mutations or sensitive information. Do not add a client-side password or cosmetic role toggle. Implement authenticated server-side RBAC, CSRF protection and append-only audit records before enabling it.

## Data and ingestion target

Provider adapter → schema validation/normalization → idempotent ingestion job → PostgreSQL snapshot/event log → cache → public read API → SSE notifications → browser query invalidation. Maintain provider ID mappings, capability flags, provenance, observed time and ingest time separately. Use event-version IDs for deduplication and out-of-order reconciliation. Cache keys must include provider, resource, sport and parameters. Expired data must be labeled stale, not silently promoted to live. Rate budgets belong to centralized ingestion, never one provider request per visitor.

Planned durable entities: User, Session, Role, Favorite (typed target), Sport, Competition, Participant (team/individual), Event, EventParticipant, EventRevision, SportDetail, NewsItem, StreamSource, StreamEntitlement and AuditEntry. Unique provider IDs and transaction boundaries precede ingestion rollout. Redis is optional for a single-node local installation; cross-instance SSE and limiter storage require a shared transport.

## Playback architecture

HLS.js handles authorized HLS in Media Source browsers; Safari uses native HLS. Source URLs are fixed in code in this slice; there is no user-controlled fetch proxy. Quality selection is exposed only when levels exist. Browser-native video supplies fullscreen and PiP where supported. Fatal network/media errors surface a retry state, with cleanup on unmount/retry.

Next: typed registry discriminating HLS, DASH and permitted embed. Each entry includes rights owner, territory, valid time window, host allowlist, entitlement policy and revocation state. HLS/DASH are first-party _player UI_, not ownership of content. Licensed DRM requires provider-supported EME/license delivery; no circumvention. Provider iframes keep control, UI and telemetry with that provider and may prohibit embedding. Embeds cannot guarantee first-party quality controls or PiP. Do not proxy arbitrary URLs, extract protected streams, or rebroadcast media.

## Design system

Forest green is the action/live accent; slate and paper surfaces support dense content. Dark mode uses semantic equivalents rather than inversion. Manrope headings and DM Sans body provide editorial hierarchy, with system fallbacks. Source monogram shields avoid unlicensed assets. Desktop uses a restrained navigation rail; mobile has independent bottom navigation and touch-sized actions. Sports and match tabs deliberately scroll within their own containers, without page overflow. Motion respects reduced-motion preference.

## Security and production gate

No credentials committed. API validates input and provider responses; public routes are read-only. Header controls include nosniff, referrer policy, frame restrictions and permissions policy. A strict nonce-based CSP, production TLS, authenticated write endpoints, distributed rate limiting, audit retention, backup/restore, privacy policy, error reporting, source license review and operational alerts are still required. Public SEO is intentionally disabled for the demo. Hosting or merging requires founder approval.
