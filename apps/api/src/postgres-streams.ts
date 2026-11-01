import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";
import {
  streamSourceSchema,
  sourceCheckSchema,
  sourceIsActive,
  sourceMatchesEvent,
  type SportEvent,
  type StreamSource,
} from "../../../packages/domain/src/index.js";
import type { User } from "./account-types.js";
import {
  transaction,
  type DatabasePool,
  type DatabaseQuery,
} from "./postgres.js";
import {
  fingerprint,
  validateStream,
  validatePlaybackReport,
  probeSourceHealth,
} from "./streams.js";
import { ProviderCache } from "./providers/cache.js";

export const streamMigration = `
CREATE TABLE IF NOT EXISTS broadcast_sources (id TEXT PRIMARY KEY, body JSONB NOT NULL, version INTEGER NOT NULL CHECK(version>0));
CREATE TABLE IF NOT EXISTS broadcast_checks (source_id TEXT PRIMARY KEY REFERENCES broadcast_sources(id) ON DELETE CASCADE, body JSONB NOT NULL);
DO $grant$ BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname='backinit_app') THEN
    GRANT SELECT,INSERT,UPDATE,DELETE ON broadcast_sources,broadcast_checks TO backinit_app;
  END IF;
END $grant$;
`;
export async function migrateStreams(pool: DatabasePool) {
  await transaction(pool, async (db) => {
    await db.query("SELECT pg_advisory_xact_lock(74219002)");
    await db.query(streamMigration);
  });
}
export async function checkStreamSchema(pool: DatabasePool) {
  await pool.query("SELECT id,body,version FROM broadcast_sources LIMIT 0");
  await pool.query("SELECT source_id,body FROM broadcast_checks LIMIT 0");
}
type Check = ReturnType<typeof validatePlaybackReport>;
function compatible(source: StreamSource, check?: Check | null) {
  return (
    check?.result === "passed" &&
    check.fingerprint === fingerprint(source) &&
    Date.now() - Date.parse(check.checkedAt) < 86400000
  );
}
/** Durable source registry; saves, verification and audit writes commit together. */
export class PostgresStreams {
  private metadata = new ProviderCache();
  constructor(private readonly pool: DatabasePool) {}
  async publicForEvents(events: SportEvent[]) {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        this.forEvents(events),
        new Promise<null>((resolve) => {
          timer = setTimeout(() => resolve(null), 1500);
        }),
      ]);
    } catch {
      return null;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
  async all(db: DatabaseQuery = this.pool): Promise<StreamSource[]> {
    const { rows } = await db.query(
      "SELECT body FROM broadcast_sources ORDER BY id",
    );
    return rows.map((r) => streamSourceSchema.parse(r.body));
  }
  async checks(db: DatabaseQuery = this.pool): Promise<Record<string, Check>> {
    const { rows } = await db.query<{ source_id: string; body: Check }>(
      "SELECT source_id,body FROM broadcast_checks",
    );
    return Object.fromEntries(rows.map((r) => [r.source_id, r.body]));
  }
  async forEvents(events: SportEvent[]) {
    const [sources, checks] = await Promise.all([this.all(), this.checks()]);
    return new Map(
      events.map((event) => [
        event.id,
        sources
          .filter(
            (s) =>
              sourceIsActive(s) &&
              sourceMatchesEvent(s, event) &&
              !(
                (s.presentation || "live") === "live" &&
                ["finished", "cancelled"].includes(event.status)
              ) &&
              compatible(s, checks[s.id]),
          )
          .map((s) => ({
            ...s,
            validUntil: new Date(
              Math.min(
                Date.parse(s.validUntil),
                Date.parse(checks[s.id]!.checkedAt) + 86400000,
              ),
            ).toISOString(),
          })),
      ]),
    );
  }
  async forEvent(event: SportEvent) {
    return (await this.forEvents([event])).get(event.id)!;
  }
  private async audit(
    db: DatabaseQuery,
    user: User,
    action: string,
    id: string,
  ) {
    await db.query(
      "INSERT INTO audit(user_id,action,target,at) VALUES ($1,$2,$3,$4)",
      [user.id, action, id, new Date().toISOString()],
    );
  }
  async save(user: User, input: unknown) {
    const source = validateStream(input);
    return transaction(this.pool, async (db) => {
      await db.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
        `broadcast:${source.id}`,
      ]);
      const old = (
        await db.query<{ version: number }>(
          "SELECT version FROM broadcast_sources WHERE id=$1 FOR UPDATE",
          [source.id],
        )
      ).rows[0];
      if (
        (old && source.version !== old.version) ||
        (!old && source.version !== 1)
      )
        throw new ConflictException("Source changed. Reload before saving.");
      const check = (
        await db.query<{ body: Check }>(
          "SELECT body FROM broadcast_checks WHERE source_id=$1",
          [source.id],
        )
      ).rows[0]?.body;
      if (
        source.content === "sports" &&
        !source.revoked &&
        !compatible(source, check)
      )
        throw new BadRequestException(
          "Save this source disabled, verify playback, then enable it. Playback checks expire after 24 hours.",
        );
      const updated = { ...source, version: old ? old.version + 1 : 1 };
      await db.query(
        "INSERT INTO broadcast_sources(id,body,version) VALUES ($1,$2,$3) ON CONFLICT(id) DO UPDATE SET body=excluded.body,version=excluded.version",
        [source.id, JSON.stringify(updated), updated.version],
      );
      await this.audit(
        db,
        user,
        source.revoked ? "source.revoke" : "source.save",
        source.id,
      );
      return updated;
    });
  }
  async recordCheck(user: User, input: unknown) {
    const body = sourceCheckSchema.safeParse(input);
    if (!body.success) throw new BadRequestException("Invalid playback report");
    return transaction(this.pool, async (db) => {
      await db.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
        `broadcast:${body.data.id}`,
      ]);
      const row = (
        await db.query(
          "SELECT body FROM broadcast_sources WHERE id=$1 FOR UPDATE",
          [body.data.id],
        )
      ).rows[0];
      if (!row) throw new NotFoundException("Source not found");
      const source = streamSourceSchema.parse(row.body),
        report = validatePlaybackReport(source, body.data);
      await db.query(
        "INSERT INTO broadcast_checks(source_id,body) VALUES ($1,$2) ON CONFLICT(source_id) DO UPDATE SET body=excluded.body",
        [source.id, JSON.stringify(report)],
      );
      await this.audit(db, user, `source.verify.${report.result}`, source.id);
      return report;
    });
  }
  async health(id: string, preview = false) {
    const [sources, checks] = await Promise.all([this.all(), this.checks()]);
    const source = sources.find(
      (s) =>
        s.id === id &&
        (preview ||
          (sourceIsActive(s) &&
            (s.content !== "sports" || compatible(s, checks[s.id])))),
    );
    if (!source) throw new NotFoundException("Source not available");
    return probeSourceHealth(source, this.metadata);
  }
  async auditLog() {
    return (
      await this.pool.query(
        "SELECT id,action,target,at FROM audit WHERE action LIKE 'source.%' ORDER BY id DESC LIMIT 100",
      )
    ).rows;
  }
}
