import {
  DemoProvider,
  type EventFeed,
  type SportEvent,
  type Coverage,
} from "../../../../packages/domain/src/index.js";
import { EflProvider, verifiedCupFixtures } from "./efl.js";
import { verifiedSportFixtures } from "./verified-sport.js";
import { TeamIdentities } from "./identities.js";
import { ProviderCache } from "./cache.js";
import { OpenLigaProvider } from "./openliga.js";
import { JolpicaProvider } from "./jolpica.js";
export class SportsService {
  private cache = new ProviderCache();
  private identities = new TeamIdentities(
    new ProviderCache(fetch, Date.now, 3000),
  );
  private football = new OpenLigaProvider(this.cache);
  private cup = new EflProvider(this.cache);
  private racing = new JolpicaProvider(this.cache);
  async feed(edition: "real" | "demo" = "real"): Promise<EventFeed> {
    if (edition === "demo")
      return {
        data: await new DemoProvider().getEvents(),
        source: "Demo API connected",
        edition,
        coverage: [],
      };
    if (process.env.SPORTS_PROVIDERS_DISABLED === "true")
      return {
        data: [...verifiedCupFixtures, ...verifiedSportFixtures],
        edition: "real",
        source:
          "Automatic ingestion paused · verified official fixture snapshots",
        coverage: [
          {
            provider: "Sports providers",
            sport: "All",
            status: "unavailable",
            message: "Provider ingestion is paused on this installation.",
            fetchedAt: null,
          },
        ],
      };
    const metadata = this.identities.enrich([
      ...verifiedCupFixtures,
      ...verifiedSportFixtures,
    ]);
    const now = new Date();
    const year = now.getUTCFullYear();
    const season = now.getUTCMonth() >= 6 ? year : year - 1;
    const results = await Promise.allSettled([
      this.football.events(season),
      this.racing.events(year),
      this.cup.events(),
    ]);
    const coverage: Coverage[] = results.map((r, index) => ({
      provider:
        index === 0
          ? "OpenLigaDB"
          : index === 1
            ? "Jolpica F1"
            : "EFL official schedule",
      sport: index === 1 ? "Formula 1" : "Football",
      status:
        r.status === "fulfilled"
          ? r.value.stale
            ? "stale"
            : "available"
          : "unavailable",
      message:
        index === 0
          ? "Bundesliga · community fixtures, results and goals. No live clock, lineups or positions."
          : index === 1
            ? "Season schedule and latest race classification. No live timing."
            : "Official cup fixtures. Schedule only: live scores, lineups and match events are not connected.",
      fetchedAt: r.status === "fulfilled" ? r.value.fetchedAt : null,
    }));
    coverage.push({
      provider: "Verified official fixtures",
      sport: "Basketball · WWE · MMA · Tennis · Cricket · Baseball",
      status: "available",
      message:
        "Limited official schedule facts, checked 28 October 2026. Not comprehensive coverage or a live score feed.",
      fetchedAt: verifiedSportFixtures[0]!.source!.fetchedAt,
    });
    await metadata;
    return {
      data: await this.identities.enrich(
        results
          .flatMap((r) => (r.status === "fulfilled" ? r.value.value : []))
          .concat(verifiedSportFixtures)
          .sort((a, b) => a.start.localeCompare(b.start)),
      ),
      source:
        "OpenLigaDB (ODbL) · Jolpica F1 · EFL official schedule · Verified official fixtures",
      edition,
      coverage,
    };
  }
  async event(
    id: string,
    edition: "real" | "demo",
  ): Promise<SportEvent | undefined> {
    const event = (await this.feed(edition)).data.find((e) => e.id === id);
    if (event?.source?.provider === "OpenLigaDB") {
      const year = new Date(event.start).getUTCFullYear();
      const season = new Date(event.start).getUTCMonth() >= 6 ? year : year - 1;
      const table = await this.football.standings(season).catch(() => null);
      if (table && !table.stale)
        event.detail = { ...event.detail, standings: table.value };
    }
    return event;
  }
  async standings() {
    const now = new Date();
    return this.football.standings(
      now.getUTCMonth() >= 6 ? now.getUTCFullYear() : now.getUTCFullYear() - 1,
    );
  }
}

export const service = new SportsService();
