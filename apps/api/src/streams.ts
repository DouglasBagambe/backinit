import { isIP } from "node:net";
import { createHash } from "node:crypto";
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";
import {
  streamSourceSchema,
  testSources,
  sourceIsActive,
  sourceMatchesEvent,
  sourceCheckSchema,
  type SportEvent,
  type StreamSource,
} from "../../../packages/domain/src/index.js";
import { ProviderCache } from "./providers/cache.js";
import { z } from "zod";
import type { Accounts, User } from "./accounts.js";
const allowed = new Set([
  "test-streams.mux.dev",
  "dash.akamaized.net",
  "www.youtube-nocookie.com",
  "livesim2.dashif.org",
  "cph-p2p-msl.akamaized.net",
]);
const configuredHosts = (key: string) =>
  new Set(
    (process.env[key] || "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(
        (s) =>
          /^[a-z0-9.-]+$/.test(s) &&
          !s.includes("*") &&
          !isIP(s) &&
          !s.endsWith(".localhost") &&
          !/^(localhost|127\.|0\.|10\.|192\.168\.|169\.254\.)/.test(s),
      ),
  );
const fingerprint = (s: StreamSource) =>
  createHash("sha256").update(`${s.type}:${s.url}`).digest("hex");
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
    !(
      allowed.has(url.hostname) ||
      configuredHosts("STREAM_ALLOWED_HOSTS").has(url.hostname) ||
      (source.type === "embed" &&
        configuredHosts("STREAM_EMBED_HOSTS").has(url.hostname))
    )
  )
    throw new BadRequestException(
      "Source host is not approved. Update the server allowlist after review.",
    );
  if (source.type === "embed") {
    if (
      url.hostname === "www.youtube-nocookie.com"
        ? !/^\/embed\/[A-Za-z0-9_-]{11}$/.test(url.pathname)
        : !configuredHosts("STREAM_EMBED_HOSTS").has(url.hostname)
    )
      throw new BadRequestException("Invalid player URL");
  } else if (
    url.hostname === "www.youtube-nocookie.com" ||
    configuredHosts("STREAM_EMBED_HOSTS").has(url.hostname)
  )
    throw new BadRequestException("Invalid player URL");
  const testHost = [
    "test-streams.mux.dev",
    "dash.akamaized.net",
    "livesim2.dashif.org",
    "cph-p2p-msl.akamaized.net",
  ].includes(url.hostname);
  if (testHost && source.content !== "test")
    throw new BadRequestException(
      "Known playback-testing hosts cannot be labelled sports broadcasts.",
    );
  if (source.content === "test" && (source.eventId || source.fixtureRef))
    throw new BadRequestException(
      "Test feeds cannot be attached to sporting fixtures.",
    );
  if (Date.parse(source.validUntil) <= Date.parse(source.validFrom))
    throw new BadRequestException("Invalid validity window");
  if (
    source.content === "official" &&
    (source.type !== "embed" ||
      source.territory !== "PROVIDER" ||
      !source.catalog)
  )
    throw new BadRequestException(
      "Official catalog entries require a provider-controlled embed and metadata.",
    );
  if (source.type !== "embed" && source.territory !== "WORLD")
    throw new BadRequestException(
      "Direct streams require documented worldwide rights.",
    );
  if (source.content === "sports" && !source.eventId && !source.fixtureRef)
    throw new BadRequestException(
      "Sports sources require an event ID or verified provider fixture reference",
    );
  return source;
}
export class Streams {
  private metadata = new ProviderCache();
  admit(source: StreamSource) {
    validateStream(source);
    for (const duplicate of this.all().filter(
      (s) =>
        s.id !== source.id &&
        s.url === source.url &&
        s.content === "official" &&
        s.version === 1 &&
        !s.revoked,
    ))
      this.accounts.db
        .prepare("DELETE FROM sources WHERE id=? AND version=1")
        .run(duplicate.id);
    const old = this.all().find((s) => s.id === source.id);
    if (!old)
      this.accounts.db
        .prepare("INSERT INTO sources VALUES (?,?,1)")
        .run(source.id, JSON.stringify(source));
    else if (old.version === 1 && !old.revoked && old.content === "official")
      this.accounts.db
        .prepare("UPDATE sources SET body=? WHERE id=? AND version=1")
        .run(JSON.stringify(source), source.id);
  }
  library() {
    return this.all().filter(
      (s) => s.content === "official" && sourceIsActive(s),
    );
  }
  private checks = new Map<
    string,
    {
      at: number;
      promise: Promise<{ status: string; checkedAt: string; message: string }>;
    }
  >();
  constructor(private readonly accounts: Accounts) {
    accounts.db.exec(
      `CREATE TABLE IF NOT EXISTS sources (id TEXT PRIMARY KEY, body TEXT NOT NULL, version INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS source_checks (source_id TEXT PRIMARY KEY REFERENCES sources(id) ON DELETE CASCADE, fingerprint TEXT NOT NULL, body TEXT NOT NULL);`,
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
  public(event?: string, library = false) {
    if (library) return this.library();
    return this.all()
      .sort((a, b) => (a.type === "hls" ? 0 : 1) - (b.type === "hls" ? 0 : 1))
      .filter(
        (s) =>
          sourceIsActive(s) &&
          (event
            ? s.content === "sports" &&
              s.eventId === event &&
              this.compatible(s)
            : s.content === "test"),
      );
  }
  forEvent(event: SportEvent) {
    return this.all()
      .filter(
        (s) =>
          sourceIsActive(s) &&
          sourceMatchesEvent(s, event) &&
          this.compatible(s),
      )
      .map((s) => ({
        ...s,
        validUntil: new Date(
          Math.min(
            Date.parse(s.validUntil),
            Date.parse(this.lastCheck(s.id)!.checkedAt) + 86400000,
          ),
        ).toISOString(),
      }));
  }
  lastCheck(id: string) {
    const row = this.accounts.db
      .prepare("SELECT body FROM source_checks WHERE source_id=?")
      .get(id);
    return row
      ? (JSON.parse(row.body as string) as {
          result: string;
          method: string;
          checkedAt: string;
          version: number;
          fingerprint: string;
        })
      : null;
  }
  compatible(source: StreamSource) {
    const check = this.lastCheck(source.id);
    return (
      check?.result === "passed" &&
      check.fingerprint === fingerprint(source) &&
      Date.now() - Date.parse(check.checkedAt) < 86400000
    );
  }
  recordCheck(user: User, input: unknown) {
    const body = sourceCheckSchema.safeParse(input);
    if (!body.success) throw new BadRequestException("Invalid playback report");
    const source = this.all().find((s) => s.id === body.data.id);
    if (!source) throw new NotFoundException("Source not found");
    if (source.version !== body.data.version)
      throw new ConflictException("Source changed. Reload before verifying.");
    if (
      body.data.result === "passed" &&
      body.data.method === "native-decoded" &&
      (body.data.currentTime <= 1 ||
        body.data.width < 1 ||
        body.data.height < 1)
    )
      throw new BadRequestException("Decoded playback evidence is required.");
    if (body.data.method === "native-decoded" && source.type === "embed")
      throw new BadRequestException(
        "Use provider or operator verification for embeds.",
      );
    if (
      body.data.result === "passed" &&
      body.data.method === "native-decoded" &&
      source.content === "sports" &&
      (source.presentation || "live") === "live" &&
      !body.data.live
    )
      throw new BadRequestException(
        "A live broadcast requires an actual live playback window. Use Replay for VOD.",
      );
    if (source.type !== "embed" && body.data.method !== "native-decoded")
      throw new BadRequestException(
        "Direct sources require native decoded playback evidence.",
      );
    if (
      body.data.method === "provider-player" &&
      (source.type !== "embed" ||
        new URL(source.url).hostname !== "www.youtube-nocookie.com")
    )
      throw new BadRequestException(
        "No playback SDK is available for this source. Use operator observation for permitted frames.",
      );
    const report = {
      ...body.data,
      fingerprint: fingerprint(source),
      checkedAt: new Date().toISOString(),
    };
    this.accounts.db
      .prepare(
        "INSERT INTO source_checks VALUES (?,?,?) ON CONFLICT(source_id) DO UPDATE SET fingerprint=excluded.fingerprint,body=excluded.body",
      )
      .run(source.id, report.fingerprint, JSON.stringify(report));
    this.accounts.audit(user, `source.verify.${report.result}`, source.id);
    return report;
  }
  save(user: User, input: unknown) {
    const source = validateStream(input);
    if (
      source.content === "sports" &&
      !source.revoked &&
      !this.compatible(source)
    )
      throw new BadRequestException(
        "Save this source disabled, verify playback, then enable it. Playback checks expire after 24 hours.",
      );
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
  async health(id: string, preview = false) {
    const source = this.all().find(
      (s) =>
        s.id === id &&
        (preview ||
          (sourceIsActive(s) &&
            (s.content !== "sports" || this.compatible(s)))),
    );
    if (!source) throw new NotFoundException("Source not available");
    const old = this.checks.get(id);
    if (!preview && old && Date.now() - old.at < 60000) return old.promise;
    const promise = (async () => {
      const checkedAt = new Date().toISOString();
      if (
        source.type === "embed" &&
        new URL(source.url).hostname !== "www.youtube-nocookie.com"
      )
        return {
          status: "unknown",
          checkedAt,
          message:
            "Publisher-permitted embed configured. Cross-origin playback must be verified in the browser; HTTP reachability is not playback proof.",
        };
      if (source.type === "embed") {
        try {
          const id = new URL(source.url).pathname.split("/").pop()!;
          await this.metadata.json(
            `https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}&format=json`,
            60000,
            (raw) =>
              z
                .object({ title: z.string(), author_name: z.string() })
                .parse(raw),
          );
          return {
            status: "metadata-available",
            checkedAt,
            message:
              "Provider metadata is available. Playback and regional restrictions are checked by the embedded player.",
          };
        } catch {
          return {
            status: "unavailable",
            checkedAt,
            message:
              "The provider is not confirming this video. It may be removed, restricted or temporarily unreachable.",
          };
        }
      }
      try {
        validateStream(source);
        const response = await fetch(source.url, {
          method: "GET",
          redirect: "error",
          signal: AbortSignal.timeout(5000),
        });
        let text = "";
        if (response.ok && response.body) {
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let bytes = 0;
          try {
            while (true) {
              const part = await reader.read();
              if (part.done) break;
              bytes += part.value.byteLength;
              if (bytes > 262144)
                throw new Error("Manifest exceeds probe size limit");
              text += decoder.decode(part.value, { stream: true });
            }
          } finally {
            await reader.cancel();
          }
        }

        const manifestOk =
          text.length <= 262144 &&
          (source.type === "hls"
            ? text.trimStart().startsWith("#EXTM3U")
            : /<MPD[\s>]/.test(text));
        return {
          status: response.ok && manifestOk ? "reachable" : "unavailable",
          checkedAt,
          message:
            response.ok && manifestOk
              ? "Valid manifest reached. Segment decoding, CORS and viewing entitlement must still be verified in the browser."
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
