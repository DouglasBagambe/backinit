import { afterEach, expect, it, vi } from "vitest";
import { MatchTrackerProvider } from "../apps/api/src/providers/match-tracker";
import { ProviderCache } from "../apps/api/src/providers/cache";
import { eventSchema, trackerSourceSchema } from "../packages/domain/src/index";
const at = Date.parse("2026-10-30T13:00:00Z");
const event = eventSchema.parse({
  id: "espn-tennis-atp-185201",
  sport: "Tennis",
  competition: "ATP Vienna",
  start: "2026-10-30T12:40:00Z",
  kind: "score",
  clock: "1st",
  home: "Adrian Mannarino",
  away: "Daniil Medvedev",
  homeScore: null,
  awayScore: null,
  status: "live",
  provenance: "provider",
  source: {
    provider: "Test",
    url: "https://example.test",
    license: "Test",
    fetchedAt: new Date(at).toISOString(),
    stale: false,
  },
});
const row = {
  home: event.kind === "score" ? event.home : "",
  away: event.kind === "score" ? event.away : "",
  time: event.start,
  status: "live",
  url: "/tennis/match/adrian-mannarino-vs-daniil-medvedev/",
};
function fixture(
  options: {
    rows?: unknown[];
    data?: unknown;
    detail?: Record<string, unknown>;
    fail?: boolean;
  } = {},
) {
  const fetcher = vi.fn(async (input: string | URL | Request) => {
    if (options.fail) throw new Error("Outage");
    const url = new URL(String(input));
    return Response.json(
      url.pathname === "/api/v1/fixtures/"
        ? { sport: "tennis", matches: options.rows || [row] }
        : options.data || {
            sport: "tennis",
            updated: new Date(at).toISOString(),
            match: {
              ...row,
              tracker: { id: "publisher-match", sport: "tennis" },
              ...options.detail,
            },
          },
    );
  });
  const provider = new MatchTrackerProvider(
    new ProviderCache(fetcher as typeof fetch, () => at),
    () => at,
  );
  return { provider, fetcher };
}
afterEach(() => vi.unstubAllEnvs());
it("resolves the exact match to the published embed with no upstream credentials and deduplicates", async () => {
  const { provider, fetcher } = fixture();
  const [a, b] = await Promise.all([
    provider.forEvent(event),
    provider.forEvent(event),
  ]);
  expect(a).toEqual(b);
  expect(trackerSourceSchema.parse(a).url).toBe(
    "https://sportscore.com/embed/tracker/tennis/adrian-mannarino-vs-daniil-medvedev/",
  );
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(JSON.stringify(a)).not.toMatch(/profile|uuid|thesports/);
});
it("rejects wrong participants, dates, ambiguous matches and hostile canonical URLs", async () => {
  for (const rows of [
    [{ ...row, away: "Another player" }],
    [{ ...row, time: "2026-10-29T12:40:00Z" }],
    [row, row],
    [{ ...row, url: "https://evil.test/" }],
  ])
    expect(await fixture({ rows }).provider.forEvent(event)).toBeNull();
  for (const detail of [
    { home: "Another player" },
    { url: "//evil.test/tennis/match/adrian/" },
    { status: "finished" },
    { tracker: null },
    { tracker: { id: "id", sport: "football" } },
  ])
    expect(await fixture({ detail }).provider.forEvent(event)).toBeNull();
});
it("rejects stale, expired, future and mismatched provider metadata", async () => {
  for (const data of [
    {
      sport: "tennis",
      updated: "2026-10-30T12:00:00Z",
      match: { ...row, tracker: { id: "id", sport: "tennis" } },
    },
    {
      sport: "tennis",
      updated: "2026-10-30T14:00:00Z",
      match: { ...row, tracker: { id: "id", sport: "tennis" } },
    },
    {
      sport: "football",
      updated: new Date(at).toISOString(),
      match: { ...row, tracker: { id: "id", sport: "tennis" } },
    },
  ])
    expect(await fixture({ data }).provider.forEvent(event)).toBeNull();
});
it("does not request trackers for demo records, stale sources, bare schedules or disabled ingestion", async () => {
  const { provider, fetcher } = fixture();
  for (const e of [
    { ...event, provenance: "demo" as const },
    { ...event, status: "upcoming" as const },
    { ...event, source: { ...event.source!, stale: true } },
    { ...event, scheduleOnly: true },
  ])
    expect(await provider.forEvent(e)).toBeNull();
  vi.stubEnv("SPORTS_PROVIDERS_DISABLED", "true");
  expect(await provider.forEvent(event)).toBeNull();
  expect(fetcher).not.toHaveBeenCalled();
});
it("contract never accepts arbitrary tracker frame destinations", () => {
  expect(
    trackerSourceSchema.safeParse({
      provider: "SportScore",
      eventId: event.id,
      url: "https://sportscore.com.evil.test/embed/tracker/tennis/name/",
      sourceUrl: "https://sportscore.com/",
      checkedAt: new Date(at).toISOString(),
      validUntil: new Date(at + 120000).toISOString(),
      kind: "publisher-tracker",
    }).success,
  ).toBe(false);
});
