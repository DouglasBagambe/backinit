import { it, expect, vi, afterEach } from "vitest";
const { feed } = vi.hoisted(() => ({ feed: vi.fn() }));
vi.mock("@backinit/news", () => ({
  NewsService: class {
    feed = feed;
  },
}));
import { GET } from "../apps/web/app/api/news/route";
const snapshot = {
  data: [
    {
      title: "Reported sports headline",
      url: "https://www.bbc.com/sport/football/fixture",
      publishedAt: "2026-11-01T01:00:00Z",
      source: "BBC Sport",
      category: "Sport",
      dateKind: "indexed",
    },
  ],
  status: "available",
  message: "GDELT index",
  fetchedAt: "2026-11-01T01:01:00Z",
  attribution: { name: "GDELT Project", url: "https://www.gdeltproject.org/" },
};
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});
it("serves website-host news without waiting on the unavailable sports backend", async () => {
  feed.mockResolvedValue(snapshot);
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  const response = await GET();
  expect(response.status).toBe(200);
  expect((await response.json()).data).toHaveLength(1);
  expect(fetcher).not.toHaveBeenCalled();
});
it("uses the backend snapshot if the web host cannot reach the index", async () => {
  feed.mockResolvedValue({
    data: [],
    status: "unavailable",
    message: "Offline",
    fetchedAt: null,
  });
  const fetcher = vi.fn().mockResolvedValue(Response.json(snapshot));
  vi.stubGlobal("fetch", fetcher);
  const response = await GET();
  expect((await response.json()).data[0].title).toBe(snapshot.data[0].title);
  expect(fetcher).toHaveBeenCalledOnce();
});
