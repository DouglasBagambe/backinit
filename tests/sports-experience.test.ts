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
