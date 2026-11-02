import { z } from "zod";
import type {
  Broadcast,
  BroadcastFeed,
} from "../../../../packages/domain/src/index.js";
const entry = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1).max(300),
  tag: z.string().max(100).optional(),
  poster: z.string().optional(),
  uri_name: z.string().regex(/^[a-zA-Z0-9_/-]+$/),
  starts_at: z.number().finite(),
  ends_at: z.number().finite(),
  always_live: z.number(),
  viewers: z.union([z.string(), z.number()]).optional(),
  iframe: z.string().optional(),
  source_tag: z.string().optional(),
  substreams: z
    .array(
      z.object({
        id: z.number(),
        iframe: z.string().optional(),
        source_tag: z.string().optional(),
      }),
    )
    .optional(),
});
const response = z.object({
  success: z.literal(true),
  streams: z.array(
    z.object({ category: z.string(), streams: z.array(z.unknown()) }),
  ),
});
// Only documented provider-supplied embed origins; arbitrary HTML never executes.
export function ppvEmbed(value: string | undefined): string | null {
  if (!value) return null;
  const raw = value.trim().startsWith("<iframe")
    ? value.match(/\bsrc=["']([^"']+)["']/i)?.[1]
    : value;
  try {
    const u = new URL(raw || "");
    return u.protocol === "https:" &&
      !u.username &&
      !u.password &&
      ["taifood-blog.asia", "ppv.st", "ppv.rw", "ppv.ug"].includes(
        u.hostname,
      ) &&
      u.pathname.startsWith("/embed/")
      ? u.href
      : null;
  } catch {
    return null;
  }
}
export function parsePpv(raw: unknown): Broadcast[] {
  const body = response.parse(raw);
  const unique = new Map<string, Broadcast>();
  for (const category of body.streams)
    for (const candidate of category.streams) {
      const parsed = entry.safeParse(candidate);
      if (!parsed.success) continue;
      const s = parsed.data;
      const sources = [
        {
          id: String(s.id),
          label: s.source_tag || "Main stream",
          url: ppvEmbed(s.iframe),
        },
        ...(s.substreams || []).map((x) => ({
          id: String(x.id),
          label: x.source_tag || "Alternate stream",
          url: ppvEmbed(x.iframe),
        })),
      ].filter((x): x is { id: string; label: string; url: string } => !!x.url);
      let poster: string | null = null;
      try {
        const u = new URL(s.poster || "");
        if (
          u.protocol === "https:" &&
          ["static.ppvservices.st", "cdn.nba.com"].includes(u.hostname)
        )
          poster = u.href;
      } catch {}
      const viewers = Number(s.viewers);
      const id = `ppv-${s.id}`;
      if (!s.always_live && (s.starts_at <= 0 || s.ends_at < s.starts_at))
        continue;
      unique.set(id, {
        id,
        title: s.name,
        category: category.category,
        competition: s.tag || category.category,
        poster,
        start: s.always_live === 1 ? 0 : s.starts_at * 1000,
        end: s.always_live === 1 ? 0 : s.ends_at * 1000,
        channel: s.always_live === 1,
        viewers:
          s.viewers !== undefined && Number.isFinite(viewers) && viewers >= 0
            ? Math.floor(viewers)
            : null,
        pageUrl: `https://ppv.st/live/${s.uri_name}`,
        sources,
        replay: false,
      });
    }
  return [...unique.values()];
}
export class PpvCatalogue {
  private snapshot: BroadcastFeed | null = null;
  private pending: Promise<BroadcastFeed> | null = null;
  private retryAt = 0;
  constructor(
    private fetcher: typeof fetch = fetch,
    private now = Date.now,
  ) {}
  async feed(): Promise<BroadcastFeed> {
    const time = this.now();
    if (this.snapshot && time < Date.parse(this.snapshot.updatedAt!) + 60000)
      return this.snapshot;
    if (time < this.retryAt) return this.result();
    if (!this.pending)
      this.pending = this.refresh().finally(() => {
        this.pending = null;
      });
    // Stale-while-revalidate keeps catalogue outages out of navigation.
    if (this.snapshot) {
      void this.pending.catch(() => {});
      return this.result();
    }
    return this.pending;
  }
  private result(): BroadcastFeed {
    return this.snapshot
      ? {
          ...this.snapshot,
          stale: true,
          message:
            "Showing the last catalogue. Stream availability may have changed.",
        }
      : {
          data: [],
          updatedAt: null,
          stale: true,
          message:
            "Broadcast catalogue is temporarily unavailable. Retry shortly.",
        };
  }
  private async refresh() {
    try {
      const r = await this.fetcher("https://api.ppv.st/api/streams", {
        cache: "no-store",
        signal: AbortSignal.timeout(6000),
      });
      if (!r.ok) throw Error();
      const text = await r.text();
      if (text.length > 3000000) throw Error();
      const data = parsePpv(JSON.parse(text));
      if (!data.length) throw Error();
      this.snapshot = {
        data,
        updatedAt: new Date(this.now()).toISOString(),
        stale: false,
      };
      return this.snapshot;
    } catch {
      this.retryAt = this.now() + 60000;
      return this.result();
    }
  }
}
export const ppvCatalogue = new PpvCatalogue();
