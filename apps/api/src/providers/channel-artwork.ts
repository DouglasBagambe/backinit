import { mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { z } from "zod";
const channel = z.object({
  id: z.string(),
  name: z.string(),
  alt_names: z.array(z.string()).optional(),
  country: z.string(),
  is_nsfw: z.boolean().optional(),
});
const logo = z.object({
  channel: z.string(),
  in_use: z.boolean(),
  tags: z.array(z.string()).optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  url: z.string(),
});
const regions: [RegExp, string][] = [
  [/\b(?:UK|United Kingdom)\b/gi, "GB"],
  [/\b(?:USA|US|United States)\b/gi, "US"],
  [/\b(?:Italy|Italia|IT)\b/gi, "IT"],
  [/\b(?:Germany|DE)\b/gi, "DE"],
  [/\b(?:Serbia)\b/gi, "RS"],
  [/\b(?:Croatia)\b/gi, "HR"],
  [/\b(?:BiH|Bosnia)\b/gi, "BA"],
  [/\b(?:France|FR)\b/gi, "FR"],
  [/\b(?:Spain|ES)\b/gi, "ES"],
  [/\b(?:Poland|PL)\b/gi, "PL"],
  [/\b(?:Portugal|PT)\b/gi, "PT"],
  [/\b(?:UAE)\b/gi, "AE"],
  [/\b(?:Sweden)\b/gi, "SE"],
  [/\b(?:Netherlands|NL)\b/gi, "NL"],
  [/\b(?:New Zealand|NZ)\b/gi, "NZ"],
];
function key(name: string) {
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\b(?:hd|sd|fhd|uhd|4k|24\/7)\b/g, "")
    .replace(/\bsports\b/g, "sport")
    .replace(/\b(?:mena|arabic)\b/g, "")
    .replace(/[^a-z0-9]/g, "");
}
export type ChannelLogoRecord = {
  names: string[];
  country: string;
  url: string;
  score: number;
};
export function indexChannelLogos(
  channelsRaw: unknown,
  logosRaw: unknown,
): ChannelLogoRecord[] {
  if (!Array.isArray(channelsRaw) || !Array.isArray(logosRaw)) return [];
  const chosen = new Map<string, { url: string; score: number }>();
  for (const raw of logosRaw) {
    const p = logo.safeParse(raw);
    if (!p.success || !p.data.in_use) continue;
    const l = p.data;
    try {
      const u = new URL(l.url);
      if (
        u.protocol !== "https:" ||
        u.username ||
        u.password ||
        u.port ||
        !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(u.hostname)
      )
        continue;
      const score =
        (l.tags?.includes("white") ? -10 : 10) +
        (l.tags?.includes("horizontal") ? 3 : 0) +
        Math.min(l.width || 0, 1000) / 1000;
      if ((chosen.get(l.channel)?.score ?? -Infinity) < score)
        chosen.set(l.channel, { url: u.href, score });
    } catch {}
  }
  return channelsRaw.flatMap((raw) => {
    const p = channel.safeParse(raw);
    if (!p.success || p.data.is_nsfw) return [];
    const c = p.data,
      l = chosen.get(c.id);
    return l
      ? [
          {
            names: [...new Set([c.name, ...(c.alt_names || [])].map(key))],
            country: c.country === "UK" ? "GB" : c.country,
            ...l,
          },
        ]
      : [];
  });
}
export function findChannelLogo(
  index: ChannelLogoRecord[],
  name: string,
): string | null {
  let cleaned = name,
    country: string | undefined;
  for (const [pattern, code] of regions) {
    pattern.lastIndex = 0;
    if (pattern.test(cleaned)) {
      country = code;
      pattern.lastIndex = 0;
      cleaned = cleaned.replace(pattern, "");
    }
  }
  const wanted = key(cleaned);
  return (
    index
      .filter(
        (c) => c.names.includes(wanted) && (!country || c.country === country),
      )
      .sort((a, b) => b.score - a.score)[0]?.url || null
  );
}
export class ChannelArtworkCatalogue {
  private loaded: Promise<ChannelLogoRecord[]> | null = null;
  private nextRefresh = 0;
  constructor(
    private path = ".data/channel-artwork-v2.json",
    private fetcher: typeof fetch = fetch,
  ) {}
  async load() {
    if (!this.loaded || Date.now() >= this.nextRefresh) {
      this.nextRefresh = Infinity;
      this.loaded = this.read()
        .then((index) => {
          this.nextRefresh = Date.now() + 86400000;
          return index;
        })
        .catch(() => {
          this.nextRefresh = Date.now() + 60000;
          return [];
        });
    }
    return this.loaded;
  }
  private async json(url: string) {
    const r = await this.fetcher(url, {
      signal: AbortSignal.timeout(60000),
      redirect: "error",
    });
    if (!r.ok) throw Error("Artwork directory unavailable");
    const reader = r.body?.getReader();
    if (!reader) throw Error("Empty artwork directory");
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > 15000000) throw Error("Artwork directory too large");
        chunks.push(value);
      }
    } finally {
      await reader.cancel().catch(() => {});
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  }
  private async read() {
    try {
      const info = await stat(this.path);
      if (info.size <= 10000000 && Date.now() - info.mtimeMs < 86400000) {
        const cached = z
          .array(
            z.object({
              names: z.array(z.string()),
              country: z.string(),
              url: z.string().url(),
              score: z.number(),
            }),
          )
          .parse(JSON.parse(await readFile(this.path, "utf8")));
        return cached;
      }
    } catch {}
    const [channels, logos] = await Promise.all([
      this.json("https://iptv-org.github.io/api/channels.json"),
      this.json("https://iptv-org.github.io/api/logos.json"),
    ]);
    const index = indexChannelLogos(channels, logos);
    if (!index.length) throw Error("Missing artwork entries");
    await mkdir(dirname(this.path), { recursive: true }).catch(() => {});
    await writeFile(this.path + ".tmp", JSON.stringify(index))
      .then(() => rename(this.path + ".tmp", this.path))
      .catch(() => {});
    return index;
  }
}
export const channelArtworkCatalogue = new ChannelArtworkCatalogue();
