import { XMLParser } from "fast-xml-parser";
import { z } from "zod";
import {
  newsItemSchema,
  type NewsFeed,
} from "../../../../packages/domain/src/index.js";
import { ProviderCache } from "./cache.js";
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
export class NewsService {
  private cache = new ProviderCache();
  async feed(): Promise<NewsFeed> {
    if (process.env.BBC_FEED_LICENSED !== "true")
      return {
        data: [],
        status: "not-configured",
        message:
          "News syndication awaits publisher permission. Product guides below are not sports reporting.",
        fetchedAt: null,
      };
    try {
      const data = await this.cache.json(
        "https://feeds.bbci.co.uk/sport/rss.xml",
        900000,
        parseNews,
        {},
        (response) => response.text(),
      );
      return {
        data: data.value,
        status: data.stale ? "stale" : "available",
        message: "From BBC Sport · headlines link to the original reporting.",
        fetchedAt: data.fetchedAt,
      };
    } catch {
      return {
        data: [],
        status: "unavailable",
        message:
          "News feed is temporarily unavailable. No fabricated headlines are substituted.",
        fetchedAt: null,
      };
    }
  }
}
