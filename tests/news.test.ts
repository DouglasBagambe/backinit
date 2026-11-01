import { it, expect, afterEach, vi } from "vitest";
import { gzipSync } from "node:zlib";
import {
  parseNews,
  parseGdeltNews,
  parseGdeltRss,
  NewsService,
} from "../apps/api/src/providers/news";
it("deduplicates canonical publisher links, validates dates and excludes injected URLs", () => {
  const item = (link: string, date = "Mon, 26 Oct 2026 10:00:00 GMT") =>
    `<item><title>Sport headline</title><link>${link}</link><pubDate>${date}</pubDate></item>`;
  const xml = `<rss><channel>${item("https://www.bbc.co.uk/sport/example?utm=one")}${item("https://www.bbc.co.uk/sport/example?utm=two")}${item("https://evil.test/tracker")}${item("not a url")}${item("https://www.bbc.co.uk/sport/other", "invalid")}</channel></rss>`;
  expect(parseNews(xml)).toEqual([
    {
      title: "Sport headline",
      url: "https://www.bbc.co.uk/sport/example",
      publishedAt: "2026-10-26T10:00:00.000Z",
      source: "BBC Sport",
      category: "Sport",
    },
  ]);
  expect(() =>
    parseNews('<!DOCTYPE rss [<!ENTITY x SYSTEM "file:///etc/passwd">]><rss/>'),
  ).toThrow();
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});
const article = (
  url = "https://www.bbc.com/sport/football/articles/example",
  title = "A real football headline",
) => ({ url, title, seendate: "20261101T010000Z" });
const rss = `<rss><channel><item><title>A real football headline</title><link>https://www.bbc.com/sport/football/articles/example</link><pubDate>1 Nov 2026 01:00:00 +0000</pubDate></item></channel></rss>`;
it("ingests a free attributed index without enabling the gated publisher feed", async () => {
  vi.setSystemTime(new Date("2026-11-01T02:00:00Z"));
  const fetcher = vi.fn(async () => new Response(rss));
  const { ProviderCache } = await import("../apps/api/src/providers/cache");
  const feed = await new NewsService(new ProviderCache(fetcher)).feed();
  expect(feed.status).toBe("available");
  expect(feed.data[0]?.source).toBe("BBC Sport");
  expect(feed.data[0]?.dateKind).toBe("indexed");
  expect(feed.attribution?.name).toBe("GDELT Project");
  expect(fetcher.mock.calls[0]?.[0]).toContain("gdeltv3/gal/feed.rss");
  expect(fetcher.mock.calls[0]?.[0]).toContain(
    "https://storage.googleapis.com/data.gdeltproject.org/",
  );
});
it("rejects untrusted publishers, non-sport paths, stale/future dates and duplicate titles", () => {
  const now = Date.parse("2026-11-01T02:00:00Z");
  const data = parseGdeltNews(
    {
      articles: [
        article(),
        article(
          "https://www.bbc.com/sport/football/articles/example?utm_source=copy",
        ),
        article("https://www.bbc.com/news/politics"),
        article("https://www.bbc.com.evil.test/sport/football/foo"),
        article("javascript:alert(1)"),
        { ...article(), seendate: "20200101T000000Z" },
        { ...article(), seendate: "20270101T000000Z" },
      ],
    },
    now,
  );
  expect(data).toHaveLength(1);
  expect(data[0]?.url).toBe(
    "https://www.bbc.com/sport/football/articles/example",
  );
});
it("keeps a readable snapshot while a refresh fails and avoids repeated failing requests", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-01T02:00:00Z"));
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(new Response(rss))
    .mockRejectedValue(new Error("Provider offline"));
  const { ProviderCache } = await import("../apps/api/src/providers/cache");
  const service = new NewsService(new ProviderCache(fetcher, () => Date.now()));
  const first = await service.feed();
  vi.setSystemTime(new Date("2026-11-01T02:16:00Z"));
  expect((await service.feed()).status).toBe("stale");
  await vi.advanceTimersByTimeAsync(1);
  expect((await service.feed()).data).toEqual(first.data);
  const calls = fetcher.mock.calls.length;
  await service.feed();
  expect(fetcher).toHaveBeenCalledTimes(calls);
  expect(calls).toBeLessThanOrEqual(11);
});

it("uses the query index when the bulk feed is unavailable", async () => {
  vi.setSystemTime(new Date("2026-11-01T02:00:00Z"));
  const xml = `<rss><channel><item><title>Athlete &amp; team news</title><link>https://www.yardbarker.com/nfl/articles/fixture</link><pubDate>1 Nov 2026 01:30:00 +0000</pubDate></item></channel></rss>`;
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(
      new Response("Rate limited", {
        status: 429,
        headers: { "Retry-After": "60" },
      }),
    )
    .mockImplementation(async (url: string) => {
      if (url.endsWith(".gz")) throw new Error("Archive not available");
      return Response.json({ articles: [article()] });
    });
  const { ProviderCache } = await import("../apps/api/src/providers/cache");
  const feed = await new NewsService(new ProviderCache(fetcher)).feed();
  expect(feed.status).toBe("available");
  expect(feed.data[0]?.source).toBe("BBC Sport");
  expect(parseGdeltRss(xml)[0]?.title).toBe("Athlete & team news");
  expect(fetcher.mock.calls.at(-1)?.[0]).toContain("api.gdeltproject.org");
  expect(() =>
    parseGdeltRss('<!DOCTYPE rss [<!ENTITY attack "oops">]><rss/>'),
  ).toThrow();
});

it("does not contact external news in an isolated provider-disabled environment", async () => {
  vi.stubEnv("SPORTS_PROVIDERS_DISABLED", "true");
  const fetcher = vi.fn();
  const { ProviderCache } = await import("../apps/api/src/providers/cache");
  expect(
    (await new NewsService(new ProviderCache(fetcher)).feed()).status,
  ).toBe("unavailable");
  expect(fetcher).not.toHaveBeenCalled();
});

it("fills an empty rolling feed from bounded archives while retaining publisher validation", async () => {
  vi.setSystemTime(new Date("2026-11-01T02:00:00Z"));
  const archive = gzipSync(
    [
      JSON.stringify(article()),
      JSON.stringify(article("https://evil.test/sport/fake")),
      "invalid json",
      JSON.stringify(article()),
    ].join("\n"),
  );
  const fetcher = vi.fn(async (url: string) => {
    if (url.endsWith("feed.rss")) return new Response("<rss><channel/></rss>");
    if (url.endsWith(".gz")) return new Response(archive);
    throw new Error("Query API should not be needed");
  });
  const { ProviderCache } = await import("../apps/api/src/providers/cache");
  const feed = await new NewsService(new ProviderCache(fetcher)).feed();
  expect(feed.status).toBe("available");
  expect(feed.data).toHaveLength(1);
  expect(feed.data[0].url).toBe(article().url);
  expect(feed.data[0].publishedAt).toBe("2026-11-01T01:46:00.000Z");
  expect(feed.data[0].dateKind).toBe("indexed");
  expect(fetcher).toHaveBeenCalledTimes(9);
  expect(
    fetcher.mock.calls.some(([url]) => url.includes("api.gdeltproject.org")),
  ).toBe(false);
});

it("can await an in-flight snapshot refresh until new headlines are committed", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-01T02:00:00Z"));
  let release!: (value: Response) => void;
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(new Response(rss))
    .mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          release = resolve;
        }),
    );
  const { ProviderCache } = await import("../apps/api/src/providers/cache");
  const service = new NewsService(new ProviderCache(fetcher, () => Date.now()));
  await service.feed();
  vi.setSystemTime(new Date("2026-11-01T02:16:00Z"));
  expect((await service.feed()).status).toBe("stale");
  let completed = false;
  const refreshed = service.feed({ waitForRefresh: true }).then((value) => {
    completed = true;
    return value;
  });
  await Promise.resolve();
  expect(completed).toBe(false);
  release(
    new Response(
      rss.replace(
        "A real football headline",
        "Newly indexed football headline",
      ),
    ),
  );
  expect((await refreshed).data[0]?.title).toBe(
    "Newly indexed football headline",
  );
  expect((await service.feed()).status).toBe("available");
  expect(fetcher).toHaveBeenCalledTimes(2);
});

it("tries fresh archives rather than stopping at an old cached RSS snapshot", async () => {
  vi.setSystemTime(new Date("2026-11-01T02:00:00Z"));
  let offline = false;
  const archive = gzipSync(
    JSON.stringify(article(undefined, "Current archive headline")),
  );
  const fetcher = vi.fn(async (url: string) => {
    if (url.endsWith("feed.rss")) {
      if (offline) throw new Error("RSS temporarily unavailable");
      return new Response(rss);
    }
    if (url.endsWith(".gz")) return new Response(archive);
    throw new Error("Unexpected fallback");
  });
  const { ProviderCache } = await import("../apps/api/src/providers/cache");
  const service = new NewsService(new ProviderCache(fetcher, () => Date.now()));
  await service.feed();
  offline = true;
  vi.setSystemTime(new Date("2026-11-01T02:16:00Z"));
  const result = await service.feed({ waitForRefresh: true });
  expect(result.status).toBe("available");
  expect(result.data[0]?.title).toBe("Current archive headline");
  expect(fetcher.mock.calls.some(([url]) => url.endsWith(".gz"))).toBe(true);
});
