import { createHash } from "node:crypto";
import { z } from "zod";
import type {
  Broadcast,
  BroadcastFeed,
} from "../../../../packages/domain/src/index.js";

const categories: Record<string, string> = {
  soccer: "Football",
  football: "American Football",
  basketball: "Basketball",
  hockey: "Ice Hockey",
  baseball: "Baseball",
  racing: "Motorsport",
  tennis: "Tennis",
  cricket: "Cricket",
  combat: "Combat Sports",
  boxing: "Boxing",
  mma: "MMA",
  wrestling: "Wrestling",
  rugby: "Rugby",
  cycling: "Cycling",
  darts: "Darts",
};
export function externalId(provider: string, key: string) {
  return `ext-${provider}-${createHash("sha256").update(key).digest("hex").slice(0, 20)}`;
}
function publicUrl(value: string | undefined, hosts: string[], path = "/") {
  try {
    const u = new URL(value || "");
    return u.protocol === "https:" &&
      !u.username &&
      !u.password &&
      !u.port &&
      hosts.includes(u.hostname) &&
      u.pathname.startsWith(path)
      ? u.href
      : null;
  } catch {
    return null;
  }
}
const freeHosts = ["strmfree.pk", "strmfree.st", "streamfree.top"];
const freeItem = z.object({
  name: z.string().min(1).max(300),
  category: z.string(),
  league: z.string().optional(),
  stream_key: z.string().min(1).max(200),
  match_timestamp: z.number().positive().finite(),
  thumbnail_url: z.string().optional(),
  sources: z.array(z.unknown()),
});
export function parseStreamfree(raw: unknown): Broadcast[] {
  const body = z.object({ streams: z.array(z.unknown()) }).parse(raw);
  return body.streams.flatMap((candidate) => {
    const result = freeItem.safeParse(candidate);
    if (!result.success) return [];
    const s = result.data,
      category = categories[s.category.toLowerCase()];
    if (!category) return [];
    const channel = [
      "skyf1",
      "skysportstennis",
      "willow",
      "skysportscricket",
    ].includes(s.stream_key.toLowerCase());
    const urls = new Set<string>();
    let live = false;
    const sources = s.sources.flatMap((candidate) => {
      const parsed = z
        .object({
          url: z.string(),
          quality: z.string().optional(),
          live: z.boolean().optional(),
        })
        .safeParse(candidate);
      if (!parsed.success) return [];
      const url = publicUrl(parsed.data.url, freeHosts, "/embed/");
      if (!url || urls.has(url)) return [];
      urls.add(url);
      live ||= parsed.data.live === true;
      return [
        {
          id: externalId("streamfree-source", url),
          label: `Stream ${urls.size}`,
          url,
        },
      ];
    });
    return [
      {
        id: externalId("streamfree", s.stream_key),
        title: s.name,
        category,
        competition: s.league || category,
        poster: publicUrl(s.thumbnail_url, freeHosts, "/thumbnails/"),
        start: channel ? 0 : s.match_timestamp * 1000,
        end: channel ? 0 : (s.match_timestamp + 8 * 3600) * 1000,
        channel,
        viewers: null,
        live,
        pageUrl: `https://strmfree.pk/embed/${encodeURIComponent(s.category)}/${encodeURIComponent(s.stream_key)}`,
        sources,
        replay: false,
      },
    ];
  });
}
const timItem = z.object({
  url: z.string().min(1).max(200),
  name: z.string().min(1).max(300),
  genre: z.number(),
  vip: z.boolean().optional(),
  logo: z.string().optional(),
  date: z.string().optional(),
  streams: z.array(z.unknown()).optional(),
});
export function parseTimChannels(raw: unknown): Broadcast[] {
  const body = z
    .object({
      channels: z.array(z.unknown()),
      genres: z.array(z.object({ id: z.number(), name: z.string() })),
    })
    .parse(raw);
  const sports = new Set(
    body.genres
      .filter((g) => g.name.trim().toLowerCase() === "sports")
      .map((g) => g.id),
  );
  return body.channels.flatMap((candidate) => {
    const result = timItem.safeParse(candidate);
    if (!result.success || result.data.vip || !sports.has(result.data.genre))
      return [];
    const s = result.data,
      urls = new Set<string>();
    const sources = (s.streams || []).flatMap((candidate) => {
      const p = z
        .object({ url: z.string(), vip: z.boolean().optional() })
        .safeParse(candidate);
      if (!p.success || p.data.vip) return [];
      const url = publicUrl(p.data.url, ["ehgembxe.cfd"]);
      if (!url || urls.has(url)) return [];
      urls.add(url);
      return [
        {
          id: externalId("tim-source", url),
          label: `Stream ${urls.size}`,
          url,
        },
      ];
    });
    if (!sources.length) return [];
    return [
      {
        id: externalId("tim", s.url),
        title: s.name,
        category: "Sports",
        competition: "Sports channel",
        poster: null,
        start: 0,
        end: 0,
        channel: true,
        viewers: null,
        pageUrl: `https://tim-streams.com/channel/${encodeURIComponent(s.url)}`,
        sources,
        replay: false,
      },
    ];
  });
}

/** Per-provider cache: an outage never replaces a healthy provider's data. */
export class AdditionalCatalogue {
  get idPrefix() {
    return this.name === "StreamFree"
      ? "ext-streamfree-"
      : this.name === "Tim Streams"
        ? "ext-tim-"
        : undefined;
  }
  private snapshot: BroadcastFeed | null = null;
  private pending: Promise<BroadcastFeed> | null = null;
  private checkedAt = -Infinity;
  constructor(
    readonly name: string,
    private url: string,
    private parse: (raw: unknown) => Broadcast[],
    private fetcher: typeof fetch = fetch,
    private now = Date.now,
  ) {}
  async feed(): Promise<BroadcastFeed> {
    if (this.now() - this.checkedAt < 60000) return this.result();
    if (!this.pending)
      this.pending = this.refresh().finally(() => {
        this.pending = null;
      });
    if (this.snapshot) {
      void this.pending.catch(() => {});
      return this.result();
    }
    return this.pending;
  }
  private result(): BroadcastFeed {
    return this.snapshot || { data: [], updatedAt: null, stale: true };
  }
  private async refresh(): Promise<BroadcastFeed> {
    try {
      const response = await this.fetcher(this.url, {
        cache: "no-store",
        signal: AbortSignal.timeout(6000),
        redirect: "error",
      });
      if (!response.ok) throw Error("Catalogue request failed");
      const reader = response.body?.getReader();
      if (!reader) throw Error("Missing response body");
      const chunks: Uint8Array[] = [];
      let size = 0;
      try {
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          size += value.length;
          if (size > 3000000) throw Error("Catalogue response too large");
          chunks.push(value);
        }
      } finally {
        await reader.cancel().catch(() => {});
      }
      const text = Buffer.concat(chunks).toString("utf8");
      this.snapshot = {
        data: this.parse(JSON.parse(text)),
        updatedAt: new Date(this.now()).toISOString(),
        stale: false,
      };
    } catch {
      if (this.snapshot) this.snapshot = { ...this.snapshot, stale: true };
    } finally {
      this.checkedAt = this.now();
    }
    return this.result();
  }
}
export const additionalCatalogues = [
  new AdditionalCatalogue(
    "StreamFree",
    "https://strmfree.pk/api/v1/streams",
    parseStreamfree,
  ),
  // Enable only after this host can reach the feed and playback is verified.
  ...(process.env.TIM_STREAMS_ENABLED === "true"
    ? [
        new AdditionalCatalogue(
          "Tim Streams",
          "https://tim-streams.com/api/channels",
          parseTimChannels,
        ),
      ]
    : []),
];
