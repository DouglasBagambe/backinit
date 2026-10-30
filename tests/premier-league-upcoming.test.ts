import { expect, it, vi } from "vitest";
import { EspnProvider } from "../apps/api/src/providers/espn";
import { ProviderCache } from "../apps/api/src/providers/cache";
import { premierLeagueViewingLinks } from "../apps/api/src/providers/premier-league-viewing";

it("fetches the coming football week even when Uganda has crossed midnight before UTC", async () => {
  const fetcher = vi.fn(async () =>
    Response.json({
      events: [
        {
          id: "401879248",
          name: "Manchester United at Chelsea",
          date: "2026-10-31T12:30Z",
          status: { type: { state: "pre" } },
          competitions: [
            {
              id: "401879248",
              date: "2026-10-31T12:30Z",
              competitors: [
                { id: "1", homeAway: "home", team: { displayName: "Chelsea" } },
                {
                  id: "2",
                  homeAway: "away",
                  team: { displayName: "Manchester United" },
                },
              ],
            },
          ],
        },
      ],
    }),
  );
  const provider = new EspnProvider(new ProviderCache(fetcher as typeof fetch));
  const result = await provider.events(
    { path: "soccer/eng.1", sport: "Football", label: "Premier League" },
    "2026-10-30",
  );
  expect(String(fetcher.mock.calls[0]?.[0])).toContain(
    "dates=20261030-20261106",
  );
  expect(result.value).toMatchObject([
    {
      id: "espn-soccer-eng-1-401879248",
      home: "Chelsea",
      away: "Manchester United",
      status: "upcoming",
      homeScore: null,
      awayScore: null,
    },
  ]);
  expect(result.value[0]?.viewingLinks).toHaveLength(3);
});

it("does not transfer viewing claims to another match or rescheduled kickoff", () => {
  expect(
    premierLeagueViewingLinks(
      "Manchester United",
      "Chelsea",
      "2026-10-31T12:30Z",
    ),
  ).toEqual([]);
  expect(
    premierLeagueViewingLinks(
      "Chelsea",
      "Manchester United",
      "2026-11-01T12:30Z",
    ),
  ).toEqual([]);
});
