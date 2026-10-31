import { z } from "zod";
import {
  eventSchema,
  type Sport,
  type SportEvent,
  type LiveDetail,
} from "../../../../packages/domain/src/index.js";
import { ProviderCache } from "./cache.js";
import { safeTeamImage } from "./identities.js";
import { premierLeagueViewingLinks } from "./premier-league-viewing.js";

const person = z.object({
  id: z.string().optional(),
  displayName: z.string().optional(),
  fullName: z.string().optional(),
  logo: z.string().optional(),
  headshot: z.object({ href: z.string() }).optional(),
});
const competitor = z.object({
  id: z.string(),
  homeAway: z.string().optional(),
  score: z
    .union([
      z.string(),
      z.number(),
      z.object({
        value: z.number().optional(),
        displayValue: z.string().optional(),
      }),
    ])
    .optional(),
  team: person.optional(),
  athlete: person.optional(),
  roster: z.object({ displayName: z.string() }).optional(),
  linescores: z
    .array(
      z.object({
        value: z.number().optional(),
        displayValue: z.string().optional(),
        winner: z.boolean().optional(),
        period: z.number().optional(),
      }),
    )
    .optional(),
  statistics: z
    .array(
      z.object({
        name: z.string(),
        displayValue: z.string().optional(),
        abbreviation: z.string().optional(),
        label: z.string().optional(),
      }),
    )
    .optional(),
});
const statusSchema = z.object({
  displayClock: z.string().optional(),
  period: z.number().optional(),
  type: z.object({
    state: z.string(),
    name: z.string().optional(),
    detail: z.string().optional(),
    shortDetail: z.string().optional(),
  }),
});
const competition = z.object({
  id: z.string(),
  date: z.string(),
  competitors: z.array(competitor),
  status: statusSchema.optional(),
  venue: z.object({ fullName: z.string().optional() }).optional(),
  type: z
    .object({
      abbreviation: z.string().optional(),
      text: z.string().optional(),
    })
    .optional(),
});
const boardSchema = z.object({
  leagues: z.array(z.object({ name: z.string() })).optional(),
  events: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      date: z.string(),
      status: statusSchema.optional(),
      competitions: z.array(competition).optional(),
      groupings: z
        .array(z.object({ competitions: z.array(competition).optional() }))
        .optional(),
    }),
  ),
});
export type League = {
  path: string;
  sport: Sport;
  label: string;
  week?: boolean;
};
export const espnLeagueId = (path: string) => path.replace(/[^a-z0-9]+/g, "-");
export const espnLeagues: League[] = [
  { path: "hockey/nhl", sport: "Ice hockey", label: "NHL" },
  { path: "soccer/eng.league_cup", sport: "Football", label: "Carabao Cup" },
  { path: "soccer/eng.1", sport: "Football", label: "Premier League" },
  { path: "soccer/esp.1", sport: "Football", label: "La Liga" },
  { path: "soccer/ita.1", sport: "Football", label: "Serie A" },
  { path: "soccer/fra.1", sport: "Football", label: "Ligue 1" },
  {
    path: "soccer/uefa.champions",
    sport: "Football",
    label: "Champions League",
  },
  { path: "basketball/nba", sport: "Basketball", label: "NBA" },
  { path: "basketball/wnba", sport: "Basketball", label: "WNBA" },
  {
    path: "football/nfl",
    sport: "American football",
    label: "NFL",
    week: true,
  },
  { path: "baseball/mlb", sport: "Baseball", label: "MLB" },
  { path: "mma/ufc", sport: "MMA", label: "UFC" },
  { path: "tennis/atp", sport: "Tennis", label: "ATP" },
  { path: "tennis/wta", sport: "Tennis", label: "WTA" },
  {
    path: "rugby/267979",
    sport: "Rugby",
    label: "Premiership Rugby",
    week: true,
  },
  { path: "rugby/270559", sport: "Rugby", label: "Top 14", week: true },
];
const base = "https://site.api.espn.com/apis/site/v2/sports/";
const name = (c: z.infer<typeof competitor>) =>
  c.team?.displayName ||
  c.roster?.displayName ||
  c.athlete?.displayName ||
  c.athlete?.fullName;
export function espnStatus(
  s: z.infer<typeof statusSchema> | undefined,
  stale: boolean,
): SportEvent["status"] {
  const type = s?.type.name || "";
  if (/POSTPONED/.test(type)) return "postponed";
  if (/CANCEL/.test(type)) return "cancelled";
  if (/SUSPEND|DELAY/.test(type)) return "suspended";
  if (s?.type.state === "post") return "finished";
  if (s?.type.state === "in") return stale ? "unknown" : "live";
  return s?.type.state === "pre" ? "upcoming" : "unknown";
}
export function normalizeScoreboard(
  raw: unknown,
  league: League,
  fetchedAt: string,
  stale: boolean,
): SportEvent[] {
  const board = boardSchema.parse(raw);
  return board.events.flatMap((event) => {
    const cs = event.groupings
      ? event.groupings.flatMap((g) => g.competitions || [])
      : event.competitions || [];
    if (league.sport === "MMA") {
      return [
        eventSchema.parse({
          id: `espn-${espnLeagueId(league.path)}-${event.id}`,
          externalId: event.id,
          kind: "card",
          sport: league.sport,
          competition: board.leagues?.[0]?.name || league.label,
          title: event.name,
          start: new Date(event.date).toISOString(),
          status: espnStatus(event.status, stale),
          provenance: "provider",
          source: {
            provider: `ESPN:${league.path}`,
            url: `${base}${league.path}/scoreboard`,
            license:
              "Public ESPN scoreboard; undocumented API, reuse terms require review. No broadcast rights.",
            fetchedAt,
            stale,
          },
          bouts: cs.map((c) => ({
            performers: c.competitors.map(name).filter((n): n is string => !!n),
            stipulation: `${c.type?.text || c.type?.abbreviation || "Bout"} · ${c.status?.type.detail || "Status unavailable"}`,
          })),
          detail: { venue: cs[0]?.venue?.fullName },
        }),
      ];
    }
    return cs.flatMap((c) => {
      const home =
        c.competitors.find((t) => t.homeAway === "home") || c.competitors[0];
      const away =
        c.competitors.find((t) => t.homeAway === "away") || c.competitors[1];
      if (!home || !away || !name(home) || !name(away)) return [];
      const status = espnStatus(c.status || event.status, stale);
      const numericScore = (t: typeof home) => {
        // Tennis linescores are games per set, not the overall match score.
        if (status === "upcoming" || league.sport === "Tennis") return null;
        const value = typeof t.score === "object" ? t.score.value : t.score;
        return value !== undefined &&
          value !== "" &&
          Number.isFinite(Number(value))
          ? Number(value)
          : null;
      };
      const participant = (t: typeof home) => ({
        id: t.id,
        provider: `ESPN:${league.path}`,
        name: name(t)!,
        imageUrl: safeTeamImage(t.team?.logo || t.athlete?.headshot?.href),
        sourceUrl: "https://www.espn.com/",
      });
      const periods = (home.linescores || []).map((v, i) => ({
        label: `${league.sport === "Tennis" ? "Set" : "Period"} ${i + 1}`,
        home: v.displayValue || String(v.value ?? "–"),
        away:
          away.linescores?.[i]?.displayValue ||
          String(away.linescores?.[i]?.value ?? "–"),
      }));
      const statistics = (home.statistics || []).flatMap((s) => {
        const other = away.statistics?.find((a) => a.name === s.name);
        return s.displayValue !== undefined && other?.displayValue !== undefined
          ? [
              {
                label: s.label || s.abbreviation || s.name,
                home: s.displayValue,
                away: other.displayValue,
              },
            ]
          : [];
      });
      return [
        eventSchema.parse({
          id: `espn-${espnLeagueId(league.path)}-${c.id}`,
          externalId: c.id,
          kind: "score",
          sport: league.sport,
          competition:
            league.sport === "Tennis"
              ? `${league.label} · ${event.name}`
              : board.leagues?.[0]?.name || league.label,
          start: new Date(c.date).toISOString(),
          status,
          provenance: "provider",
          home: name(home),
          away: name(away),
          viewingLinks:
            league.path === "soccer/eng.1"
              ? premierLeagueViewingLinks(name(home)!, name(away)!, c.date)
              : undefined,
          homeParticipant: participant(home),
          awayParticipant: participant(away),
          homeScore: numericScore(home),
          awayScore: numericScore(away),
          clock:
            stale && status === "unknown"
              ? "Updates delayed"
              : (c.status || event.status)?.type.shortDetail ||
                (c.status || event.status)?.type.detail ||
                "Status unavailable",
          source: {
            provider: `ESPN:${league.path}`,
            url: `${base}${league.path}/scoreboard`,
            license:
              "Public ESPN scoreboard; undocumented API, reuse terms require review. No broadcast rights.",
            fetchedAt,
            stale,
          },
          detail: { venue: c.venue?.fullName, periods, statistics },
        }),
      ];
    });
  });
}

export class EspnProvider {
  constructor(
    private cache: ProviderCache,
    private lookupCache = new ProviderCache(),
    private scheduleCache = new ProviderCache(),
  ) {}
  async lookup(id: string): Promise<SportEvent | undefined> {
    const league = espnLeagues.find((l) =>
      id.startsWith(`espn-${espnLeagueId(l.path)}-`),
    );
    if (!league) return undefined;
    const externalId = id.slice(`espn-${espnLeagueId(league.path)}-`.length);
    if (!/^\d+$/.test(externalId)) return undefined;
    const r = await this.lookupCache.json(
      `${base}${league.path}/summary?event=${externalId}`,
      30000,
      (raw) =>
        z
          .object({
            header: z.object({
              id: z.string(),
              competitions: z.array(competition).min(1),
            }),
          })
          .parse(raw),
    );
    return normalizeScoreboard(
      {
        leagues: [{ name: league.label }],
        events: [
          {
            ...r.value.header,
            date: r.value.header.competitions[0].date,
            name: league.label,
          },
        ],
      },
      league,
      r.fetchedAt,
      r.stale,
    ).find((e) => e.id === id);
  }
  async events(league: League, date: string) {
    const from = date.replaceAll("-", "");
    if (league.sport === "Football") {
      // Football rejects date ranges. Keep future schedules out of the live cache.
      const days = Array.from({ length: 8 }, (_, index) => {
        const day = new Date(`${date}T12:00:00Z`);
        day.setUTCDate(day.getUTCDate() + index);
        return day.toISOString().slice(0, 10).replaceAll("-", "");
      });
      const results = await Promise.allSettled(
        days.map((day, index) =>
          (index === 0 ? this.cache : this.scheduleCache).json(
            `${base}${league.path}/scoreboard?limit=500&dates=${day}`,
            index === 0 ? 30000 : 900000,
            (raw) => boardSchema.parse(raw),
          ),
        ),
      );
      const loaded = results.flatMap((result) =>
        result.status === "fulfilled" ? [result.value] : [],
      );
      if (!loaded.length) throw new Error("Football schedule unavailable");
      const events = loaded.flatMap((result) =>
        normalizeScoreboard(
          result.value,
          league,
          result.fetchedAt,
          result.stale,
        ),
      );
      return {
        value: [...new Map(events.map((event) => [event.id, event])).values()],
        fetchedAt: loaded
          .map((result) => result.fetchedAt)
          .sort()
          .at(-1)!,
        stale:
          loaded.some((result) => result.stale) || loaded.length < days.length,
      };
    }
    const end = new Date(`${date}T12:00:00Z`);
    end.setUTCDate(end.getUTCDate() + 7);
    const dates = league.week
      ? ""
      : `&dates=${["Tennis", "MMA"].includes(league.sport) ? `${from}-${end.toISOString().slice(0, 10).replaceAll("-", "")}` : from}`;
    const result = await this.cache.json(
      `${base}${league.path}/scoreboard?limit=500${dates}`,
      30000,
      (raw) => boardSchema.parse(raw),
    );
    return {
      ...result,
      value: normalizeScoreboard(
        result.value,
        league,
        result.fetchedAt,
        result.stale,
      ),
    };
  }
  async detail(event: SportEvent): Promise<LiveDetail | undefined> {
    const path = event.source?.provider.replace(/^ESPN:/, "");
    if (
      !path ||
      !espnLeagues.some((l) => l.path === path) ||
      !/^\d+$/.test(event.externalId || "")
    )
      return event.detail;
    const stat = z.object({
      name: z.string(),
      label: z.string().optional(),
      displayValue: z.string(),
    });
    const summarySchema = z.object({
      boxscore: z
        .object({
          teams: z
            .array(
              z.object({
                team: z.object({ id: z.string(), displayName: z.string() }),
                statistics: z.array(stat).optional(),
              }),
            )
            .optional(),
          players: z
            .array(
              z.object({
                team: z.object({ displayName: z.string() }),
                statistics: z
                  .array(
                    z.object({
                      athletes: z.array(
                        z.object({
                          athlete: z.object({
                            displayName: z.string(),
                            position: z
                              .object({ abbreviation: z.string() })
                              .optional(),
                          }),
                          starter: z.boolean().optional(),
                        }),
                      ),
                    }),
                  )
                  .optional(),
              }),
            )
            .optional(),
        })
        .optional(),
      rosters: z
        .array(
          z.object({
            team: z.object({ displayName: z.string() }),
            roster: z.array(
              z.object({
                athlete: z.object({
                  displayName: z.string(),
                  position: z.object({ abbreviation: z.string() }).optional(),
                }),
                starter: z.boolean().optional(),
              }),
            ),
          }),
        )
        .optional(),
      plays: z
        .array(
          z.object({
            id: z.string(),
            text: z.string(),
            clock: z.object({ displayValue: z.string() }).optional(),
            period: z.object({ number: z.number() }).optional(),
            team: z.object({ displayName: z.string().optional() }).optional(),
          }),
        )
        .optional(),
    });
    const result = await this.cache.json(
      `${base}${path}/summary?event=${event.externalId}`,
      30000,
      (raw) => summarySchema.parse(raw),
    );
    if (result.stale) return event.detail;
    const data = result.value;
    const teams = data.boxscore?.teams;
    const home =
      event.kind === "score"
        ? teams?.find((t) => t.team.id === event.homeParticipant?.id)
        : undefined;
    const away =
      event.kind === "score"
        ? teams?.find((t) => t.team.id === event.awayParticipant?.id)
        : undefined;
    const statistics = home?.statistics?.flatMap((s) => {
      const other = away?.statistics?.find((a) => a.name === s.name);
      return other
        ? [
            {
              label: s.label || s.name,
              home: s.displayValue,
              away: other.displayValue,
            },
          ]
        : [];
    });
    const lineups =
      data.rosters?.map((r) => ({
        team: r.team.displayName,
        players: r.roster.map((a) => ({
          name: a.athlete.displayName,
          position: a.athlete.position?.abbreviation,
          starter: a.starter,
        })),
      })) ||
      data.boxscore?.players?.map((r) => ({
        team: r.team.displayName,
        players: (r.statistics || [])
          .flatMap((g) => g.athletes)
          .map((a) => ({
            name: a.athlete.displayName,
            position: a.athlete.position?.abbreviation,
            starter: a.starter,
          })),
      }));
    return {
      ...event.detail,
      ...(statistics?.length ? { statistics } : {}),
      ...(lineups?.length ? { lineups } : {}),
      ...(data.plays?.length
        ? {
            timeline: data.plays.map((p) => ({
              id: p.id,
              clock: [
                p.period?.number ? `P${p.period.number}` : "",
                p.clock?.displayValue,
              ]
                .filter(Boolean)
                .join(" · "),
              text: p.text,
              team: p.team?.displayName,
            })),
          }
        : {}),
    };
  }
}
