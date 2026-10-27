import { it, expect } from "vitest";
import { parseNews, NewsService } from "../apps/api/src/providers/news";
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
it("does not ingest publisher content before rights are configured", async () => {
  expect((await new NewsService().feed()).status).toBe("not-configured");
});
