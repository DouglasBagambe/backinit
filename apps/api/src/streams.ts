import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";
import {
  streamSourceSchema,
  testSources,
  sourceIsActive,
  type StreamSource,
} from "../../../packages/domain/src/index.js";
import type { Accounts, User } from "./accounts.js";
const allowed = new Set([
  "test-streams.mux.dev",
  "dash.akamaized.net",
  "www.youtube-nocookie.com",
]);
export function validateStream(input: unknown): StreamSource {
  const parsed = streamSourceSchema.safeParse(input);
  if (!parsed.success)
    throw new BadRequestException(
      "Invalid source. Complete all rights and validity fields.",
    );
  const source = parsed.data;
  const url = new URL(source.url);
  const evidence = new URL(source.rightsEvidence);
  if (evidence.protocol !== "https:" || evidence.username || evidence.password)
    throw new BadRequestException(
      "Rights evidence must use a public HTTPS link.",
    );
  if (
    url.protocol !== "https:" ||
    url.port ||
    url.username ||
    url.password ||
    !allowed.has(url.hostname)
  )
    throw new BadRequestException(
      "Source host is not approved. Update the server allowlist after review.",
    );
  if (
    source.type === "embed"
      ? url.hostname !== "www.youtube-nocookie.com" ||
        !/^\/embed\/[A-Za-z0-9_-]{11}$/.test(url.pathname)
      : url.hostname === "www.youtube-nocookie.com"
  )
    throw new BadRequestException("Invalid player URL");
  if (Date.parse(source.validUntil) <= Date.parse(source.validFrom))
    throw new BadRequestException("Invalid validity window");
  if (source.content === "sports" && !source.eventId)
    throw new BadRequestException("Sports sources require an event ID");
  return source;
}
export class Streams {
  private checks = new Map<
    string,
    {
      at: number;
      promise: Promise<{ status: string; checkedAt: string; message: string }>;
    }
  >();
  constructor(private readonly accounts: Accounts) {
    accounts.db.exec(
      "CREATE TABLE IF NOT EXISTS sources (id TEXT PRIMARY KEY, body TEXT NOT NULL, version INTEGER NOT NULL)",
    );
    for (const source of testSources)
      accounts.db
        .prepare("INSERT OR IGNORE INTO sources VALUES (?,?,?)")
        .run(source.id, JSON.stringify(source), source.version);
  }
  all(): StreamSource[] {
    return this.accounts.db
      .prepare("SELECT body FROM sources ORDER BY id")
      .all()
      .map((row) => streamSourceSchema.parse(JSON.parse(row.body as string)));
  }
  public(event?: string) {
    return this.all()
      .sort((a, b) => (a.type === "hls" ? 0 : 1) - (b.type === "hls" ? 0 : 1))
      .filter(
        (s) =>
          sourceIsActive(s) &&
          (event
            ? s.content === "sports" && s.eventId === event
            : s.content === "test"),
      );
  }
  save(user: User, input: unknown) {
    const source = validateStream(input);
    this.accounts.db.exec("BEGIN IMMEDIATE");
    try {
      const old = this.accounts.db
        .prepare("SELECT version FROM sources WHERE id=?")
        .get(source.id) as { version: number } | undefined;
      if (
        (old && source.version !== old.version) ||
        (!old && source.version !== 1)
      )
        throw new ConflictException("Source changed. Reload before saving.");
      const updated = { ...source, version: old ? old.version + 1 : 1 };
      this.accounts.db
        .prepare(
          "INSERT INTO sources VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET body=excluded.body,version=excluded.version",
        )
        .run(source.id, JSON.stringify(updated), updated.version);
      this.accounts.audit(
        user,
        source.revoked ? "source.revoke" : "source.save",
        source.id,
      );
      this.accounts.db.exec("COMMIT");
      this.checks.delete(source.id);
      return updated;
    } catch (e) {
      this.accounts.db.exec("ROLLBACK");
      throw e;
    }
  }
  async health(id: string) {
    const source = this.all().find((s) => s.id === id && sourceIsActive(s));
    if (!source) throw new NotFoundException("Source not available");
    const old = this.checks.get(id);
    if (old && Date.now() - old.at < 60000) return old.promise;
    const promise = (async () => {
      const checkedAt = new Date().toISOString();
      if (source.type === "embed")
        return {
          status: "unknown",
          checkedAt,
          message:
            "Embed availability depends on provider, viewer territory and consent.",
        };
      try {
        validateStream(source);
        const response = await fetch(source.url, {
          method: "HEAD",
          redirect: "error",
          signal: AbortSignal.timeout(5000),
        });
        return {
          status: response.ok ? "reachable" : "unavailable",
          checkedAt,
          message: response.ok
            ? "Manifest reachable. Playback, segments and regional availability are not guaranteed."
            : "Manifest request failed.",
        };
      } catch {
        return {
          status: "unavailable",
          checkedAt,
          message:
            "Source unreachable. You can retry or select another source.",
        };
      }
    })();
    this.checks.set(id, { at: Date.now(), promise });
    return promise;
  }
}
