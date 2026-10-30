import { describe, it, expect } from "vitest";
import {
  DemoProvider,
  eventSchema,
  events,
  filterEvents,
  eventTitle,
  hasMatchTracker,
} from "../packages/domain/src/index";
describe("provider-independent event contract", () => {
  it("validates every demo event and retains explicit provenance", async () => {
    const data = await new DemoProvider().getEvents();
    expect(data).toHaveLength(8);
    expect(data.every((e) => e.provenance === "demo")).toBe(true);
  });
  it("rejects fabricated provenance and malformed scores", () => {
    expect(
      eventSchema.safeParse({ ...events[0], provenance: "live" }).success,
    ).toBe(false);
    expect(
      eventSchema.safeParse({ ...events[0], homeScore: "two" }).success,
    ).toBe(false);
  });
  it("keeps wrestling cards separate from scored matches", () => {
    const card = events.find((e) => e.kind === "card")!;
    expect("homeScore" in card).toBe(false);
    expect(eventTitle(card)).toBe("Saturday Night Showcase");
  });
  it("combines sport, live and case-insensitive search filters", () => {
    expect(
      filterEvents(events, {
        sport: "Football",
        live: true,
        query: "LIVERPOOL",
      }).map((e) => e.id),
    ).toEqual(["north-london"]);
  });
  it("returns an empty favorite list instead of every event", () => {
    expect(filterEvents(events, { ids: [] })).toEqual([]);
  });
  it("does not match unavailable sports or unknown queries", () => {
    expect(filterEvents(events, { sport: "Rugby" })).toEqual([]);
    expect(filterEvents(events, { query: "not-a-team" })).toEqual([]);
  });
});

it("offers tracking only for real fresh match data, not demo, stale data or a bare schedule", () => {
  const event = {
    ...events[0]!,
    provenance: "provider" as const,
    source: {
      provider: "Contract fixture",
      url: "https://example.test",
      license: "Test",
      stale: false,
      fetchedAt: new Date().toISOString(),
    },
  };
  expect(hasMatchTracker(event)).toBe(true);
  expect(hasMatchTracker({ ...event, provenance: "demo" })).toBe(false);
  expect(
    hasMatchTracker({ ...event, source: { ...event.source, stale: true } }),
  ).toBe(false);
  expect(hasMatchTracker({ ...event, scheduleOnly: true })).toBe(false);
  expect(hasMatchTracker({ ...event, status: "upcoming" })).toBe(false);
});
