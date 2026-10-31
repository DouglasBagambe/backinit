import { afterEach, expect, it, vi } from "vitest";
import { SportsService } from "../apps/api/src/providers/service";
import { OfficialBroadcastProvider } from "../apps/api/src/providers/official-broadcasts";
import { OpenLigaProvider } from "../apps/api/src/providers/openliga";
import { JolpicaProvider } from "../apps/api/src/providers/jolpica";
import {
  EflProvider,
  verifiedCupFixtures,
} from "../apps/api/src/providers/efl";
import { WweProvider } from "../apps/api/src/providers/wwe";
import { EspnProvider } from "../apps/api/src/providers/espn";
import { freshEventFeed } from "../packages/domain/src/index";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

it("returns healthy football when channel discovery never settles, with explicit unavailable coverage", async () => {
  vi.useFakeTimers();
  vi.stubEnv("SPORTS_PROVIDERS_DISABLED", "false");
  const empty = {
    value: [],
    fetchedAt: new Date().toISOString(),
    stale: false,
  };
  for (const Provider of [
    OpenLigaProvider,
    JolpicaProvider,
    EflProvider,
    WweProvider,
  ])
    vi.spyOn(Provider.prototype, "events").mockResolvedValue(empty);
  vi.spyOn(OfficialBroadcastProvider.prototype, "events").mockImplementation(
    () => new Promise(() => {}),
  );
  const match = verifiedCupFixtures[0]!;
  vi.spyOn(EspnProvider.prototype, "events").mockImplementation(
    async (league) => ({
      ...empty,
      value: league.path === "soccer/eng.1" ? [match] : [],
    }),
  );
  const request = new SportsService().feed("real", "2026-10-31");
  await vi.advanceTimersByTimeAsync(10001);
  const result = await request;
  expect(result.data.map((e) => e.id)).toContain(match.id);
  expect(
    result.coverage.find((c) => c.provider === "ESPN:soccer/eng.1")?.status,
  ).toBe("available");
  const channels = result.coverage.filter((c) => c.provider.includes("FIBA"));
  expect(channels.length).toBeGreaterThan(0);
  expect(channels.every((c) => c.status === "unavailable")).toBe(true);
  expect(vi.getTimerCount()).toBe(0);
});

it("coalesces catalogue requests and serves an independent recent snapshot while a refresh is slow", async () => {
  vi.useFakeTimers();
  vi.stubEnv("SPORTS_PROVIDERS_DISABLED", "false");
  const empty = {
    value: [],
    fetchedAt: new Date().toISOString(),
    stale: false,
  };
  for (const Provider of [
    OpenLigaProvider,
    JolpicaProvider,
    EflProvider,
    WweProvider,
    OfficialBroadcastProvider,
  ])
    vi.spyOn(Provider.prototype, "events").mockResolvedValue(empty);
  let stalled = false;
  const espn = vi
    .spyOn(EspnProvider.prototype, "events")
    .mockImplementation(async () =>
      stalled ? await new Promise(() => {}) : empty,
    );
  const service = new SportsService();
  const [first, second] = await Promise.all([
    service.feed("real"),
    service.feed("real"),
  ]);
  const initialCalls = espn.mock.calls.length;
  first.coverage.splice(0);
  expect(second.coverage.length).toBeGreaterThan(0);
  await service.feed("real");
  expect(espn.mock.calls.length).toBe(initialCalls);
  stalled = true;
  await vi.advanceTimersByTimeAsync(11000);
  const cached = await service.feed("real");
  expect(cached.coverage.length).toBeGreaterThan(0);
  expect(espn.mock.calls.length).toBe(initialCalls * 2);
  await vi.advanceTimersByTimeAsync(11000);
  expect(vi.getTimerCount()).toBe(0);
});

it("preserves scores but expires stale live status when a cached source is over one minute old", () => {
  const event = {
    ...verifiedCupFixtures[0]!,
    status: "live" as const,
    source: {
      ...verifiedCupFixtures[0]!.source!,
      fetchedAt: "2026-10-31T12:00:00Z",
      stale: false,
    },
  };
  const source = {
    data: [event],
    source: "Test",
    coverage: [],
    edition: "real" as const,
  };
  const expired = freshEventFeed(source, Date.parse("2026-10-31T12:01:01Z"));
  expect(expired.data[0]).toMatchObject({
    status: "unknown",
    source: { stale: true },
  });
  expect(source.data[0]?.status).toBe("live");
});
