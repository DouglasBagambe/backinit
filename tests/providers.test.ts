import { describe, it, expect, vi } from "vitest";
import { ProviderCache } from "../apps/api/src/providers/cache";
import { normalizeFootball } from "../apps/api/src/providers/openliga";
import { normalizeRaces } from "../apps/api/src/providers/jolpica";
const fixture = {
  matchID: 1,
  matchDateTimeUTC: "2026-10-23T18:30:00Z",
  leagueName: "Bundesliga",
  leagueSeason: 2026,
  matchIsFinished: true,
  team1: {
    teamId: 1,
    teamName: "Home",
    teamIconUrl: "https://i.imgur.com/team.png",
  },
  team2: { teamId: 2, teamName: "Away" },
  group: { groupName: "Round 7" },
  location: null,
  matchResults: [
    { resultTypeID: 1, pointsTeam1: 0, pointsTeam2: 1 },
    { resultTypeID: 2, pointsTeam1: 2, pointsTeam2: 1 },
  ],
  goals: [
    {
      goalID: 12,
      matchMinute: 45,
      goalGetterName: "Player",
      scoringTeamId: 1,
      scoreTeam1: 1,
      scoreTeam2: 0,
      isPenalty: false,
      isOwnGoal: false,
    },
  ],
};
describe("provider normalization", () => {
  it("selects full-time result by type, preserves source and genuine goal events", () => {
    const event = normalizeFootball(
      [fixture],
      "2026-10-26T12:00:00Z",
      false,
    )[0]!;
    expect(event.kind === "score" && event.homeScore).toBe(2);
    expect(event.source?.provider).toBe("OpenLigaDB");
    expect(event.kind === "score" && event.homeParticipant).toMatchObject({
      id: "1",
      provider: "OpenLigaDB",
      imageUrl: "https://i.imgur.com/team.png",
    });
    expect(event.detail?.goals?.[0]?.player).toBe("Player");
  });
  it("does not infer live status or invent a clock from elapsed wall time", () => {
    const event = normalizeFootball(
      [{ ...fixture, matchIsFinished: false, matchResults: [] }],
      "2026-10-26T12:00:00Z",
      false,
    )[0]!;
    expect(event.status).toBe("upcoming");
    expect(event.kind === "score" && event.clock).toBe("Status pending");
    expect(event.kind === "score" && event.homeScore).toBeNull();
  });
  it("rejects malformed provider bodies", () => {
    expect(() =>
      normalizeFootball(
        [{ ...fixture, team1: null }],
        "2026-10-26T12:00:00Z",
        false,
      ),
    ).toThrow();
    expect(() => normalizeRaces({}, "2026-10-26T12:00:00Z", false)).toThrow();
  });
});
describe("provider caching and failure boundaries", () => {
  it("deduplicates concurrent callers and reuses fresh validated data", async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({ ok: true }));
    const cache = new ProviderCache(fetcher);
    const parse = (raw: unknown) => raw;
    await Promise.all([
      cache.json("https://provider.test/a", 1000, parse),
      cache.json("https://provider.test/a", 1000, parse),
    ]);
    await cache.json("https://provider.test/a", 1000, parse);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("labels stale data, honors Retry-After across resources, expires old snapshots", async () => {
    let now = 0;
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ n: 1 }))
      .mockResolvedValue(
        new Response(null, { status: 429, headers: { "Retry-After": "120" } }),
      );
    const cache = new ProviderCache(fetcher, () => now);
    await cache.json("https://provider.test/a", 1000, (x) => x);
    now = 2000;
    expect(
      (await cache.json("https://provider.test/a", 1000, (x) => x)).stale,
    ).toBe(true);
    await expect(
      cache.json("https://provider.test/b", 1000, (x) => x),
    ).rejects.toThrow("cooling down");
    expect(fetcher).toHaveBeenCalledTimes(2);
    now = 86400001;
    await expect(
      cache.json("https://provider.test/a", 1000, (x) => x),
    ).rejects.toThrow();
  });
  it("does not cache invalid upstream responses", async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({ broken: true }));
    const cache = new ProviderCache(fetcher);
    await expect(
      cache.json("https://provider.test/a", 1000, () => {
        throw new Error("invalid");
      }),
    ).rejects.toThrow("invalid");
  });
});
