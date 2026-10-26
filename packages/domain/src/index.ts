import { z } from "zod";
export const sports = [
  "Football",
  "Basketball",
  "Tennis",
  "WWE",
  "Formula 1",
  "Cricket",
  "MMA",
  "American football",
  "Baseball",
  "Rugby",
] as const;
export const sportSchema = z.enum(sports);
export type Sport = z.infer<typeof sportSchema>;
export const baseSchema = z.object({
  id: z.string(),
  sport: sportSchema,
  competition: z.string(),
  start: z.string().datetime(),
  status: z.enum(["live", "upcoming", "finished"]),
  provenance: z.literal("demo"),
});
export const eventSchema = z.discriminatedUnion("kind", [
  baseSchema.extend({
    kind: z.literal("score"),
    home: z.string(),
    away: z.string(),
    homeScore: z.number().nullable(),
    awayScore: z.number().nullable(),
    clock: z.string(),
  }),
  baseSchema.extend({
    kind: z.literal("card"),
    title: z.string(),
    bouts: z.array(
      z.object({ performers: z.array(z.string()), stipulation: z.string() }),
    ),
  }),
  baseSchema.extend({
    kind: z.literal("race"),
    title: z.string(),
    session: z.string(),
    laps: z.number(),
  }),
]);
export type SportEvent = z.infer<typeof eventSchema>;
const base = { provenance: "demo" as const, start: "2026-10-26T19:00:00Z" };
export const events: SportEvent[] = [
  {
    ...base,
    id: "north-london",
    kind: "score",
    sport: "Football",
    competition: "Premier League · Demo",
    status: "live",
    home: "Arsenal",
    away: "Liverpool",
    homeScore: 2,
    awayScore: 1,
    clock: "67′",
  },
  {
    ...base,
    id: "madrid-barcelona",
    kind: "score",
    sport: "Football",
    competition: "La Liga · Demo",
    status: "live",
    home: "Real Madrid",
    away: "Barcelona",
    homeScore: 0,
    awayScore: 0,
    clock: "32′",
  },
  {
    ...base,
    id: "boston-la",
    kind: "score",
    sport: "Basketball",
    competition: "NBA · Demo",
    status: "live",
    home: "Boston Celtics",
    away: "LA Lakers",
    homeScore: 84,
    awayScore: 79,
    clock: "Q3 · 04:28",
  },
  {
    ...base,
    id: "milan-inter",
    kind: "score",
    sport: "Football",
    competition: "Serie A · Demo",
    status: "upcoming",
    home: "AC Milan",
    away: "Inter Milan",
    homeScore: null,
    awayScore: null,
    clock: "20:45 UTC",
  },
  {
    ...base,
    id: "tennis-final",
    kind: "score",
    sport: "Tennis",
    competition: "Exhibition · Demo",
    status: "finished",
    home: "Alex Rivers",
    away: "Leo Martín",
    homeScore: 2,
    awayScore: 1,
    clock: "Sets · Final",
  },
  {
    ...base,
    id: "wwe-showcase",
    kind: "card",
    sport: "WWE",
    competition: "Wrestling showcase · Fictional card",
    status: "upcoming",
    title: "Saturday Night Showcase",
    bouts: [
      {
        performers: ["Atlas King", "Jax Steel"],
        stipulation: "Main event · Singles",
      },
      {
        performers: ["Maya Storm", "Nova Reed"],
        stipulation: "Championship showcase",
      },
    ],
  },
  {
    ...base,
    id: "grand-prix",
    kind: "race",
    sport: "Formula 1",
    competition: "Motorsport · Demo",
    status: "upcoming",
    title: "Grand Prix weekend",
    session: "Race",
    laps: 56,
  },
  {
    ...base,
    id: "cricket",
    kind: "score",
    sport: "Cricket",
    competition: "T20 exhibition · Demo",
    status: "upcoming",
    home: "Harbor XI",
    away: "City XI",
    homeScore: null,
    awayScore: null,
    clock: "18:00 UTC",
  },
];
export function eventTitle(e: SportEvent) {
  return e.kind === "score" ? `${e.home} vs ${e.away}` : e.title;
}
export function filterEvents(
  items: SportEvent[],
  options: { sport?: string; query?: string; live?: boolean; ids?: string[] },
) {
  return items.filter(
    (e) =>
      (!options.sport || e.sport === options.sport) &&
      (!options.live || e.status === "live") &&
      (!options.ids || options.ids.includes(e.id)) &&
      (!options.query ||
        `${eventTitle(e)} ${e.competition} ${e.sport}`
          .toLowerCase()
          .includes(options.query.toLowerCase())),
  );
}
export interface SportsProvider {
  readonly id: string;
  getEvents(): Promise<SportEvent[]>;
}
export class DemoProvider implements SportsProvider {
  readonly id = "demo";
  async getEvents() {
    return events.map((e) => eventSchema.parse(e));
  }
}
export const timeline = [
  {
    minute: 12,
    type: "goal",
    team: "Arsenal",
    text: "Arsenal take the lead",
    score: "1 – 0",
  },
  {
    minute: 29,
    type: "card",
    team: "Liverpool",
    text: "Yellow card · Liverpool",
    score: "1 – 0",
  },
  {
    minute: 41,
    type: "goal",
    team: "Liverpool",
    text: "Liverpool equalise",
    score: "1 – 1",
  },
  {
    minute: 58,
    type: "goal",
    team: "Arsenal",
    text: "Arsenal go ahead",
    score: "2 – 1",
  },
  {
    minute: 67,
    type: "corner",
    team: "Arsenal",
    text: "Corner awarded to Arsenal",
    score: "2 – 1",
  },
] as const;
export const stats = [
  ["Possession", 58, 42],
  ["Shots", 14, 9],
  ["Shots on target", 6, 4],
  ["Expected goals", 1.82, 0.94],
  ["Corners", 7, 3],
  ["Fouls", 8, 10],
] as const;
