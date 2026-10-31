import { afterEach, expect, it, vi } from "vitest";
import { loadPageData } from "../apps/web/app/lib/page-loader";
import { loadEvent, loadEvents } from "../apps/web/app/lib/feed";
import { verifiedCupFixtures } from "../apps/api/src/providers/efl";
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
it("reads live match and catalogue updates without the persistent frontend cache", async () => {
  vi.stubEnv("ALLOW_DEMO_MODE", "false");
  let score = 0;
  const fetcher = vi.fn(
    async (input: string | URL | Request, init?: RequestInit) => {
      expect(init?.cache).toBe("no-store");
      const event = {
        ...verifiedCupFixtures[0]!,
        kind: "score",
        home: "Home",
        away: "Away",
        homeScore: ++score,
        awayScore: 0,
        status: "live",
        scheduleOnly: false,
        source: {
          provider: "Test",
          url: "https://example.test",
          license: "Test",
          fetchedAt: new Date().toISOString(),
          stale: false,
        },
      };
      return Response.json(
        new URL(String(input)).pathname === "/events"
          ? { data: [event], edition: "real", source: "Test", coverage: [] }
          : event,
      );
    },
  );
  vi.stubGlobal("fetch", fetcher);
  const first = await loadEvent("test-match", "real");
  const next = await loadEvent("test-match", "real");
  expect(first?.kind === "score" && first.homeScore).toBe(1);
  expect(next?.kind === "score" && next.homeScore).toBe(2);
  const feed = await loadEvents("real");
  expect(feed.data[0]?.kind === "score" && feed.data[0].homeScore).toBe(3);
});
it("paints a known match from the catalogue without waiting for a second summary request", async () => {
  vi.stubEnv("ALLOW_DEMO_MODE", "false");
  const event = verifiedCupFixtures[0]!;
  const fetcher = vi.fn(async (input: string | URL | Request) => {
    expect(new URL(String(input)).pathname).toBe("/events");
    return Response.json({
      data: [event, { ...event, id: "another-fixture" }],
      edition: "real",
      source: "Test",
      coverage: [],
    });
  });
  vi.stubGlobal("fetch", fetcher);
  const page = await loadPageData(`watch/${event.id}`, "real");
  expect(page.feed.data[0]?.id).toBe(event.id);
  expect(page.feed.data).toHaveLength(1);
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it("lets Watch own its lightweight discovery feed without loading the entire catalogue", async () => {
  vi.stubEnv("ALLOW_DEMO_MODE", "false");
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  expect((await loadPageData("watch", "real")).feed.data).toEqual([]);
  expect(fetcher).not.toHaveBeenCalled();
});

it("does not fetch the sports catalogue before rendering News or account/utility pages", async () => {
  vi.stubEnv("ALLOW_DEMO_MODE", "false");
  const fetcher = vi.fn(async (input: string | URL | Request) => {
    expect(String(input)).toMatch(/\/news$/);
    return Response.json({
      data: [],
      status: "not-configured",
      message: "Test news",
      fetchedAt: null,
    });
  });
  vi.stubGlobal("fetch", fetcher);
  expect((await loadPageData("news", "real")).news?.message).toBe("Test news");
  expect(fetcher).toHaveBeenCalledTimes(1);
  for (const route of ["profile", "settings", "privacy", "admin", "videos"]) {
    const page = await loadPageData(route, "real");
    expect(page.feed.data).toEqual([]);
  }
  expect(fetcher).toHaveBeenCalledTimes(1);
});
