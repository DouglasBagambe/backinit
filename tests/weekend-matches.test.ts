import { expect, it } from "vitest";
import { weekendMatches } from "../apps/web/app/components/weekend-matches";
import { eventSchema } from "../packages/domain/src/index";
const event = eventSchema.parse({
  id: "espn-soccer-eng-1-401879248",
  sport: "Football",
  competition: "Premier League",
  start: "2026-10-31T12:30:00Z",
  kind: "score",
  home: "Chelsea",
  away: "Manchester United",
  homeScore: null,
  awayScore: null,
  clock: "Scheduled",
  status: "upcoming",
  provenance: "provider",
});
it("keeps the headline fixture first without pretending schedules are streams, and removes completed or expired fixtures", () => {
  const now = Date.parse("2026-10-30T22:00:00Z");
  const other = { ...event, id: "other", start: "2026-11-01T16:30:00Z" };
  const fixtures = [
    other,
    event,
    { ...event, id: "finished", status: "finished" as const },
    { ...event, id: "old", start: "2026-10-31T00:00:00Z" },
    { ...event, id: "monday", start: "2026-11-02T12:00:00Z" },
    { ...event, id: "demo", provenance: "demo" as const },
    {
      ...event,
      id: "stale",
      source: {
        provider: "Test",
        url: "https://example.test",
        license: "Test",
        fetchedAt: new Date(now).toISOString(),
        stale: true,
      },
    },
  ];
  expect(
    weekendMatches(fixtures, now, "Africa/Kampala").map((e) => e.id),
  ).toEqual([event.id, "old", "other"]);
  expect(
    weekendMatches(
      fixtures,
      Date.parse("2026-10-31T13:00:00Z"),
      "Africa/Kampala",
    ).map((e) => e.id),
  ).toEqual(["other"]);
  expect(
    weekendMatches(
      [{ ...event, status: "live" }],
      Date.parse("2026-10-31T13:00:00Z"),
      "Africa/Kampala",
    ),
  ).toHaveLength(1);
});
