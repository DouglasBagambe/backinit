import { afterEach, expect, it, vi } from "vitest";
import { MatchTrackerProvider } from "../apps/api/src/providers/match-tracker";
import { SportsService } from "../apps/api/src/providers/service";
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
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
it("binds a verified full-name alias without accepting arbitrary surname prefixes", async () => {
  const alcaraz = { ...event, home: "Daniil Medvedev", away: "Carlos Alcaraz" };
  const vendor = {
    ...row,
    home: "Daniil Medvedev",
    away: "Carlos Alcaraz Garfia",
  };
  const data = {
    sport: "tennis",
    updated: new Date(at).toISOString(),
    match: { ...vendor, tracker: { id: "id", sport: "tennis" } },
  };
  expect(
    await fixture({ rows: [vendor], data }).provider.forEvent(alcaraz),
  ).not.toBeNull();
  expect(
    await fixture({
      rows: [{ ...vendor, away: "Carlos Alcaraz Junior" }],
      data,
    }).provider.forEvent(alcaraz),
  ).toBeNull();
});
it("finds a missing live game through the exact publisher team and still validates both participants and kickoff", async () => {
  const bologna = {
    ...event,
    sport: "Football" as const,
    home: "Bologna",
    away: "Monza",
  };
  const vendor = {
    ...row,
    home: "Bologna",
    away: "Monza",
    url: "/football/match/monza-vs-bologna/vendorid/",
  };
  let duplicateTeam = false;
  let wrongOpponent = false;
  const fetcher = vi.fn(async (input: string | URL | Request) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith("/search/"))
      return Response.json({
        sport: "football",
        teams: duplicateTeam
          ? [
              { name: "Bologna", slug: "bologna" },
              { name: "Bologna", slug: "other" },
            ]
          : [
              { name: "Bologna", slug: "bologna" },
              { name: "Bologna U19", slug: "bologna-u19" },
            ],
      });
    if (url.pathname.endsWith("/fixtures/"))
      return Response.json({
        sport: "football",
        matches:
          url.searchParams.get("team") === "bologna"
            ? [{ ...vendor, away: wrongOpponent ? "Another club" : "Monza" }]
            : [],
      });
    return Response.json({
      sport: "football",
      updated: new Date(at).toISOString(),
      match: { ...vendor, tracker: { id: "id", sport: "football" } },
    });
  });
  const resolve = () =>
    new MatchTrackerProvider(
      new ProviderCache(fetcher as typeof fetch, () => at),
      () => at,
    ).forEvent(bologna);
  expect(await resolve()).toMatchObject({
    url: "https://sportscore.com/embed/tracker/football/monza-vs-bologna/",
  });
  expect(fetcher.mock.calls).toHaveLength(4);
  duplicateTeam = true;
  expect(await resolve()).toBeNull();
  duplicateTeam = false;
  wrongOpponent = true;
  expect(await resolve()).toBeNull();
});
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
  // The unfiltered daily list truncates before major afternoon fixtures.
  const discovery = new URL(String(fetcher.mock.calls[0]![0]));
  expect(discovery.searchParams.get("status")).toBe("live");
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

it("matches delayed tennis court schedules only on the same day and without ambiguity", async () => {
  const delayed = { ...row, time: "2026-10-30T13:25:00Z" };
  expect(
    await fixture({ rows: [delayed], detail: delayed }).provider.forEvent(
      event,
    ),
  ).not.toBeNull();
  for (const rows of [
    [{ ...row, time: "2026-10-30T16:00:00Z" }],
    [row, delayed],
  ])
    expect(await fixture({ rows }).provider.forEvent(event)).toBeNull();
  const nearMidnight = { ...event, start: "2026-10-30T00:30:00Z" };
  expect(
    await fixture({
      rows: [{ ...row, time: "2026-10-29T23:50:00Z" }],
    }).provider.forEvent(nearMidnight),
  ).toBeNull();
});

it("resolves a tracker from its league scoreboard without waiting for unrelated sports or the unsupported tennis summary", async () => {
  const fetcher = vi.fn(async (_input: string | URL | Request) =>
    Response.json({
      leagues: [{ name: "ATP Vienna" }],
      events: [
        {
          id: "42",
          name: "Berrettini vs de Minaur",
          date: "2026-10-30T19:00:00Z",
          competitions: [
            {
              id: "42",
              date: "2026-10-30T19:00:00Z",
              status: { type: { state: "in", name: "STATUS_IN_PROGRESS" } },
              competitors: [
                {
                  id: "1",
                  homeAway: "home",
                  athlete: { displayName: "Matteo Berrettini" },
                },
                {
                  id: "2",
                  homeAway: "away",
                  athlete: { displayName: "Alex de Minaur" },
                },
              ],
            },
          ],
        },
      ],
    }),
  );
  vi.stubGlobal("fetch", fetcher);
  const service = new SportsService();
  expect(await service.trackerFixture("espn-tennis-atp-42")).toMatchObject({
    id: "espn-tennis-atp-42",
    home: "Matteo Berrettini",
    away: "Alex de Minaur",
    status: "live",
  });
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(String(fetcher.mock.calls[0]?.[0])).toMatch(
    /^https:\/\/site.api.espn.com\/apis\/site\/v2\/sports\/tennis\/atp\/scoreboard\?limit=500&dates=\d{8}-\d{8}$/,
  );
  expect(
    await service.trackerFixture("espn-invalid-league-42"),
  ).toBeUndefined();
  expect(
    await service.trackerFixture("espn-tennis-atp-not-a-number"),
  ).toBeUndefined();
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it("keeps viewed tennis matches independent of unrelated catalogue failures and unsupported summary endpoints", async () => {
  const fetcher = vi.fn(async (input: string | URL | Request) => {
    expect(String(input)).toContain("/tennis/atp/scoreboard?");
    return Response.json({
      leagues: [{ name: "ATP Paris" }],
      events: [
        {
          id: "42",
          name: "A vs B",
          date: new Date().toISOString(),
          competitions: [
            {
              id: "42",
              date: new Date().toISOString(),
              status: { type: { state: "in", name: "STATUS_IN_PROGRESS" } },
              competitors: [
                {
                  id: "1",
                  homeAway: "home",
                  athlete: { displayName: "Player A" },
                },
                {
                  id: "2",
                  homeAway: "away",
                  athlete: { displayName: "Player B" },
                },
              ],
            },
          ],
        },
      ],
    });
  });
  vi.stubGlobal("fetch", fetcher);
  const service = new SportsService();
  const first = await service.event("espn-tennis-atp-42", "real");
  expect(first).toMatchObject({
    status: "live",
    home: "Player A",
    away: "Player B",
  });
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(await service.event("espn-tennis-atp-42", "real")).toMatchObject({
    status: "live",
  });
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it("loads a viewed football match from one day rather than waiting for eight schedule days", async () => {
  const fetcher = vi.fn(async () =>
    Response.json({
      leagues: [{ name: "Premier League" }],
      events: [
        {
          id: "42",
          name: "Home vs Away",
          date: new Date().toISOString(),
          competitions: [
            {
              id: "42",
              date: new Date().toISOString(),
              status: { type: { state: "in" } },
              competitors: [
                { id: "1", homeAway: "home", team: { displayName: "Home" } },
                { id: "2", homeAway: "away", team: { displayName: "Away" } },
              ],
            },
          ],
        },
      ],
    }),
  );
  vi.stubGlobal("fetch", fetcher);
  expect(
    await new SportsService().trackerFixture("espn-soccer-eng-1-42"),
  ).toMatchObject({ home: "Home", away: "Away" });
  expect(fetcher).toHaveBeenCalledTimes(1);
});
