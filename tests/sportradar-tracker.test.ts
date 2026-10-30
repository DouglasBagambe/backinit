import { afterEach, expect, it, vi } from "vitest";
import { SportradarTrackerProvider } from "../apps/api/src/providers/sportradar-tracker";
import { eventSchema, trackerSourceSchema } from "../packages/domain/src/index";
const now = Date.parse("2026-10-31T12:00:00Z");
const event = eventSchema.parse({
  id: "espn-tennis-atp-42",
  sport: "Tennis",
  competition: "ATP",
  start: "2026-10-31T11:00:00Z",
  kind: "score",
  home: "Player One",
  away: "Player Two",
  homeScore: null,
  awayScore: null,
  clock: "2nd",
  status: "live",
  provenance: "provider",
  source: {
    provider: "Test",
    url: "https://example.test",
    license: "Test",
    fetchedAt: new Date(now).toISOString(),
    stale: false,
  },
});
const mapping = {
  eventId: event.id,
  matchId: "sr:match:12345",
  sport: event.sport,
  home: "Player One",
  away: "Player Two",
  start: event.start,
};
const clientId = "0".repeat(32); // Isolated contract identifier, never used against the vendor.
function configure(matches: unknown = [mapping]) {
  vi.stubEnv("SPORTRADAR_CLIENT_ID", clientId);
  vi.stubEnv("SPORTRADAR_TRACKER_MATCHES", JSON.stringify(matches));
}
afterEach(() => vi.unstubAllEnvs());
it("leaves the existing tracker untouched until our client and exact coverage are configured", () => {
  vi.stubEnv("SPORTRADAR_CLIENT_ID", "");
  vi.stubEnv("SPORTRADAR_TRACKER_MATCHES", "");
  const provider = new SportradarTrackerProvider(() => now);
  expect(provider.forEvent(event)).toBeNull();
  configure();
  expect(trackerSourceSchema.parse(provider.forEvent(event))).toEqual({
    provider: "Sportradar",
    eventId: event.id,
    clientId,
    matchId: mapping.matchId,
    checkedAt: new Date(now).toISOString(),
    validUntil: new Date(now + 120000).toISOString(),
    kind: "publisher-tracker",
  });
});
it("fails closed for bad configuration and never guesses between identities or duplicate mappings", () => {
  const provider = new SportradarTrackerProvider(() => now);
  for (const matches of [
    [mapping, mapping],
    [{ ...mapping, matchId: "42" }],
    [{ ...mapping, home: "Another Player" }],
    [{ ...mapping, away: "Another Player" }],
    [{ ...mapping, sport: "Football" }],
    [{ ...mapping, start: "2026-10-31T11:01:00Z" }],
    [{ ...mapping, eventId: "espn-tennis-atp-99" }],
  ]) {
    configure(matches);
    expect(provider.forEvent(event)).toBeNull();
  }
  configure();
  vi.stubEnv("SPORTRADAR_TRACKER_MATCHES", "not-json");
  expect(provider.forEvent(event)).toBeNull();
  configure();
  vi.stubEnv("SPORTRADAR_CLIENT_ID", "sportradar"); // Public demo identity is not a customer credential.
  expect(provider.forEvent(event)).toBeNull();
});
it("withdraws for finished, stale, demo and schedule-only fixtures", () => {
  configure();
  const provider = new SportradarTrackerProvider(() => now);
  for (const next of [
    { ...event, status: "finished" as const },
    { ...event, status: "upcoming" as const },
    { ...event, provenance: "demo" as const },
    { ...event, scheduleOnly: true },
    { ...event, source: { ...event.source!, stale: true } },
  ])
    expect(provider.forEvent(next)).toBeNull();
  vi.stubEnv("SPORTS_PROVIDERS_DISABLED", "true");
  expect(provider.forEvent(event)).toBeNull();
});
