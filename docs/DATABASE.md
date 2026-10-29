# Hosted account storage

## Neon rollout — 29 October 2026

The data-only Render API can now use PostgreSQL for accounts while retaining stateless sports and official broadcast discovery. `SPORTS_DATA_ONLY=true` plus `DATABASE_URL` enables account routes; without a URL they continue to return 503. Runtime never silently falls back to an ephemeral SQLite database. `/health` identifies this configuration as `data+accounts`.

A dedicated **BackInIt** project was provisioned on the founder’s personal Neon Free account in Frankfurt. No paid plan was selected. Production and an isolated `accounts-verification` branch both have schema version 1. Existing personal projects were not modified. The restricted production connection is now live on Render. Public signup, persisted sessions/favorites across an actual Render deployment, fresh sign-in, notification inbox, export and synthetic-account deletion passed; see [public evidence](evidence/public-accounts-2026-10-29.json).

The `backinit_app` runtime role has table CRUD and sequence usage only, without schema CREATE, superuser, role-creation or database-creation rights. Its pooled connection belongs in Render’s secret `DATABASE_URL`. Owner credentials stay out of the runtime and repository. SQL queries are parameterized. Neon uses the serverless PostgreSQL pool over secure WebSockets; ordinary PostgreSQL uses certificate-verified TLS, except loopback development. Pool size is four, with bounded connection, statement and query timeouts.

## Schema and release procedure

`apps/api/src/postgres.ts` contains additive, transactional schema migration 1, protected by an advisory transaction lock and version table. Startup only checks the installed version with the restricted role; it does not run DDL. Before later schema changes, branch the database, test the migration and existing-data upgrade there, then apply with an owner-role **direct** connection:

```sh
pnpm --filter @backinit/api build
# Supply DATABASE_URL privately with the owner/direct connection.
node scripts/migrate-accounts.mjs
```

Never put a connection string in a commit, screenshot, log or chat. The migration script rejects pooler hosts. Existing password hashing, hashed sessions, one-use recovery codes and public account API contracts are preserved. Credential changes and session issuance synchronize with user-row locks; favorite caps and recovery-code consumption are transactional. Authentication attempt budgets persist in PostgreSQL across process restarts.

## Verification

`POSTGRES_TEST_URL` runs five integration tests against real PostgreSQL, including connection restart persistence, concurrent signup/recovery/favorite limits, isolation, notification deduplication, export and cascading account removal. The existing CI test command starts and removes an isolated PostgreSQL 17 Docker container, so these tests also run in CI without database credentials or workflow permission changes.

For an isolated hosted QA database with schema already migrated and the restricted role configured:

```sh
# Supply BACKINIT_TEST_DATABASE_URL privately; do not use production.
node scripts/probe-hosted-accounts.mjs
```

This launches an isolated API/frontend pair, signs up through the browser, verifies the HttpOnly cookie and absence of a returned token, saves a favorite, restarts the API process, signs in from another browser context, resets with a recovery code, verifies session revocation/export and deletes only its own synthetic account. Evidence excludes passwords, tokens, recovery codes and database URLs.

## Operations and limits

Sessions, favorites, recovery codes, privacy controls, notification settings and inbox state are durable. Notifications refresh when the signed-in inbox is opened/polled, rather than waking the database continuously for every provider refresh. Only genuinely changed, fresh provider data generates alerts after a baseline observation. No email delivery or browser push is claimed; email addresses are not verified, and password recovery uses saved codes.

Custom source administration and source/audit migration remain outside this hosted account rollout and stay unavailable in data-only hosting. SQLite full mode remains for local development or an explicitly persistent installation. Do not disable data-only mode on an ephemeral Render filesystem to expose administration.

Render’s free service still sleeps; cold starts and provider failures can produce temporary unavailability. General request throttling and provider caches remain process-local; persistent credential budgets do not replace distributed abuse prevention. Watch/provider access does not require a database query, except the optional account lookup.

Free-tier quotas and restore retention must be checked in the actual Neon dashboard before relying on them. A database move remains possible with a reviewed PostgreSQL export/import and a cutover window; test restored accounts and revoke sessions as appropriate. No automatic backup schedule, successful restore drill, unlimited free capacity or high availability is claimed. For rollback, retain schema/data, restore a compatible backend release, or temporarily remove `DATABASE_URL` to disable account routes without deleting customer data.

---

# Legacy SQLite operation (local/full mode)

The implemented store is SQLite in WAL mode, with foreign-key cascades, a five-second busy timeout and secure deletion of active database cells. This is a real single-process persistent store, not a production database service provisioned elsewhere. Password hashes, session digests and recovery-code digests remain sensitive data.

## Supported initial topology

Run exactly one Nest API instance against an absolute DATABASE_PATH on a persistent local filesystem, owned by its service account. Keep the database directory private (0700); encrypt the disk and off-host backups through the host’s facilities. Do not put SQLite on an ephemeral free-service filesystem, shared network drive or multiple containers. The Next server can be separate, but the API must remain private and reachable only through reviewed routing. A host and launch configuration have not been provisioned.

Provider cache and connection throttling remain process-local. The BFF currently shares an API connection identity, making upstream IP limits installation-wide; it must not trust arbitrary browser Forwarded/X-Forwarded-For headers. Persistent per-account authentication counters add restart-resistant protection, but this does not complete public proxy attribution or distributed abuse controls.

## Backups and restore

```sh
DATABASE_PATH=/absolute/private/backinit.sqlite node scripts/backup-database.mjs /absolute/private/backups/backinit-2026-10-28.sqlite
```

The online SQLite backup API includes committed WAL data. Output is owner-only, existing files cannot be overwritten, and integrity is verified after backup. A test restores a WAL-backed fixture and verifies its contents. Copying only the main live database file is not a backup procedure.

For a real restore drill, stop a separate isolated API, restore a backup to its private data directory, set DATABASE_PATH to that copy, verify integrity, test an ordinary account and source record, and confirm deleted/revoked sessions behave as expected for the snapshot. Never overwrite the active database while its API is running. A restore rolls state back, including deletions, passwords and revocations; invalidate restored sessions and reconcile deletion requests before exposing it to users.

Define scheduled backup frequency, encrypted off-host copies, maximum retention, restore ownership and measured recovery time before launch. The script does not schedule, encrypt, upload or monitor backups. User deletion cannot erase historical backups instantly; the privacy page says so.

## Schema changes

Current additive schemas are created at startup with CREATE TABLE IF NOT EXISTS. There is no versioned migration framework yet. Before a destructive/schema-changing release, introduce numbered transactional migrations and a schema-version table, test both fresh installation and upgrades from a sanitized prior database, take a verified backup and document the rollback/restore path. No destructive schema migration is part of this milestone.

## Migrating legacy SQLite records

The Neon project is new; no customer SQLite database was discovered or copied. If a persistent legacy installation needs migration, preserve account IDs and password hashes, migrate favorites/settings/audit in a controlled window, revoke old sessions, compare counts and test ownership and recovery before switching traffic. Source management needs its own PostgreSQL adapter before it can move from full mode.
