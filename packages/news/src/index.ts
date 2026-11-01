/** Single-process bounded cache. Deduplicates in-flight loads, honors Retry-After,
 * serves explicitly stale snapshots for at most 24h, never stores failures as data.
 * A shared cache/ingester is required before running multiple API replicas. */
export class ProviderCache {
  private entries = new Map<string, { value: unknown; fetchedAt: number }>();
  private pending = new Map<string, Promise<unknown>>();
  private blockedUntil = new Map<string, number>();
  constructor(
    private readonly fetcher: typeof fetch = fetch,
    private readonly now = Date.now,
    private readonly timeout = 8000,
  ) {}
  async json<T>(
    url: string,
    ttl: number,
    parse: (raw: unknown) => T,
    headers: Record<string, string> = {},
    read: (response: Response) => Promise<unknown> = (response) =>
      response.json(),
  ) {
    const old = this.entries.get(url);
    const wrap = (value: T, at: number, stale: boolean) => ({
      value,
      fetchedAt: new Date(at).toISOString(),
      stale,
    });
    if (old && this.now() - old.fetchedAt < ttl)
      return wrap(old.value as T, old.fetchedAt, false);
    try {
      if ((this.blockedUntil.get(new URL(url).host) ?? 0) > this.now())
        throw new Error("Provider cooling down");
      let task = this.pending.get(url);
      if (!task) {
        task = (async () => {
          const response = await this.fetcher(url, {
            headers: {
              "User-Agent":
                "BackInIt/0.2 (+https://github.com/DouglasBagambe/backinit)",
              ...headers,
            },
            signal: AbortSignal.timeout(this.timeout),
            redirect: "error",
          });
          if (!response.ok) {
            const retry = response.headers.get("retry-after");
            const seconds =
              retry && /^\d+$/.test(retry)
                ? Number(retry) * 1000
                : retry
                  ? Date.parse(retry) - this.now()
                  : 60000;
            if (response.status === 429 || response.status >= 500)
              this.blockedUntil.set(
                new URL(url).host,
                this.now() +
                  Math.min(
                    3600000,
                    Math.max(60000, Number.isFinite(seconds) ? seconds : 60000),
                  ),
              );
            throw new Error(`Provider HTTP ${response.status}`);
          }
          const data = parse(await read(response));
          if (this.entries.size >= 64 && !this.entries.has(url))
            this.entries.delete(this.entries.keys().next().value!);
          this.entries.set(url, { value: data, fetchedAt: this.now() });
          return data;
        })();
        this.pending.set(url, task);
        void task.finally(() => this.pending.delete(url)).catch(() => {});
      }
      const data = (await task) as T;
      return wrap(data, this.entries.get(url)!.fetchedAt, false);
    } catch (error) {
      if (old && this.now() - old.fetchedAt <= 86400000)
        return wrap(old.value as T, old.fetchedAt, true);
      throw error;
    }
  }
}

import { XMLParser } from "fast-xml-parser";
import { z } from "zod";
import type { NewsFeed } from "@backinit/domain";
const newsItemSchema = z.object({
  title: z.string(),
  url: z.string().url(),
  publishedAt: z.string().datetime(),
  source: z.string(),
  category: z.string(),
  dateKind: z.enum(["published", "indexed"]).optional(),
});
const itemSchema = z.object({
  title: z.string(),
  link: z.string().url(),
  pubDate: z.string(),
});
export function parseNews(raw: unknown) {
  if (
    typeof raw !== "string" ||
    raw.length > 1024 * 1024 ||
    /<!DOCTYPE|<!ENTITY/i.test(raw)
  )
    throw new Error("Invalid feed");
  const parsed = new XMLParser({
    ignoreAttributes: true,
    processEntities: false,
  }).parse(raw);
  const items: unknown[] = Array.isArray(parsed?.rss?.channel?.item)
    ? parsed.rss.channel.item
    : parsed?.rss?.channel?.item
      ? [parsed.rss.channel.item]
      : [];
  const seen = new Set<string>();
  return items
    .slice(0, 100)
    .flatMap((item: unknown) => {
      const valid = itemSchema.safeParse(item);
      if (!valid.success) return [];
      const url = new URL(valid.data.link);
      if (url.username || url.password || url.port) return [];
      if (
        url.protocol !== "https:" ||
        !["www.bbc.co.uk", "www.bbc.com", "bbc.co.uk", "bbc.com"].includes(
          url.hostname,
        )
      )
        return [];
      url.search = "";
      url.hash = "";
      if (seen.has(url.href)) return [];
      const published = Date.parse(valid.data.pubDate);
      if (!Number.isFinite(published)) return [];
      seen.add(url.href);
      return [
        newsItemSchema.parse({
          title: valid.data.title,
          url: url.href,
          publishedAt: new Date(published).toISOString(),
          source: "BBC Sport",
          category: "Sport",
        }),
      ];
    })
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}
const publishers: Record<string, { name: string; path: RegExp }> = {
  "yardbarker.com": {
    name: "Yardbarker",
    path: /^\/(nfl|nba|wnba|mlb|nhl|soccer|tennis|golf|college_[a-z_]+)\/articles\//,
  },
  "nbcphiladelphia.com": {
    name: "NBC Sports Philadelphia",
    path: /^\/(nba|nfl|nhl|mlb|news\/sports)\//,
  },
  "nbcsports.com": {
    name: "NBC Sports",
    path: /^\/(soccer|nba|nfl|nhl|mlb|golf|tennis|olympics|nascar|motor-sports)\//,
  },
  "cbssports.com": {
    name: "CBS Sports",
    path: /^\/(soccer|nba|nfl|nhl|mlb|tennis|golf|college-[a-z-]+)\//,
  },
  "si.com": {
    name: "Sports Illustrated",
    path: /^\/(soccer|nba|nfl|nhl|mlb|tennis|golf|college|racing)\//,
  },
  "sports.yahoo.com": { name: "Yahoo Sports", path: /^\/[^?#]+/ },
  "bbc.com": { name: "BBC Sport", path: /^\/sport\// },
  "bbc.co.uk": { name: "BBC Sport", path: /^\/sport\// },
  "skysports.com": { name: "Sky Sports", path: /^\/[^?#]+/ },
  "espn.com": {
    name: "ESPN",
    path: /^\/(soccer|football|tennis|nba|wnba|nfl|nhl|mlb|cricket|rugby|f1|racing|golf|olympics|college-[a-z-]+)\//,
  },
  "theguardian.com": { name: "The Guardian", path: /^\/(sport|football)\// },
  "reuters.com": { name: "Reuters", path: /^\/sports\// },
  "olympics.com": { name: "Olympics", path: /^\/en\/news\// },
};
export function parseGdeltRss(raw: unknown) {
  if (
    typeof raw !== "string" ||
    raw.length > 4 * 1024 * 1024 ||
    /<!DOCTYPE|<!ENTITY/i.test(raw)
  )
    throw new Error("Invalid news index");
  const parsed = new XMLParser({
    ignoreAttributes: true,
    processEntities: true,
  }).parse(raw);
  const value = parsed?.rss?.channel?.item;
  const items = Array.isArray(value) ? value : value ? [value] : [];
  if (items.length > 10000) throw new Error("Invalid news index");
  const articles = items
    .flatMap((item) => {
      const value = itemSchema.safeParse(item);
      if (!value.success) return [];
      const url = new URL(value.data.link),
        publisher = publishers[url.hostname.replace(/^www\./, "")];
      const at = Date.parse(value.data.pubDate);
      if (
        !publisher ||
        !publisher.path.test(url.pathname) ||
        !Number.isFinite(at)
      )
        return [];
      return [
        {
          url: url.href,
          title: value.data.title,
          seendate: new Date(at)
            .toISOString()
            .replace(/[-:]/g, "")
            .replace(/\.\d{3}Z$/, "Z"),
        },
      ];
    })
    .slice(0, 250);
  return parseGdeltNews({ articles });
}
async function boundedFeed(response: Response) {
  if (!response.body) throw new Error("Empty news index");
  const reader = response.body.getReader(),
    decoder = new TextDecoder();
  let size = 0,
    text = "";
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > 4 * 1024 * 1024)
        throw new Error("News index exceeds size limit");
      text += decoder.decode(chunk.value, { stream: true });
    }
    return text + decoder.decode();
  } finally {
    await reader.cancel();
  }
}
const gdeltItem = z.object({
  url: z.string().url(),
  title: z.string().trim().min(5).max(500),
  seendate: z.string(),
});
export function parseGdeltNews(raw: unknown, now = Date.now()) {
  const result = z
    .object({ articles: z.array(z.unknown()).max(250).default([]) })
    .parse(raw);
  const seen = new Set<string>();
  return result.articles
    .flatMap((item) => {
      const parsed = gdeltItem.safeParse(item);
      if (!parsed.success) return [];
      const { url: link, seendate } = parsed.data,
        url = new URL(link);
      const title = parsed.data.title.replace(
        /&#(x[0-9a-f]+|[0-9]+);|&(amp|quot|apos|lt|gt|nbsp);/gi,
        (all, numeric, named) => {
          if (numeric) {
            const point =
              numeric[0].toLowerCase() === "x"
                ? parseInt(numeric.slice(1), 16)
                : Number(numeric);
            return point > 0 && point <= 0x10ffff
              ? String.fromCodePoint(point)
              : all;
          }
          return (
            (
              {
                amp: "&",
                quot: '"',
                apos: "'",
                lt: "<",
                gt: ">",
                nbsp: " ",
              } as Record<string, string>
            )[named.toLowerCase()] || all
          );
        },
      );
      const host = url.hostname.replace(/^www\./, ""),
        publisher = publishers[host];
      if (
        url.protocol !== "https:" ||
        url.username ||
        url.password ||
        url.port ||
        !publisher ||
        !publisher.path.test(url.pathname)
      )
        return [];
      const match = seendate.match(
        /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/,
      );
      if (!match) return [];
      const date = `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]}Z`,
        at = Date.parse(date);
      if (!Number.isFinite(at) || at > now + 60000 || now - at > 7 * 86400000)
        return [];
      url.hash = "";
      for (const key of [...url.searchParams.keys()])
        if (/^(utm_|fbclid|gclid)/i.test(key)) url.searchParams.delete(key);
      const identity = title.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (seen.has(url.href) || seen.has(identity)) return [];
      seen.add(url.href);
      seen.add(identity);
      return [
        newsItemSchema.parse({
          title,
          url: url.href,
          publishedAt: new Date(at).toISOString(),
          dateKind: "indexed",
          source: publisher.name,
          category: "Sport",
        }),
      ];
    })
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
    .slice(0, 24);
}
export const sportsNewsUrl =
  "https://api.gdeltproject.org/api/v2/doc/doc?" +
  new URLSearchParams({
    query:
      '(domain:espn.com OR domain:skysports.com OR domain:bbc.com OR domain:bbc.co.uk OR domain:theguardian.com OR domain:reuters.com OR domain:olympics.com) (soccer OR football OR tennis OR basketball OR cricket OR rugby OR "formula 1") sourcelang:english',
    mode: "artlist",
    format: "json",
    maxrecords: "100",
    sort: "datedesc",
    timespan: "3d",
  });
export class NewsService {
  private snapshot?: NewsFeed;
  private pending?: Promise<NewsFeed>;
  private retryAt = 0;
  constructor(
    private cache: Pick<ProviderCache, "json"> = new ProviderCache(
      fetch,
      Date.now,
      12000,
    ),
  ) {}
  async feed(): Promise<NewsFeed> {
    if (process.env.SPORTS_PROVIDERS_DISABLED === "true")
      return {
        data: [],
        status: "unavailable",
        message: "News providers are disabled in this environment.",
        fetchedAt: null,
      };
    const age = this.snapshot?.fetchedAt
      ? Date.now() - Date.parse(this.snapshot.fetchedAt)
      : Infinity;
    if (this.snapshot && age < 900000) return this.snapshot;
    if (!this.pending && Date.now() >= this.retryAt) {
      this.pending = this.refresh().finally(() => {
        this.pending = undefined;
      });
    }
    if (this.snapshot && age <= 86400000)
      return {
        ...this.snapshot,
        status: "stale",
        message: "Last available news index. Updates are temporarily delayed.",
      };
    return (
      this.pending || {
        data: [],
        status: "unavailable",
        message:
          "News updates are temporarily unavailable. Please retry shortly.",
        fetchedAt: null,
      }
    );
  }
  private async refresh(): Promise<NewsFeed> {
    try {
      const bbc = process.env.BBC_FEED_LICENSED === "true";
      const data = bbc
        ? await this.cache.json(
            "https://feeds.bbci.co.uk/sport/rss.xml",
            900000,
            parseNews,
            {},
            (r) => r.text(),
          )
        : await this.cache
            .json(
              "https://storage.googleapis.com/data.gdeltproject.org/gdeltv3/gal/feed.rss",
              300000,
              parseGdeltRss,
              {},
              boundedFeed,
            )
            .then((result) => {
              if (!result.value.length)
                throw new Error("No indexed sport headlines");
              return result;
            })
            .catch(() =>
              this.cache.json(sportsNewsUrl, 900000, parseGdeltNews),
            );
      if (!data.value.length) throw new Error("No current sport headlines");
      if (data.stale) this.retryAt = Date.now() + 60000;
      this.snapshot = {
        data: data.value,
        status: data.stale ? "stale" : "available",
        message: bbc
          ? "From BBC Sport · headlines link to the original reporting."
          : "Sports headlines indexed by GDELT. Links open the original publisher; times show when coverage was indexed.",
        fetchedAt: data.fetchedAt,
        ...(!bbc
          ? {
              attribution: {
                name: "GDELT Project",
                url: "https://www.gdeltproject.org/",
              },
            }
          : {}),
      };
      return this.snapshot;
    } catch (error) {
      // Provider failures are observable without logging request URLs or data.
      console.warn(
        "Sports news refresh failed:",
        error instanceof Error
          ? error.message.slice(0, 160)
          : "provider unavailable",
      );
      this.retryAt = Date.now() + 60000;
      return this.snapshot
        ? {
            ...this.snapshot,
            status: "stale",
            message:
              "Last available news index. Updates are temporarily delayed.",
          }
        : {
            data: [],
            status: "unavailable",
            message:
              "News updates are temporarily unavailable. Please retry shortly.",
            fetchedAt: null,
          };
    }
  }
}
