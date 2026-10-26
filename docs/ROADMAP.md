# Implementation plan

## 1. Foundation — first PR

Repository/workspaces, architecture decisions, design tokens, navigation and responsive shell, complete themes, useful homepage, domain contracts, CI and test harness. Deliver a local-first build with no mandatory accounts. Acceptance: build/typecheck pass; home and Match Centre fit all seven required widths; visible controls have real behavior.

## 2. Sports experience — initial slice plus expansion

Delivered: sample multi-sport fixtures, sport filters, search, football score/timeline/statistics/event replay, separate wrestling card and race schedule.

Next: split sport-specific detail contracts for periods/sets/innings/rounds; fixture date API and timezone preferences; verified team/player/competition profiles, standings, H2H and lineups. Add momentum only with a defensible model and available data. Acceptance: each sport displays correct scoring semantics, absent data is explicit, fixtures persist and reconcile correctly.

## 3. Viewing — next implementation milestone

Delivered: isolated HLS test player with native controls, adaptive quality when available, loading/error/retry states and clear source attribution.

Next: source registry, HLS/DASH/embed adapters, capability-based controls, source failover, entitled source selection, expiring rights and territory checks, health probes and secure source administration. Add wide-screen video/tracker composition and mobile picture-in-picture QA. Acceptance: a permitted test source plays inside BackInIt; failures/revocations have deterministic states; no fake sports broadcast claim; iOS Safari and Android validation.

## 4. Real integrations

Select providers only after coverage, commercial display rights, attribution, freshness and rate budgets are validated. Add contract-tested fixtures-only football adapter first; server-side cache and circuit breaker; news metadata ingestion with attribution/canonical URL deduplication and timestamps. Integrate explicit SSE event revisions/reconnect/backfill. Evaluate wrestling data editorial workflow and separate motorsport adapter. Acceptance: actual provider credentials authorized, contract tests pass, unknown/stale/missing values remain truthful, quota monitoring and ingestion diagnostics work.

## 5. Personalization and operations

PostgreSQL/Prisma migrations, authentication/session lifecycle, optional registration, cross-device favorites for teams/athletes/sports/competitions/events, watchlist and granular notification preferences. RBAC-protected admin for editorial/stream/provider operations with audit logs and server-side validation. Acceptance: unauthorized users cannot read privileged data or mutate; sessions revoke; backups restore; preference operations are accessible and tested.

## 6. Verification and launch readiness

Expand unit/integration/E2E matrix to real adapter contracts, auth boundaries, stream failure/failover, SSE reconnection, race conditions and persistence. Audit keyboard/screen-reader flows, Safari/Firefox/Android/iOS, all seven viewport widths, reduced motion, offline behavior, contrast, Core Web Vitals and performance budgets. Run dependency/security scans and load tests. Write operational runbooks, source rights ledger and privacy notices. Founder approves infrastructure cost, public exposure and merge separately.

## Dependencies / blockers

- No licensed live data provider or authorized sports broadcast sources configured.
- Free data tiers cannot sustain globally competitive polling without ingestion budgets and coverage compromises.
- Account-based features require an authentication choice and durable database.
- Repository visibility was reported public despite the original private description; no deployment is implied by source publication.
- All dates and scores in the initial slice are fixed demo values.
