import { z } from "zod";
import {
  eventSchema,
  type SportEvent,
} from "../../../../packages/domain/src/index.js";
import { ProviderCache } from "./cache.js";
const result = z.object({
  position: z.string(),
  points: z.string(),
  laps: z.string(),
  status: z.string(),
  Driver: z.object({ givenName: z.string(), familyName: z.string() }),
  Constructor: z.object({ name: z.string() }),
  Time: z.object({ time: z.string() }).optional(),
});
const race = z.object({
  season: z.string(),
  round: z.string(),
  raceName: z.string(),
  date: z.string().date(),
  time: z.string().optional(),
  Circuit: z.object({ circuitName: z.string() }),
  Results: z.array(result).optional(),
});
const payload = z.object({
  MRData: z.object({ RaceTable: z.object({ Races: z.array(race) }) }),
});
export function normalizeRaces(
  raw: unknown,
  fetchedAt: string,
  stale: boolean,
): SportEvent[] {
  return payload.parse(raw).MRData.RaceTable.Races.map((r) =>
    eventSchema.parse({
      id: `f1-${r.season}-${r.round}`,
      kind: "race",
      sport: "Formula 1",
      competition: `Formula 1 · ${r.season}`,
      start: `${r.date}T${r.time || "00:00:00Z"}`,
      title: r.raceName,
      session: r.Results ? "Race classification" : "Race · timing not live",
      laps: r.Results?.length
        ? Math.max(...r.Results.map((x) => Number(x.laps)))
        : null,
      status: r.Results ? "finished" : "upcoming",
      provenance: "provider",
      source: {
        provider: "Jolpica F1",
        url: "https://jolpi.ca/",
        license: "Ergast attribution / non-affiliation",
        fetchedAt,
        stale,
      },
      detail: {
        venue: r.Circuit.circuitName,
        round: `Round ${r.round}`,
        classification: r.Results?.map((x) => ({
          position: Number(x.position),
          driver: `${x.Driver.givenName} ${x.Driver.familyName}`,
          team: x.Constructor.name,
          laps: Number(x.laps),
          points: Number(x.points),
          status: x.status,
          time: x.Time?.time ?? null,
        })),
      },
    }),
  );
}
export class JolpicaProvider {
  constructor(private readonly cache: ProviderCache) {}
  async events(year: number) {
    const [schedule, last] = await Promise.all([
      this.cache.json(
        `https://api.jolpi.ca/ergast/f1/${year}.json?limit=100`,
        3600000,
        (raw) => payload.parse(raw),
      ),
      this.cache
        .json(
          `https://api.jolpi.ca/ergast/f1/${year}/last/results.json?limit=100`,
          3600000,
          (raw) => payload.parse(raw),
        )
        .catch(() => null),
    ]);
    const results = last
      ? normalizeRaces(last.value, last.fetchedAt, last.stale)
      : [];
    return {
      ...schedule,
      value: normalizeRaces(schedule.value, schedule.fetchedAt, schedule.stale)
        .filter(
          (e) =>
            Date.parse(e.start) > Date.parse(schedule.fetchedAt) &&
            !results.some((r) => r.id === e.id),
        )
        .concat(results),
    };
  }
}
