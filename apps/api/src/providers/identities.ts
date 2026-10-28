import { z } from "zod";
import type {
  SportEvent,
  Sport,
} from "../../../../packages/domain/src/index.js";
import { ProviderCache } from "./cache.js";
const teamSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  shortDisplayName: z.string().optional(),
  name: z.string().optional(),
  location: z.string().optional(),
  logos: z
    .array(z.object({ href: z.string(), rel: z.array(z.string()).optional() }))
    .optional(),
});
const catalogueSchema = z.object({
  sports: z.array(
    z.object({
      leagues: z.array(
        z.object({ teams: z.array(z.object({ team: teamSchema })) }),
      ),
    }),
  ),
});
export function safeTeamImage(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const u = new URL(value);
    return u.protocol === "https:" &&
      !u.username &&
      !u.password &&
      !u.port &&
      ["a.espncdn.com", "upload.wikimedia.org", "i.imgur.com"].includes(
        u.hostname,
      )
      ? u.href
      : undefined;
  } catch {
    return undefined;
  }
}
const normalizeName = (name: string) =>
  name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\b(f\.?c\.?|a\.?f\.?c\.?)\b/g, "")
    .replace(/[^a-z0-9]/g, "");
export function parseTeamCatalogue(raw: unknown, league: string) {
  return catalogueSchema.parse(raw).sports.flatMap((s) =>
    s.leagues.flatMap((l) =>
      l.teams.map(({ team: t }) => ({
        id: t.id,
        provider: `ESPN:${league}`,
        name: t.displayName,
        imageUrl: safeTeamImage(
          t.logos?.find((l) => l.rel?.includes("default"))?.href ||
            t.logos?.[0]?.href,
        ),
        sourceUrl: `https://www.espn.com/`,
        aliases: [
          ...new Set(
            [
              t.displayName,
              t.shortDisplayName,
              t.name,
              t.location && t.name ? `${t.location} ${t.name}` : undefined,
            ]
              .filter((n): n is string => !!n)
              .map(normalizeName),
          ),
        ],
      })),
    ),
  );
}
export function matchTeam(
  catalogue: ReturnType<typeof parseTeamCatalogue>,
  name: string,
) {
  const candidates = catalogue.filter((t) =>
    t.aliases.includes(normalizeName(name)),
  );
  if (candidates.length !== 1) return undefined; // Never guess ambiguous or partial names.
  const { aliases, ...identity } = candidates[0]!;
  return identity;
}
function leagueFor(event: SportEvent) {
  if (
    event.source?.provider === "EFL official schedule" &&
    event.sport === "Football"
  )
    return "soccer/eng.1";
  if (event.sport === "Basketball" && /\bNBA\b/i.test(event.competition))
    return "basketball/nba";
  if (event.sport === "American football" && /\bNFL\b/i.test(event.competition))
    return "football/nfl";
  if (event.sport === "Baseball" && /\bMLB\b/i.test(event.competition))
    return "baseball/mlb";
  return undefined;
}
/** Public, undocumented metadata catalogue: no broadcast entitlement or SLA.
 * Only requested sports are loaded, once per day, using the bounded shared cache.
 * Existing provider identities take precedence; failed/ambiguous lookups leave them unchanged.
 */
export class TeamIdentities {
  private failedUntil = new Map<string, number>();
  constructor(private readonly cache: ProviderCache) {}
  async enrich(events: SportEvent[]) {
    if (process.env.TEAM_METADATA_DISABLED === "true") return events;
    const sports = [
      ...new Set(
        events
          .filter(
            (e) =>
              e.kind === "score" &&
              e.provenance === "provider" &&
              !!leagueFor(e),
          )
          .map((e) => e.sport),
      ),
    ];
    const catalogues = new Map<Sport, ReturnType<typeof parseTeamCatalogue>>();
    await Promise.all(
      sports.map(async (sport) => {
        const league = events
          .filter((e) => e.sport === sport)
          .map(leagueFor)
          .find(Boolean);
        if (!league || (this.failedUntil.get(league) || 0) > Date.now()) return;
        try {
          const result = await this.cache.json(
            `https://site.api.espn.com/apis/site/v2/sports/${league}/teams?limit=1000`,
            86400000,
            (raw) => parseTeamCatalogue(raw, league),
          );
          catalogues.set(sport, result.value);
        } catch {
          this.failedUntil.set(league, Date.now() + 60000);
          /* Metadata failure must not suppress fixtures. */
        }
      }),
    );
    return events.map((event) => {
      if (
        event.kind !== "score" ||
        event.provenance !== "provider" ||
        !leagueFor(event)
      )
        return event;
      const catalogue = catalogues.get(event.sport) || [];
      return {
        ...event,
        homeParticipant: event.homeParticipant?.imageUrl
          ? event.homeParticipant
          : matchTeam(catalogue, event.home) || event.homeParticipant,
        awayParticipant: event.awayParticipant?.imageUrl
          ? event.awayParticipant
          : matchTeam(catalogue, event.away) || event.awayParticipant,
      };
    });
  }
}
