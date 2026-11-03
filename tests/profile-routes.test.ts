import { afterEach, expect, it, vi } from "vitest";
const { athlete, team } = vi.hoisted(() => ({
  athlete: vi.fn(async () => ({
    value: { id: "123", name: "Reported player" },
  })),
  team: vi.fn(async () => ({ name: "Reported team", data: [], players: [] })),
}));
vi.mock("../apps/api/src/providers/entity-search", () => ({
  athleteProfile: athlete,
  teamProfile: team,
  searchEntities: vi.fn(),
}));
import { SportsController } from "../apps/api/src/sports-controller";
import { GET as athleteProxy } from "../apps/web/app/api/athlete-profile/route";
import { GET as teamProxy } from "../apps/web/app/api/team-profile/route";
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});
it.each(["college-football", "eng.league_cup"])(
  "profile API and browser proxy accept the complete provider league %s",
  async (league) => {
    const controller = new SportsController();
    await controller.athlete({ sport: "football", league, id: "123" });
    await controller.team({ sport: "football", league, id: "123" });
    expect(athlete).toHaveBeenCalledWith("football", league, "123");
    expect(team).toHaveBeenCalledWith("football", league, "123");
    const fetcher = vi.fn(async () => Response.json({ value: { id: "123" } }));
    vi.stubGlobal("fetch", fetcher);
    for (const proxy of [athleteProxy, teamProxy]) {
      expect(
        (
          await proxy(
            new Request(
              `http://localhost/api/profile?sport=football&league=${league}&id=123`,
            ),
          )
        ).status,
      ).toBe(200);
    }
    expect(fetcher.mock.calls).toHaveLength(2);
  },
);
it.each(["..", "../nfl", "nfl/../../private", "https://example.test"])(
  "all profile boundaries reject path-like league %s",
  async (league) => {
    const controller = new SportsController();
    await expect(
      controller.athlete({ sport: "football", league, id: "123" }),
    ).rejects.toThrow("Invalid profile");
    await expect(
      controller.team({ sport: "football", league, id: "123" }),
    ).rejects.toThrow("Invalid profile");
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    for (const proxy of [athleteProxy, teamProxy]) {
      const query = new URLSearchParams({
        sport: "football",
        league,
        id: "123",
      });
      expect(
        (await proxy(new Request(`http://localhost/api/profile?${query}`)))
          .status,
      ).toBe(400);
    }
    expect(fetcher).not.toHaveBeenCalled();
    expect(athlete).not.toHaveBeenCalled();
    expect(team).not.toHaveBeenCalled();
  },
);
