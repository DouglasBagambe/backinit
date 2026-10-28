import { describe, it, expect, vi } from "vitest";
import {
  TeamIdentities,
  parseTeamCatalogue,
  matchTeam,
  safeTeamImage,
} from "../apps/api/src/providers/identities";
import { ProviderCache } from "../apps/api/src/providers/cache";
import { verifiedCupFixtures } from "../apps/api/src/providers/efl";
const catalogue = (teams: unknown[]) => ({
  sports: [{ leagues: [{ teams: teams.map((team) => ({ team })) }] }],
});
const brighton = {
  id: "331",
  displayName: "Brighton & Hove Albion",
  shortDisplayName: "Brighton",
  logos: [
    {
      href: "https://a.espncdn.com/i/teamlogos/soccer/500/331.png",
      rel: ["default"],
    },
  ],
};
describe("provider participant identities", () => {
  it("uses exact provider aliases and stable IDs, never partial or ambiguous names", () => {
    const teams = parseTeamCatalogue(catalogue([brighton]), "soccer/eng.1");
    expect(matchTeam(teams, "Brighton & Hove Albion")).toMatchObject({
      id: "331",
      provider: "ESPN:soccer/eng.1",
      imageUrl: brighton.logos[0]!.href,
    });
    expect(matchTeam(teams, "Brighton")).toBeDefined();
    expect(matchTeam(teams, "Hove")).toBeUndefined();
    expect(matchTeam([...teams, ...teams], "Brighton")).toBeUndefined();
  });
  it("rejects unsafe image origins, embedded data, credentials and non-HTTPS URLs", () => {
    for (const u of [
      "http://a.espncdn.com/a.png",
      "data:image/svg+xml,xx",
      "https://127.0.0.1/a",
      "https://a.espncdn.com.evil.test/a",
      "https://u:p@a.espncdn.com/a",
      "https://a.espncdn.com:444/a",
    ])
      expect(safeTeamImage(u)).toBeUndefined();
  });
  it("enriches fixtures without rewriting names and caches whole team catalogues", async () => {
    const fetcher = vi.fn(async () =>
      Response.json(catalogue([brighton])),
    ) as unknown as typeof fetch;
    const provider = new TeamIdentities(new ProviderCache(fetcher));
    const fixture = verifiedCupFixtures[0]!;
    const first = await provider.enrich([fixture]);
    const next = await provider.enrich([fixture]);
    expect(first[0]!.kind === "score" && first[0]!.awayParticipant?.id).toBe(
      "331",
    );
    expect(first[0]!.kind === "score" && first[0]!.away).toBe(
      "Brighton & Hove Albion",
    );
    expect(next).toEqual(first);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("does not assign English badges to teams from another league or fabricate them on failure", async () => {
    const fetcher = vi.fn(async () => {
      throw new Error("offline");
    }) as unknown as typeof fetch;
    const provider = new TeamIdentities(new ProviderCache(fetcher));
    const fixture = verifiedCupFixtures[0]!;
    expect(await provider.enrich([fixture])).toEqual([fixture]);
    expect(await provider.enrich([fixture])).toEqual([fixture]);
    const other = {
      ...fixture,
      source: { ...fixture.source!, provider: "Other league" },
      competition: "Different league",
    };
    expect(await provider.enrich([other])).toEqual([other]);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
