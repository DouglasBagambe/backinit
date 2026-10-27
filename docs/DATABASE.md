# Database operation and migration strategy

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

## PostgreSQL migration trigger and plan

Move to a durable PostgreSQL instance before multiple API replicas, high write concurrency or operational requirements that exceed a single host. No managed paid or free database has been created, and no PostgreSQL adapter is claimed to be working.

1. Introduce repository interfaces for accounts, sessions, favorites, notifications, source versions and audit. Preserve authorization and transaction boundaries.
2. Implement PostgreSQL schemas and versioned migrations with matching uniqueness, cascades, indexes and atomic recovery-code/source-version updates.
3. Migrate hashes unchanged, preserve IDs and source/audit versions, and intentionally revoke sessions during cutover. Verify row counts and representative account/source histories in an isolated restore.
4. Centralize provider refresh/rate budgets and add shared request limiting with reviewed proxy attribution. Keep raw secrets and personal identifiers out of logs.
5. Perform a read-only cutover window, reconcile the final snapshot, run end-to-end verification, and retain the encrypted SQLite snapshot under the declared retention policy until rollback is no longer needed.

A production database strategy is documented here; a scalable production deployment remains outstanding.
