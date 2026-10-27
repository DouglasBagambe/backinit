import {
  DemoProvider,
  type EventFeed,
  type SportEvent,
  type Coverage,
} from "../../../../packages/domain/src/index.js";
import { ProviderCache } from "./cache.js";
import { OpenLigaProvider } from "./openliga.js";
import { JolpicaProvider } from "./jolpica.js";
export class SportsService {
  private cache = new ProviderCache();
  private football = new OpenLigaProvider(this.cache);
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
        data: [],
        edition: "real",
        source: "Provider ingestion paused",
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
    const now = new Date();
    const year = now.getUTCFullYear();
    const season = now.getUTCMonth() >= 6 ? year : year - 1;
    const results = await Promise.allSettled([
      this.football.events(season),
      this.racing.events(year),
    ]);
    const coverage: Coverage[] = results.map((r, index) => ({
      provider: index === 0 ? "OpenLigaDB" : "Jolpica F1",
      sport: index === 0 ? "Football" : "Formula 1",
      status:
        r.status === "fulfilled"
          ? r.value.stale
            ? "stale"
            : "available"
          : "unavailable",
      message:
        index === 0
          ? "Bundesliga · community fixtures, results and goals. No live clock, lineups or positions."
          : "Season schedule and latest race classification. No live timing.",
      fetchedAt: r.status === "fulfilled" ? r.value.fetchedAt : null,
    }));
    coverage.push({
      provider: "No provider configured",
      sport: "NBA · WWE · UFC · Tennis · Cricket · Other sports",
      status: "not-configured",
      message:
        "Real coverage unavailable. These sports are available as clearly labeled UI demos only where supplied.",
      fetchedAt: null,
    });
    return {
      data: results
        .flatMap((r) => (r.status === "fulfilled" ? r.value.value : []))
        .sort((a, b) => a.start.localeCompare(b.start)),
      source: "OpenLigaDB (ODbL) · Jolpica F1 · Limited real coverage",
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
