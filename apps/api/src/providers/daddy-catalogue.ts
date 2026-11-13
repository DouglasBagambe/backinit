import { readFile, writeFile, mkdir, stat } from "node:fs/promises";
import { dirname } from "node:path";
import {
  FileBroadcastSnapshot,
  type BroadcastSnapshot,
} from "./broadcast-snapshot.js";
import type {
  Broadcast,
  BroadcastFeed,
} from "../../../../packages/domain/src/index.js";
import { channelArtworkCatalogue, findChannelLogo } from "./channel-artwork.js";
import { externalId } from "./additional-catalogues.js";
const origin = "https://thedaddy.li";
const sports =
  /\b(?:sports?|e-?sports|gaming|espn\d*|bein|dazn|eurosport|tennis|cricket|willow|golf|racing|nba|nfl|nhl|mlb|motogp|f1|wwe|ufc|fight|boxing|rugby|football|futbol|soccer|premier|laliga|ligue|bundesliga|rally|nascar|supercars|athletics|cycling|snooker|billiard|padel|futsal|hockey)\b/i;
function text(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&#(?:39|039);/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, " ")
    .trim();
}
export function daddyChannels(html: string) {
  const channels = new Map<
    string,
    { id: string; name: string; pageUrl: string }
  >();
  for (const match of html.matchAll(
    /<a\b[^>]*href="(\/watch\.php\?id=(\d+))"[^>]*>\s*<div class="card__title">([^<]+)<\/div>/g,
  )) {
    const name = text(match[3]!);
    if (sports.test(name) && name.length <= 200)
      channels.set(match[2]!, {
        id: match[2]!,
        name,
        pageUrl: origin + match[1],
      });
  }
  return [...channels.values()];
}
export function daddyFrame(
  html: string,
  kind: "page" | "player",
): string | null {
  for (const match of html.matchAll(/<iframe\b[^>]*\bsrc=["']([^"']+)["']/gi)) {
    try {
      const url = new URL(text(match[1]!));
      if (url.protocol !== "https:" || url.username || url.password || url.port)
        continue;
      if (
        kind === "page" &&
        url.hostname === "thedaddy.li" &&
        /^\/stream\/stream-\d+\.php$/.test(url.pathname)
      )
        return url.href;
      if (
        kind === "player" &&
        url.hostname === "dembed.st" &&
        url.pathname === "/premiumtv/daddy.php" &&
        /^\d+$/.test(url.searchParams.get("id") || "")
      )
        return url.href;
    } catch {}
  }
  return null;
}
export function daddySport(name: string) {
  if (/e-?sports|gaming/i.test(name)) return "Esports";
  if (/\brugby\b/i.test(name)) return "Rugby";
  if (/\b(?:snooker|billiard)\b/i.test(name)) return "Snooker";
  if (/\bdarts\b/i.test(name)) return "Darts";
  if (/tennis|padel/i.test(name)) return "Tennis";
  if (/cricket|willow/i.test(name)) return "Cricket";
  if (/\b(?:f1|motogp|rally|nascar|racing|motor)\b/i.test(name))
    return "Motorsport";
  if (/\bwwe\b/i.test(name)) return "Wrestling";
  if (/\b(?:ufc|fight|boxing)\b/i.test(name)) return "Combat Sports";
  if (/\b(?:nba|basketball)\b/i.test(name)) return "Basketball";
  if (/\b(?:nfl|redzone)\b/i.test(name)) return "American Football";
  if (/\b(?:nhl|hockey)\b/i.test(name)) return "Ice Hockey";
  if (/\b(?:football|soccer|futbol|laliga|ligue|bundesliga)\b/i.test(name))
    return "Football";
  if (/\bgolf\b/i.test(name)) return "Golf";
  return "Sports";
}
export function channelArtworkKey(name: string) {
  return name
    .toLowerCase()
    .replace(/\b(?:uk|usa?|united kingdom|united states)\b/g, "")
    .replace(/[^a-z0-9]/g, "");
}
export function channelArtwork(raw: unknown) {
  const result = new Map<string, string>();
  if (
    !raw ||
    typeof raw !== "object" ||
    !("channels" in raw) ||
    !Array.isArray(raw.channels)
  )
    return result;
  for (const c of raw.channels) {
    if (
      !c ||
      c.genre !== 2 ||
      typeof c.name !== "string" ||
      typeof c.logo !== "string"
    )
      continue;
    try {
      const u = new URL(c.logo);
      if (
        u.protocol === "https:" &&
        !u.username &&
        !u.password &&
        !u.port &&
        /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(u.hostname) &&
        !/\.(?:local|localhost|internal)$/i.test(u.hostname)
      )
        result.set(channelArtworkKey(c.name), u.href);
    } catch {}
  }
  return result;
}
export class DaddyCatalogue {
  readonly idPrefix = "ext-daddy-";
  private data = new Map<string, Broadcast>();
  private pending: Promise<void> | null = null;
  private checkedAt = -Infinity;
  private updatedAt: string | null = null;
  private failed = false;
  private hydration: Promise<void> | null = null;
  private nextArtworkRefresh = 0;
  private writes = Promise.resolve();
  constructor(
    private fetcher: typeof fetch = fetch,
    private snapshot?: BroadcastSnapshot,
    private directoryPath?: string,
    private withArtwork = false,
  ) {}
  private async directory() {
    if (this.directoryPath) {
      try {
        const info = await stat(this.directoryPath);
        if (info.size <= 1500000 && Date.now() - info.mtimeMs <= 3600000) {
          const cached = await readFile(this.directoryPath, "utf8");
          if (daddyChannels(cached).length) return cached;
        }
      } catch {}
    }
    const html = await this.html(origin + "/24-7-channels.php");
    if (!daddyChannels(html).length) throw Error("Channel directory changed");
    if (this.directoryPath) {
      await mkdir(dirname(this.directoryPath), { recursive: true }).catch(
        () => {},
      );
      await writeFile(this.directoryPath, html).catch(() => {});
    }
    return html;
  }
  private async artwork() {
    if (!this.withArtwork) return new Map<string, string>();
    const path = this.directoryPath
      ? `${this.directoryPath}.artwork.json`
      : null;
    if (path) {
      try {
        const info = await stat(path);
        if (info.size < 1500000 && Date.now() - info.mtimeMs < 86400000)
          return channelArtwork(JSON.parse(await readFile(path, "utf8")));
      } catch {}
    }
    try {
      const raw = await this.html("https://tim-streams.com/api/channels");
      const map = channelArtwork(JSON.parse(raw));
      if (path && map.size) await writeFile(path, raw).catch(() => {});
      return map;
    } catch {
      return new Map<string, string>();
    }
  }
  private persist() {
    const feed: BroadcastFeed = {
      data: [...this.data.values()],
      updatedAt: this.updatedAt,
      stale: this.failed,
    };
    this.writes = this.writes.then(async () => {
      await this.snapshot?.write(feed).catch(() => {});
    });
  }
  private async html(url: string) {
    const r = await this.fetcher(url, {
      signal: AbortSignal.timeout(45000),
      redirect: "error",
      cache: "no-store",
    });
    if (!r.ok) throw Error("Channel page unavailable");
    const reader = r.body?.getReader();
    if (!reader) throw Error("Empty response");
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > 1500000) throw Error("Page too large");
        chunks.push(value);
      }
    } finally {
      await reader.cancel().catch(() => {});
    }
    return Buffer.concat(chunks).toString("utf8");
  }
  async feed(): Promise<BroadcastFeed> {
    if (!this.hydration)
      this.hydration = (async () => {
        const saved = await this.snapshot?.read().catch(() => null);
        if (saved) {
          for (const b of saved.data) {
            if (
              b.id.startsWith("ext-daddy-") &&
              b.channel &&
              b.sources.every(
                (s) =>
                  daddyFrame(`<iframe src="${s.url}"></iframe>`, "player") ===
                  s.url,
              )
            )
              this.data.set(b.pageUrl, b);
          }
          this.updatedAt = saved.updatedAt;
          this.failed = true;
        }
      })();
    await this.hydration;
    if (this.withArtwork && Date.now() >= this.nextArtworkRefresh) {
      this.nextArtworkRefresh = Date.now() + 3600000;
      void Promise.all([this.artwork(), channelArtworkCatalogue.load()])
        .then(([art, index]) => {
          let changed = false;
          for (const [key, b] of this.data) {
            const url =
              findChannelLogo(index, b.title) ||
              art.get(channelArtworkKey(b.title));
            if (url && url !== b.poster) {
              this.data.set(key, { ...b, poster: url });
              changed = true;
            }
          }
          if (changed) this.persist();
        })
        .catch(() => {});
    }

    if (
      !this.pending &&
      Date.now() - this.checkedAt > (this.failed ? 60000 : 3600000)
    )
      this.pending = this.refresh().finally(() => {
        this.pending = null;
        this.checkedAt = Date.now();
      });
    return {
      data: [...this.data.values()],
      updatedAt: this.updatedAt,
      stale: this.failed || !this.updatedAt,
    };
  }
  private async refresh() {
    try {
      const [directory, artwork, logoDirectory] = await Promise.all([
        this.directory(),
        this.artwork(),
        this.withArtwork ? channelArtworkCatalogue.load() : Promise.resolve([]),
      ]);
      for (const [key, b] of this.data) {
        const logo =
          findChannelLogo(logoDirectory, b.title) ||
          artwork.get(channelArtworkKey(b.title));
        if (logo && logo !== b.poster)
          this.data.set(key, { ...b, poster: logo });
      }
      if (this.data.size) this.persist();
      const channels = daddyChannels(directory).sort((a, b) => {
        const priority = (name: string) =>
          /wwe|ufc|fight|boxing|esport|gaming|rugby|golf|racing|snooker|darts|tennis|f1/i.test(
            name,
          )
            ? 0
            : 1;
        return priority(a.name) - priority(b.name);
      });
      if (!channels.length) throw Error("Channel directory changed");
      let next = 0,
        failures = 0;
      // Walk every published sports row with bounded concurrency, not a source-count cap.
      await Promise.all(
        Array.from({ length: 4 }, async () => {
          for (;;) {
            const channel = channels[next++];
            if (!channel) break;
            try {
              const page = daddyFrame(await this.html(channel.pageUrl), "page");
              if (!page) throw Error("Missing player page");
              const embed = daddyFrame(await this.html(page), "player");
              if (!embed) throw Error("Missing supplied embed");
              this.data.set(channel.pageUrl, {
                id: externalId("daddy", channel.id),
                title: channel.name,
                category: daddySport(channel.name),
                competition: "Sports channel",
                poster:
                  findChannelLogo(logoDirectory, channel.name) ||
                  artwork.get(channelArtworkKey(channel.name)) ||
                  null,
                start: 0,
                end: 0,
                channel: true,
                viewers: null,
                pageUrl: channel.pageUrl,
                sources: [
                  {
                    id: externalId("daddy-source", embed),
                    label: "Stream 1",
                    url: embed,
                  },
                ],
                replay: false,
              });
              this.updatedAt = new Date().toISOString();
              this.persist();
            } catch {
              failures++;
            }
            await new Promise((resolve) => setTimeout(resolve, 100));
          }
        }),
      );
      const published = new Set(channels.map((c) => c.pageUrl));
      for (const id of this.data.keys())
        if (!published.has(id)) this.data.delete(id);
      this.failed = failures > 0;
      if (this.data.size) this.persist();
    } catch {
      this.failed = true;
    }
  }
}
export const daddyCatalogue = new DaddyCatalogue(
  fetch,
  new FileBroadcastSnapshot(".data/daddy-channel-feed.json"),
  ".data/daddy-directory.html",
  true,
);
