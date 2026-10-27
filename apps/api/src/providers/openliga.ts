import { z } from "zod";
import {
  eventSchema,
  type SportEvent,
} from "../../../../packages/domain/src/index.js";
import { ProviderCache } from "./cache.js";
const team = z.object({ teamId: z.number(), teamName: z.string() });
const match = z.object({
  matchID: z.number(),
  matchDateTimeUTC: z.string().datetime(),
  leagueName: z.string(),
  leagueSeason: z.number(),
  matchIsFinished: z.boolean(),
  team1: team,
  team2: team,
  group: z.object({ groupName: z.string() }),
  location: z
    .object({
      locationCity: z.string().nullable(),
      locationStadium: z.string().nullable(),
    })
    .nullable(),
  matchResults: z.array(
    z.object({
      resultTypeID: z.number(),
      pointsTeam1: z.number(),
      pointsTeam2: z.number(),
    }),
  ),
  goals: z.array(
    z.object({
      goalID: z.number(),
      matchMinute: z.number().nullable(),
      goalGetterName: z.string().nullable(),
      scoringTeamId: z.number().nullable().optional(),
      scoreTeam1: z.number(),
      scoreTeam2: z.number(),
      isPenalty: z.boolean(),
      isOwnGoal: z.boolean(),
    }),
  ),
});
const table = z.array(
  z.object({
    teamName: z.string(),
    points: z.number(),
    goals: z.number(),
    opponentGoals: z.number(),
    matches: z.number(),
    won: z.number(),
    lost: z.number(),
    draw: z.number(),
  }),
);
export function normalizeFootball(
  raw: unknown,
  fetchedAt: string,
  stale: boolean,
): SportEvent[] {
  return z
    .array(match)
    .parse(raw)
    .map((m) => {
      const result = m.matchResults.find((r) => r.resultTypeID === 2);
      // OpenLigaDB exposes no authoritative live clock/status. Do not infer live from wall time.
      const started = Date.parse(m.matchDateTimeUTC) <= Date.parse(fetchedAt);
      const status = m.matchIsFinished ? "finished" : "upcoming";
      return eventSchema.parse({
        id: `ol-${m.matchID}`,
        kind: "score",
        sport: "Football",
        competition: m.leagueName,
        start: m.matchDateTimeUTC,
        status,
        provenance: "provider",
        home: m.team1.teamName,
        away: m.team2.teamName,
        homeScore: result?.pointsTeam1 ?? null,
        awayScore: result?.pointsTeam2 ?? null,
        clock: m.matchIsFinished
          ? "FT"
          : started
            ? "Status pending"
            : new Date(m.matchDateTimeUTC).toISOString().slice(11, 16) + " UTC",
        source: {
          provider: "OpenLigaDB",
          url: "https://www.openligadb.de/",
          license: "ODbL 1.0",
          fetchedAt,
          stale,
        },
        detail: {
          round: m.group.groupName,
          venue: m.location
            ? [m.location.locationStadium, m.location.locationCity]
                .filter(Boolean)
                .join(", ") || null
            : null,
          goals: m.goals.map((g) => ({
            id: String(g.goalID),
            minute: g.matchMinute,
            player: g.goalGetterName,
            team:
              g.scoringTeamId === m.team1.teamId
                ? m.team1.teamName
                : g.scoringTeamId === m.team2.teamId
                  ? m.team2.teamName
                  : null,
            homeScore: g.scoreTeam1,
            awayScore: g.scoreTeam2,
            penalty: g.isPenalty,
            ownGoal: g.isOwnGoal,
          })),
        },
      });
    });
}
export class OpenLigaProvider {
  constructor(private readonly cache: ProviderCache) {}
  async events(season: number) {
    const snapshot = await this.cache.json(
      `https://api.openligadb.de/getmatchdata/bl1/${season}`,
      300000,
      (raw) => z.array(match).parse(raw),
    );
    return {
      ...snapshot,
      value: normalizeFootball(
        snapshot.value,
        snapshot.fetchedAt,
        snapshot.stale,
      ),
    };
  }
  async standings(season: number) {
    const snapshot = await this.cache.json(
      `https://api.openligadb.de/getbltable/bl1/${season}`,
      900000,
      (raw) => table.parse(raw),
    );
    return {
      ...snapshot,
      value: snapshot.value.map((t) => ({
        team: t.teamName,
        played: t.matches,
        won: t.won,
        drawn: t.draw,
        lost: t.lost,
        goalsFor: t.goals,
        goalsAgainst: t.opponentGoals,
        points: t.points,
      })),
    };
  }
}
