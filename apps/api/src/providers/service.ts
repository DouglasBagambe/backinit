import { ForbiddenException } from "@nestjs/common";
import {
  DemoProvider,
  type EventFeed,
  type SportEvent,
  type Coverage,
} from "../../../../packages/domain/src/index.js";
import { EflProvider, verifiedCupFixtures } from "./efl.js";
import { verifiedSportFixtures } from "./verified-sport.js";
import { ProviderCache } from "./cache.js";
import { OpenLigaProvider } from "./openliga.js";
import { JolpicaProvider } from "./jolpica.js";
import { EspnProvider, espnLeagues } from "./espn.js";
import { WweProvider } from "./wwe.js";
import {
  OfficialBroadcastProvider,
  broadcastPublishers,
} from "./official-broadcasts.js";
export class SportsService {
  private cache = new ProviderCache();
  private football = new OpenLigaProvider(this.cache);
  private cup = new EflProvider(this.cache);
  private racing = new JolpicaProvider(this.cache);
  private espn = new EspnProvider(this.cache);
  private wrestling = new WweProvider(this.cache);
  private broadcasts = broadcastPublishers.map(
    (p) =>
      new OfficialBroadcastProvider(
        p,
        new ProviderCache(fetch, Date.now, 4000),
      ),
  );
  broadcastSources(event: SportEvent) {
    return this.broadcasts.flatMap((p) => p.sourcesFor(event));
  }
  private known = new Map<string, SportEvent>();
  async feed(
    edition: "real" | "demo" = "real",
    date = new Date().toISOString().slice(0, 10),
  ): Promise<EventFeed> {
    if (edition === "demo" && process.env.ALLOW_DEMO_MODE !== "true")
      throw new ForbiddenException("Demo mode is disabled.");
    if (edition === "demo")
      return {
        data: await new DemoProvider().getEvents(),
        source: "Demo API connected",
        edition,
        coverage: [],
      };
    if (
      process.env.SPORTS_PROVIDERS_DISABLED === "true" &&
      process.env.NODE_ENV !== "test"
    )
      return {
        data: [],
        edition: "real",
        source: "Provider ingestion disabled",
        coverage: [
          {
            provider: "Sports providers",
            sport: "All",
            status: "unavailable",
            message:
              "Provider ingestion is disabled. No fixture snapshots are substituted.",
            fetchedAt: null,
          },
        ],
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
    const now = new Date(`${date}T12:00:00Z`);
    if (
      !/^20\d{2}-\d{2}-\d{2}$/.test(date) ||
      !Number.isFinite(now.getTime()) ||
      now.toISOString().slice(0, 10) !== date
    )
      throw new Error("Invalid schedule date");
    const year = now.getUTCFullYear();
    const season = now.getUTCMonth() >= 6 ? year : year - 1;
    const providers = [
      {
        provider: "OpenLigaDB",
        sport: "Football",
        load: () => this.football.events(season),
        message: "Bundesliga fixtures, results and goal events.",
      },
      {
        provider: "Jolpica F1",
        sport: "Formula 1",
        load: () => this.racing.events(year),
        message: "Race schedule and latest classification; no live timing.",
      },
      {
        provider: "EFL official schedule",
        sport: "Football",
        load: () => this.cup.events(),
        message:
          "Official cup schedule; scores supplemented by ESPN when available.",
      },
      {
        provider: "WWE official schedule",
        sport: "WWE",
        load: () => this.wrestling.events(),
        message: "Automated official schedule only; no live results feed.",
      },
      ...this.broadcasts.map((p) => ({
        provider: p.publisher.name,
        sport: p.publisher.sport,
        load: () => p.events(),
        message:
          "Official broadcast sessions and publisher-reported status. Embed availability is checked separately; regional restrictions apply. No scores inferred from video.",
      })),
      ...espnLeagues.map((league) => ({
        provider: `ESPN:${league.path}`,
        sport: league.sport,
        load: () => this.espn.events(league, date),
        message: `${league.label} scoreboard refreshed every 30 seconds. Public undocumented endpoint; availability and reuse terms are not guaranteed.`,
      })),
    ];
    const results = await Promise.allSettled(providers.map((p) => p.load()));
    const coverage: Coverage[] = results.map((r, i) => ({
      provider: providers[i].provider,
      sport: providers[i].sport,
      status:
        r.status === "fulfilled"
          ? r.value.stale
            ? "stale"
            : "available"
          : "unavailable",
      message: providers[i].message,
      fetchedAt: r.status === "fulfilled" ? r.value.fetchedAt : null,
    }));
    coverage.push({
      provider: "Cricket / boxing",
      sport: "Cricket · Boxing",
      status: "not-configured",
      message:
        "No reliable free live feed connected. No manually maintained fixtures are presented as current coverage.",
      fetchedAt: null,
    });
    const all = results.flatMap((r) =>
      r.status === "fulfilled" ? r.value.value : [],
    );
    // Preserve existing cup URLs and source associations while replacing schedule-only
    // records with a provider scoreboard. Match BOTH participants and kickoff.
    const key = (s: string) =>
      s
        .toLowerCase()
        .replace(/\b(afc|fc)\b/g, "")
        .replace(/[^a-z0-9]/g, "");
    const cup = all.filter(
      (e) => e.source?.provider === "EFL official schedule",
    );
    const merged = all
      .filter((e) => e.source?.provider !== "EFL official schedule")
      .map((e) => {
        if (
          e.kind !== "score" ||
          e.source?.provider !== "ESPN:soccer/eng.league_cup"
        )
          return e;
        const official = cup.find(
          (c) =>
            c.kind === "score" &&
            key(c.home) === key(e.home) &&
            key(c.away) === key(e.away) &&
            Math.abs(Date.parse(c.start) - Date.parse(e.start)) < 300000,
        );
        if (!official) return e;
        cup.splice(cup.indexOf(official), 1);
        return {
          ...e,
          id: official.id,
          viewingLinks: official.viewingLinks,
          detail: { ...official.detail, ...e.detail },
        };
      })
      .concat(cup)
      .sort((a, b) => a.start.localeCompare(b.start));
    for (const event of merged) {
      if (this.known.size >= 2000 && !this.known.has(event.id))
        this.known.delete(this.known.keys().next().value!);
      this.known.set(event.id, event);
    }
    return {
      data: merged,
      edition,
      source:
        "Automated provider snapshots · see coverage for availability and freshness",
      coverage,
    };
  }
  async fixture(
    id: string,
    edition: "real" | "demo",
  ): Promise<SportEvent | undefined> {
    const known = this.known.get(id);
    if (
      edition === "real" &&
      known?.source &&
      !known.source.stale &&
      Date.now() - Date.parse(known.source.fetchedAt) < 30000
    )
      return known;
    const date = known?.start.slice(0, 10);
    let event = (await this.feed(edition, date)).data.find((e) => e.id === id);
    if (
      !event &&
      edition === "real" &&
      process.env.SPORTS_PROVIDERS_DISABLED !== "true"
    )
      event = await this.espn.lookup(id).catch(() => undefined);
    return event;
  }
  async event(
    id: string,
    edition: "real" | "demo",
  ): Promise<SportEvent | undefined> {
    const event = await this.fixture(id, edition);
    if (event?.source?.provider.startsWith("ESPN:"))
      event.detail = await this.espn.detail(event).catch(() => event?.detail);
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
