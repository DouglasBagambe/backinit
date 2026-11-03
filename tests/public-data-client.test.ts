import { afterEach, expect, it, vi } from "vitest";
import {
  createPublicDataClient,
  eventsUrl,
} from "../apps/web/app/lib/public-data-client";
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
it("shares concurrent public requests without one departing screen aborting another", async () => {
  let release!: (value: Response) => void;
  const fetcher = vi.fn(
    () =>
      new Promise<Response>((resolve) => {
        release = resolve;
      }),
  );
  vi.stubGlobal("fetch", fetcher);
  const cache = createPublicDataClient();
  const leaving = new AbortController();
  const first = cache.read("/api/events?sport=Tennis", leaving.signal);
  const second = cache.read("/api/events?sport=Tennis");
  const rejected = expect(first).rejects.toMatchObject({ name: "AbortError" });
  leaving.abort();
  release(Response.json({ data: ["tennis"] }));
  await rejected;
  expect(await second).toEqual({ data: ["tennis"] });
  expect(await cache.read("/api/events?sport=Tennis")).toEqual({
    data: ["tennis"],
  });
  expect(fetcher).toHaveBeenCalledTimes(1);
});
it("isolates filters, expires results, and never caches private endpoints", async () => {
  vi.useFakeTimers();
  const fetcher = vi.fn(async () => Response.json({ data: [] }));
  vi.stubGlobal("fetch", fetcher);
  const cache = createPublicDataClient();
  await cache.read("/api/events?sport=Tennis");
  await cache.read("/api/events?sport=Football");
  await vi.advanceTimersByTimeAsync(10001);
  await cache.read("/api/events?sport=Tennis");
  expect(fetcher).toHaveBeenCalledTimes(3);
  await expect(cache.read("/api/account/me")).rejects.toThrow(
    "Not a public feed",
  );
  expect(
    new URL(
      eventsUrl("sport/american-football"),
      "https://example.test",
    ).searchParams.get("sport"),
  ).toBe("American football");
  const scoped = new URL(
    eventsUrl("fixtures", { sport: "Tennis", date: "2026-11-03" }),
    "https://example.test",
  );
  expect(scoped.searchParams.get("sport")).toBe("Tennis");
  expect(scoped.searchParams.get("date")).toBe("2026-11-03");
  expect(
    new URL(
      eventsUrl("sport/football", { sport: "Tennis" }),
      "https://example.test",
    ).searchParams.get("sport"),
  ).toBe("Football");
});
