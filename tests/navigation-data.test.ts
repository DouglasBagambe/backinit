import { afterEach, expect, it, vi } from "vitest";
import { loadPageData } from "../apps/web/app/lib/page-loader";
import { verifiedCupFixtures } from "../apps/api/src/providers/efl";
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
it("paints a known match from the catalogue without waiting for a second summary request", async () => {
  vi.stubEnv("ALLOW_DEMO_MODE", "false");
  const event = verifiedCupFixtures[0]!;
  const fetcher = vi.fn(async (input: string | URL | Request) => {
    expect(new URL(String(input)).pathname).toBe("/events");
    return Response.json({
      data: [event],
      edition: "real",
      source: "Test",
      coverage: [],
    });
  });
  vi.stubGlobal("fetch", fetcher);
  const page = await loadPageData(`watch/${event.id}`, "real");
  expect(page.feed.data[0]?.id).toBe(event.id);
  expect(fetcher).toHaveBeenCalledTimes(1);
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
