import { afterEach, expect, it, vi } from "vitest";
import { Accounts, type User } from "../apps/api/src/accounts";
import { Streams, validateStream } from "../apps/api/src/streams";
import {
  EflProvider,
  parseEflSchedule,
  londonKickoff,
  verifiedCupFixtures,
  externalMatchLinks,
} from "../apps/api/src/providers/efl";
import { ProviderCache } from "../apps/api/src/providers/cache";
import {
  sourceMatchesEvent,
  testSources,
  type StreamSource,
} from "../packages/domain/src/index";
const stores: Accounts[] = [];
afterEach(() => {
  stores.splice(0).forEach((s) => s.db.close());
  vi.unstubAllEnvs();
});
const page = `<title>Carabao Cup Round Four referee appointments</title><strong>Wednesday, 28th October 2026</strong><strong>Manchester City v Brighton &amp; Hove Albion (19:30)</strong><strong>AFC Bournemouth v Aston Villa (19:45)</strong><strong>Fulham v Crystal Palace (19:45)</strong><strong>Sunderland v Brentford (19:45)</strong><strong>Liverpool v Chelsea (20:00)</strong>`;
it("scopes the unverified external destination to the reviewed match and expires it", () => {
  const start = "2026-10-28T20:00:00Z";
  const now = Date.parse("2026-10-28T21:25:00Z");
  const links = externalMatchLinks("Liverpool", "Chelsea", start, now);
  expect(links).toHaveLength(1);
  expect(links[0]).toMatchObject({
    url: "https://sportsframe.site/10745/0/epl/5",
    confirmation: "check-schedule",
    access: "information",
    countries: [],
  });
  expect(externalMatchLinks("Chelsea", "Liverpool", start, now)).toEqual([]);
  expect(
    externalMatchLinks("Liverpool", "Chelsea", "2026-11-28T20:00:00Z", now),
  ).toEqual([]);
  expect(
    externalMatchLinks(
      "Liverpool",
      "Chelsea",
      start,
      Date.parse("2026-10-29T00:00:00Z"),
    ),
  ).toEqual([]);
  expect(
    externalMatchLinks(
      "Liverpool",
      "Chelsea",
      start,
      Date.parse("2026-10-28T21:00:00Z"),
    ),
  ).toEqual([]);
});
it("ingests official fixture facts, decodes team names, preserves stable IDs and never invents scores/live status", () => {
  const fixtures = parseEflSchedule(page, "2026-10-28T01:00:00Z");
  expect(fixtures).toHaveLength(5);
  expect(
    fixtures.map((e) =>
      new Intl.DateTimeFormat("en-GB", {
        timeZone: "Africa/Kampala",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(e.start)),
    ),
  ).toEqual(["22:30", "22:45", "22:45", "22:45", "23:00"]);
  expect(fixtures.map((e) => e.id)).toEqual(
    verifiedCupFixtures.map((e) => e.id),
  );
  for (const e of fixtures) {
    expect(e).toMatchObject({
      status: "upcoming",
      scheduleOnly: true,
      provenance: "provider",
      homeScore: null,
      awayScore: null,
    });
    expect(
      e.viewingLinks?.some(
        (v) =>
          v.countries.includes("UG") && v.confirmation === "check-schedule",
      ),
    ).toBe(true);
  }
  expect(
    fixtures[4]?.viewingLinks
      ?.filter((l) => l.confirmation === "confirmed")
      .map((l) => l.countries),
  ).toEqual([["GB"], ["GB"]]);
  expect(() =>
    parseEflSchedule(
      "<title>untrusted</title>" +
        page.replaceAll("Carabao Cup Round Four referee appointments", ""),
      new Date().toISOString(),
    ),
  ).toThrow();
  expect(londonKickoff(2026, 8, 15, 20, 0)).toBe("2026-09-15T19:00:00.000Z");
});
it("falls back only to sourced, explicitly stale verified fixtures when the official announcement fails", async () => {
  const provider = new EflProvider(
    new ProviderCache(vi.fn().mockRejectedValue(new Error("network"))),
  );
  const feed = await provider.events();
  expect(feed.stale).toBe(true);
  expect(feed.value).toHaveLength(5);
  expect(
    feed.value.every((e) => e.source?.stale && e.provenance === "provider"),
  ).toBe(true);
});
it("does not allow testing media to masquerade as a real event broadcast", () => {
  for (const s of testSources) {
    expect(() =>
      validateStream({
        ...s,
        content: "sports",
        eventId: verifiedCupFixtures[4]!.id,
      }),
    ).toThrow("testing hosts");
    expect(() =>
      validateStream({ ...s, eventId: verifiedCupFixtures[4]!.id }),
    ).toThrow("Test feeds");
  }
});
function setup() {
  vi.stubEnv("STREAM_ALLOWED_HOSTS", "media.rightsholder.test");
  const accounts = new Accounts(":memory:");
  stores.push(accounts);
  const streams = new Streams(accounts);
  const user: User = {
    id: "operator",
    email: "operator@example.test",
    role: "admin",
  };
  const fixture = verifiedCupFixtures[4]!;
  const source: StreamSource = {
    id: "licensed-event",
    name: "Authorized event source",
    type: "hls",
    url: "https://media.rightsholder.test/event/live.m3u8",
    content: "sports",
    eventId: null,
    fixtureRef: {
      provider: fixture.source!.provider,
      externalId: fixture.externalId!,
    },
    presentation: "live",
    rightsOwner: "Event rights holder",
    rightsEvidence: "https://rightsholder.test/agreement",
    validFrom: new Date(Date.now() - 10000).toISOString(),
    validUntil: new Date(Date.now() + 7 * 86400000).toISOString(),
    territory: "WORLD",
    revoked: true,
    version: 1,
  };
  return { accounts, streams, user, fixture, source };
}
it("publishes an event source only after decoding, matches exact provider refs and respects revocation/expiry/URL edits", () => {
  const { streams, user, fixture, source } = setup();
  const saved = streams.save(user, source);
  expect(streams.forEvent(fixture)).toEqual([]);
  expect(() => streams.save(user, { ...saved, revoked: false })).toThrow(
    "verify playback",
  );
  const evidence = {
    id: source.id,
    version: saved.version,
    result: "passed",
    method: "native-decoded",
    currentTime: 2.1,
    width: 640,
    height: 360,
    browser: "test browser",
    live: true,
  };
  expect(() =>
    streams.recordCheck(user, { ...evidence, currentTime: 0 }),
  ).toThrow("Decoded");
  expect(() => streams.recordCheck(user, { ...evidence, live: false })).toThrow(
    "live playback",
  );
  streams.recordCheck(user, evidence);
  const enabled = streams.save(user, { ...saved, revoked: false });
  expect(streams.forEvent(fixture).map((s) => s.id)).toEqual([source.id]);
  expect(
    Date.parse(streams.forEvent(fixture)[0]!.validUntil),
  ).toBeLessThanOrEqual(Date.now() + 86400000);
  expect(
    sourceMatchesEvent(enabled, {
      ...fixture,
      id: "different",
      externalId: "different",
    }),
  ).toBe(false);
  expect(() =>
    streams.save(user, {
      ...enabled,
      url: "https://media.rightsholder.test/other.m3u8",
    }),
  ).toThrow("verify playback");
  expect(() => streams.recordCheck(user, evidence)).toThrow("Source changed");
  const revoked = streams.save(user, { ...enabled, revoked: true });
  expect(streams.forEvent(fixture)).toEqual([]);
  streams.save(user, {
    ...revoked,
    revoked: false,
    validUntil: new Date(Date.now() - 100).toISOString(),
  });
  expect(streams.forEvent(fixture)).toEqual([]);
});
it("explicit event IDs cannot be overridden by a reference for another match, and host review rejects IP/wildcard/userinfo", () => {
  const { source, fixture } = setup();
  expect(
    sourceMatchesEvent({ ...source, eventId: "other-match" }, fixture),
  ).toBe(false);
  for (const host of ["127.0.0.1", "172.16.0.1", "169.254.169.254", "*.test"]) {
    vi.stubEnv("STREAM_ALLOWED_HOSTS", host);
    expect(() =>
      validateStream({ ...source, url: `https://${host}/stream.m3u8` }),
    ).toThrow();
  }
});
it("requires advancing SDK evidence for publisher embeds and withholds live sources after an event ends", () => {
  const { streams, user, fixture, source } = setup();
  const saved = streams.save(user, {
    ...source,
    type: "embed",
    territory: "PROVIDER",
    url: "https://www.youtube-nocookie.com/embed/epxkdYuTSqU",
  });
  const report = {
    id: saved.id,
    version: saved.version,
    result: "passed",
    method: "provider-player",
    currentTime: 0,
    width: 0,
    height: 0,
    browser: "contract test",
  };
  expect(() => streams.recordCheck(user, report)).toThrow("Advancing");
  streams.recordCheck(user, { ...report, currentTime: 4 });
  streams.save(user, { ...saved, revoked: false });
  expect(streams.forEvent(fixture)).toHaveLength(1);
  expect(streams.forEvent({ ...fixture, status: "finished" })).toEqual([]);
  expect(streams.forEvent({ ...fixture, status: "cancelled" })).toEqual([]);
});
