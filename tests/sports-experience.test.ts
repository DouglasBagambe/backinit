import { afterEach, expect, it, vi } from "vitest";
import {
  sportsEntities,
  formationLines,
  eventScore,
  entityHref,
  isMediaEvent,
  type SportEvent,
} from "../packages/domain/src/index";
import { verifiedCupFixtures } from "../apps/api/src/providers/efl";
import { EspnProvider } from "../apps/api/src/providers/espn";
import { ProviderCache } from "../apps/api/src/providers/cache";
const event = {
  ...verifiedCupFixtures[0]!,
  kind: "score",
  home: "Liverpool",
  away: "Chelsea",
  externalId: "123",
  homeParticipant: { id: "1", name: "Liverpool", provider: "ESPN" },
  awayParticipant: { id: "2", name: "Chelsea", provider: "ESPN" },
  source: {
    provider: "ESPN:soccer/eng.league_cup",
    url: "https://www.espn.com",
    license: "Public snapshot",
    fetchedAt: new Date().toISOString(),
    stale: false,
  },
} as SportEvent;
afterEach(() => vi.unstubAllGlobals());
it("indexes tennis players as athletes, excludes video titles and deduplicates genuine entities", () => {
  const tennis = {
    ...event,
    id: "tennis",
    sport: "Tennis",
    home: "Carlos Alcaraz",
    away: "Jannik Sinner",
    competition: "ATP",
    detail: { periods: [{ label: "Set 1", home: "6", away: "4" }] },
    homeScore: null,
    awayScore: null,
  } as SportEvent;
  const media = {
    ...event,
    kind: "card",
    title: "Weekly discussion",
    bouts: [],
    competition: "Weekly discussion",
  } as SportEvent;
  const entities = sportsEntities([tennis, tennis, event, media]);
  expect(entities.filter((e) => e.name === "Carlos Alcaraz")).toEqual([
    expect.objectContaining({ kind: "athlete", sport: "Tennis" }),
  ]);
  expect(entities.some((e) => e.name === "Weekly discussion")).toBe(false);
  expect(eventScore(tennis, "home")).toBe("6");
  expect(isMediaEvent(media)).toBe(true);
  expect(entityHref("athlete", "Carlos Alcaraz", "Tennis")).toContain(
    "name=Carlos+Alcaraz",
  );
});
it("keeps player identities and supplied images when a lineup enters the directory", () => {
  const indexed = sportsEntities([
    {
      ...event,
      detail: {
        lineups: [
          {
            team: "Chelsea",
            players: [
              {
                name: "Cole Palmer",
                id: "296395",
                imageUrl:
                  "https://a.espncdn.com/i/headshots/soccer/players/full/296395.png",
              },
            ],
          },
        ],
      },
    },
  ]);
  expect(indexed.find((e) => e.name === "Cole Palmer")).toMatchObject({
    kind: "athlete",
    id: "296395",
    providerSport: "soccer",
    league: "eng.league_cup",
    image: expect.stringContaining("296395.png"),
  });
});

it("preserves supplied formations, shirt numbers, commentary, form and head-to-head scores", async () => {
  const raw = {
    rosters: [
      {
        team: { displayName: "Liverpool" },
        formation: "4-2-3-1",
        roster: [
          {
            athlete: { displayName: "Keeper" },
            position: { abbreviation: "G" },
            jersey: "1",
            formationPlace: "1",
            starter: true,
          },
        ],
      },
    ],
    commentary: [
      { sequence: 1, time: { displayValue: "90′" }, text: "Full time" },
    ],
    lastFiveGames: [
      {
        team: { displayName: "Liverpool" },
        events: [
          {
            id: "past",
            gameDate: "2026-10-20T19:00Z",
            opponent: { displayName: "Chelsea" },
            gameResult: "W",
            score: "2-1",
          },
        ],
      },
    ],
    seasonseries: [
      {
        type: "head-to-head",
        events: [
          {
            id: "h2h",
            date: "2026-01-01T12:00Z",
            competitors: [
              {
                homeAway: "home",
                score: "2",
                team: { displayName: "Liverpool" },
              },
              {
                homeAway: "away",
                score: "1",
                team: { displayName: "Chelsea" },
              },
            ],
          },
        ],
      },
    ],
  };
  const fetcher = vi.fn(async () => Response.json(raw));
  const provider = new EspnProvider(new ProviderCache(fetcher));
  const detail = await provider.detail(event);
  expect(detail?.lineups?.[0]).toMatchObject({
    formation: "4-2-3-1",
    players: [
      {
        name: "Keeper",
        jersey: "1",
        formationPlace: "1",
        position: "G",
        starter: true,
      },
    ],
  });
  expect(detail?.timeline?.[0]?.text).toBe("Full time");
  expect(detail?.form?.[0]?.matches[0]?.result).toBe("W");
  expect(detail?.headToHead?.[0]).toMatchObject({
    home: "Liverpool",
    homeScore: "2",
    awayScore: "1",
  });
});
it("does not discard match statistics when the provider omits roster arrays", async () => {
  const raw = {
    rosters: [{ team: { displayName: "Liverpool" } }],
    boxscore: {
      teams: [
        {
          team: { id: "1", displayName: "Liverpool" },
          statistics: [{ name: "shots", label: "Shots", displayValue: "10" }],
        },
        {
          team: { id: "2", displayName: "Chelsea" },
          statistics: [{ name: "shots", label: "Shots", displayValue: "6" }],
        },
      ],
      players: [
        {
          team: { displayName: "Liverpool" },
          statistics: [
            {
              athletes: [
                { athlete: { displayName: "Reported player" }, starter: true },
              ],
            },
          ],
        },
      ],
    },
  };
  const detail = await new EspnProvider(
    new ProviderCache(async () => Response.json(raw)),
  ).detail(event);
  expect(detail?.statistics).toEqual([
    { label: "Shots", home: "10", away: "6" },
  ]);
  expect(detail?.lineups?.[0]?.players[0]?.name).toBe("Reported player");
});
it("orders league standings by provider rank and rejects incomplete numeric tables", async () => {
  const stats = (rank: number) =>
    Object.entries({
      rank,
      gamesPlayed: 9,
      wins: 6,
      ties: 2,
      losses: 1,
      pointsFor: 20,
      pointsAgainst: 8,
      points: 20,
    }).map(([name, value]) => ({ name, value }));
  const raw = {
    children: [
      {
        standings: {
          entries: [
            { team: { displayName: "Second" }, stats: stats(2) },
            { team: { displayName: "First" }, stats: stats(1) },
          ],
        },
      },
    ],
  };
  const provider = new EspnProvider(
    new ProviderCache(async () => Response.json(raw)),
  );
  expect(
    (await provider.standings("eng.1")).value.rows.map((t) => t.team),
  ).toEqual(["First", "Second"]);
  await expect(provider.standings("untrusted/path")).rejects.toThrow(
    "Unsupported league",
  );
});

it("draws reported football positions rather than treating formation slots as sequential rows", () => {
  const positions = [
    "G",
    "CD-L",
    "CD-R",
    "LB",
    "RB",
    "AM",
    "LM",
    "RM",
    "F",
    "AM-L",
    "AM-R",
  ];
  const team = {
    team: "Liverpool",
    formation: "4-2-3-1",
    players: positions.map((position, i) => ({
      name: position,
      position,
      starter: true,
      formationPlace: String(i + 1),
    })),
  };
  const lines = formationLines(team)!;
  expect(lines.map((line) => line.map((p) => p.position))).toEqual([
    ["F"],
    ["AM-L", "AM", "AM-R"],
    ["LM", "RM"],
    ["LB", "CD-L", "CD-R", "RB"],
    ["G"],
  ]);
  expect(formationLines({ ...team, formation: "4-3-3" })).toBeNull();
  expect(
    formationLines({ ...team, players: team.players.slice(1) }),
  ).toBeNull();
});

it("fits mixed midfield roles to a reported 3-5-2 or 4-1-4-1 without moving defenders", () => {
  const team = (formation: string, positions: string[]) => ({
    team: "Reported team",
    formation,
    players: positions.map((position) => ({
      name: position,
      position,
      starter: true,
    })),
  });
  const parma = team("3-5-2", [
    "G",
    "CD",
    "CD-L",
    "CD-R",
    "CM-L",
    "CM-R",
    "AM",
    "LM",
    "RM",
    "CF-L",
    "CF-R",
  ]);
  expect(formationLines(parma)?.map((line) => line.length)).toEqual([
    2, 5, 3, 1,
  ]);
  expect(formationLines({ ...parma, formation: "5-3-2" })).toBeNull();
  expect(
    formationLines(
      team("4-1-4-1", [
        "G",
        "LB",
        "CD-L",
        "CD-R",
        "RB",
        "DM",
        "LM",
        "CM-L",
        "CM-R",
        "RM",
        "F",
      ]),
    )?.map((line) => line.length),
  ).toEqual([1, 4, 1, 4, 1]);
});

it("looks up players independently of match lists and retains verified provider identities", async () => {
  const { searchEntities } =
    await import("../apps/api/src/providers/entity-search");
  const fetcher = vi.fn(async (input: string | URL | Request) =>
    Response.json({
      items: String(input).includes("type=player")
        ? [
            {
              id: "296395",
              displayName: "Cole Palmer",
              type: "player",
              sport: "soccer",
              league: "eng.1",
            },
            {
              id: "bad",
              displayName: "Not sport",
              type: "team",
              sport: "entertainment",
            },
          ]
        : [],
    }),
  );
  const result = await searchEntities(
    "Cole Palmer",
    new ProviderCache(fetcher),
  );
  expect(result.data).toEqual([
    expect.objectContaining({
      id: "296395",
      name: "Cole Palmer",
      kind: "athlete",
      providerSport: "soccer",
      league: "eng.1",
      sport: "Football",
    }),
  ]);
  expect(fetcher).toHaveBeenCalledTimes(2);
});

it("player history uses only reported appearances with valid IDs and statistics", async () => {
  const { normalizeAthleteLog } =
    await import("../apps/api/src/providers/entity-search");
  const raw = {
    displayNames: ["Goals", "Assists"],
    events: {
      "123": {
        id: "123",
        gameDate: "2026-10-31T12:30:00Z",
        opponent: { displayName: "Opponent" },
        team: { id: "1", abbreviation: "TEAM" },
        homeTeamId: "2",
        awayTeamId: "1",
        homeTeamScore: "0",
        awayTeamScore: "2",
        score: "2-0",
        gameResult: "W",
      },
      "999": {
        id: "999",
        gameDate: "2026-10-20T12:00:00Z",
        opponent: { displayName: "Did not play" },
      },
    },
    seasonTypes: [
      {
        categories: [
          {
            events: [
              { eventId: "123", stats: ["1", "0"] },
              { eventId: "999", stats: ["DNP"] },
              { eventId: "missing", stats: ["1"] },
            ],
          },
        ],
      },
    ],
  };
  const rows = normalizeAthleteLog(raw, "soccer", "eng.1");
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({
    id: "espn-soccer-eng-1-123",
    score: "2–0",
    opponent: "Opponent",
    statistics: [
      { label: "Goals", value: "1" },
      { label: "Assists", value: "0" },
    ],
  });
});

it("a player biography survives a provider stats heading with no statistics array", async () => {
  const store = new ProviderCache(async (input) =>
    Response.json(
      String(input).includes("gamelog")
        ? {}
        : {
            athlete: {
              id: "777777",
              displayName: "Tennis Player",
              age: 23,
              statsSummary: { displayName: "Current season" },
            },
          },
    ),
  );
  const { athleteProfile } =
    await import("../apps/api/src/providers/entity-search");
  const result = await athleteProfile("tennis", "atp", "777777", store);
  expect(result.value.name).toBe("Tennis Player");
  expect(result.value.statistics).toBeUndefined();
  expect(result.value.appearances).toEqual([]);
});

it("US sport scoreboards include the previous venue day across UTC midnight", async () => {
  const calls: string[] = [];
  const provider = new EspnProvider(
    new ProviderCache(async (input) => {
      const url = String(input);
      calls.push(url);
      return Response.json({
        events: [
          {
            id: url.includes("dates=20261102") ? "100" : "200",
            name: "Home vs Away",
            date: url.includes("dates=20261102")
              ? "2026-11-03T03:00:00Z"
              : "2026-11-04T01:00:00Z",
            status: {
              type: {
                state: url.includes("dates=20261102") ? "in" : "pre",
                name: "STATUS_IN_PROGRESS",
              },
            },
            competitions: [
              {
                id: url.includes("dates=20261102") ? "100" : "200",
                date: "2026-11-03T03:00:00Z",
                competitors: [
                  {
                    id: "1",
                    homeAway: "home",
                    team: { displayName: "Home" },
                    score: "50",
                  },
                  {
                    id: "2",
                    homeAway: "away",
                    team: { displayName: "Away" },
                    score: "48",
                  },
                ],
              },
            ],
          },
        ],
      });
    }),
  );
  const r = await provider.events(
    { path: "basketball/nba", sport: "Basketball", label: "NBA" },
    "2026-11-03",
  );
  expect(calls.some((u) => u.includes("dates=20261102"))).toBe(true);
  expect(calls.some((u) => u.includes("dates=20261103"))).toBe(true);
  expect(r.value).toHaveLength(2);
  expect(r.value.some((e) => e.status === "live")).toBe(true);
});

it("loads players from hyphenated provider leagues without allowing URL paths", async () => {
  const { athleteProfile } =
    await import("../apps/api/src/providers/entity-search");
  const fetcher = vi.fn(async (url: string | URL | Request) =>
    String(url).endsWith("/gamelog")
      ? new Response("Not found", { status: 404 })
      : Response.json({
          athlete: { id: "123", displayName: "College player" },
        }),
  );
  const store = new ProviderCache(fetcher);
  const profile = await athleteProfile(
    "football",
    "college-football",
    "123",
    store,
  );
  expect(profile.value).toMatchObject({
    id: "123",
    sport: "American football",
  });
  expect(
    fetcher.mock.calls.some(([url]) =>
      String(url).includes("/football/college-football/athletes/123"),
    ),
  ).toBe(true);
  await expect(
    athleteProfile("football", "../nfl", "123", store),
  ).rejects.toThrow("Invalid profile");
  await expect(athleteProfile("football", "..", "123", store)).rejects.toThrow(
    "Invalid profile",
  );
});

it("preserves roster portraits and identities across flat and grouped provider rosters", async () => {
  const { teamProfile } =
    await import("../apps/api/src/providers/entity-search");
  const store = new ProviderCache(async (input) =>
    Response.json(
      String(input).endsWith("/roster")
        ? {
            athletes: [
              {
                items: [
                  {
                    id: "123",
                    displayName: "Player One",
                    jersey: "7",
                    position: { displayName: "Forward" },
                    headshot: {
                      href: "https://a.espncdn.com/i/headshots/soccer/players/full/123.png",
                    },
                  },
                ],
              },
              { id: "456", displayName: "Player Two" },
            ],
          }
        : { team: { displayName: "Chelsea" }, events: [] },
    ),
  );
  const result = await teamProfile("soccer", "eng.1", "363", store);
  expect(result.players).toEqual([
    expect.objectContaining({
      id: "123",
      name: "Player One",
      jersey: "7",
      position: "Forward",
      image: "https://a.espncdn.com/i/headshots/soccer/players/full/123.png",
    }),
    expect.objectContaining({ id: "456", name: "Player Two" }),
  ]);
});
