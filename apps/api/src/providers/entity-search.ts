import { z } from "zod";
import { ProviderCache } from "./cache.js";
import { safeTeamImage } from "./identities.js";
const cache = new ProviderCache();
const sportNames: Record<string, string> = {
  soccer: "Football",
  basketball: "Basketball",
  tennis: "Tennis",
  football: "American football",
  hockey: "Ice hockey",
  baseball: "Baseball",
  mma: "MMA",
  rugby: "Rugby",
  cricket: "Cricket",
  racing: "Formula 1",
};
const itemSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  type: z.enum(["player", "team"]),
  sport: z.string(),
  league: z.string().optional(),
  headshot: z.object({ href: z.string() }).optional(),
  logos: z.array(z.object({ href: z.string() })).optional(),
});
export async function searchEntities(query: string, store = cache) {
  const results = await Promise.allSettled(
    ["player", "team"].map((type) =>
      store.json(
        `https://site.api.espn.com/apis/common/v3/search?query=${encodeURIComponent(query)}&type=${type}&limit=12`,
        60000,
        (raw) =>
          z
            .object({ items: z.array(z.unknown()) })
            .parse(raw)
            .items.flatMap((item) => {
              const parsed = itemSchema.safeParse(item);
              if (!parsed.success) return [];
              const e = parsed.data;
              if (!sportNames[e.sport]) return [];
              return [
                {
                  id: e.id,
                  name: e.displayName,
                  kind:
                    e.type === "player"
                      ? ("athlete" as const)
                      : ("team" as const),
                  sport: sportNames[e.sport]!,
                  providerSport: e.sport,
                  league: e.league || "",
                  image: safeTeamImage(e.headshot?.href || e.logos?.[0]?.href),
                },
              ];
            }),
      ),
    ),
  );
  if (results.every((r) => r.status === "rejected"))
    throw Error("Search unavailable");
  return {
    data: results.flatMap((r) =>
      r.status === "fulfilled" ? r.value.value : [],
    ),
    partial: results.some((r) => r.status === "rejected"),
    provider: "ESPN",
  };
}
export async function athleteProfile(
  sport: string,
  league: string,
  id: string,
) {
  if (
    !sportNames[sport] ||
    !/^[a-z0-9.]{1,40}$/.test(league) ||
    !/^\d{1,15}$/.test(id)
  )
    throw Error("Invalid profile");
  const schema = z.object({
    athlete: z.object({
      id: z.string(),
      displayName: z.string(),
      position: z.object({ displayName: z.string() }).optional(),
      team: z.object({ id: z.string(), displayName: z.string() }).optional(),
      headshot: z.object({ href: z.string() }).optional(),
      displayHeight: z.string().optional(),
      displayWeight: z.string().optional(),
      displayDOB: z.string().optional(),
      age: z.number().optional(),
      jersey: z.string().optional(),
      citizenship: z.string().optional(),
      statsSummary: z
        .object({
          displayName: z.string(),
          statistics: z.array(
            z.object({ displayName: z.string(), displayValue: z.string() }),
          ),
        })
        .optional(),
    }),
  });
  const result = await cache.json(
    `https://site.api.espn.com/apis/common/v3/sports/${sport}/${league}/athletes/${id}`,
    300000,
    (raw) => {
      const a = schema.parse(raw).athlete;
      if (a.id !== id) throw Error("Wrong athlete");
      return {
        id: a.id,
        name: a.displayName,
        sport: sportNames[sport]!,
        position: a.position?.displayName,
        team: a.team,
        image: safeTeamImage(a.headshot?.href),
        height: a.displayHeight,
        weight: a.displayWeight,
        birthDate: a.displayDOB,
        age: a.age,
        jersey: a.jersey,
        country: a.citizenship,
        statistics: a.statsSummary,
      };
    },
  );
  return result;
}

export async function teamProfile(sport: string, league: string, id: string) {
  if (
    !sportNames[sport] ||
    !/^[a-z0-9.]{1,40}$/.test(league) ||
    !/^\d{1,15}$/.test(id)
  )
    throw Error("Invalid profile");
  const { normalizeScoreboard, espnLeagues } = await import("./espn.js");
  const descriptor = {
    path: `${sport}/${league}`,
    sport: sportNames[
      sport
    ] as import("../../../../packages/domain/src/index.js").Sport,
    label:
      espnLeagues.find((l) => l.path === `${sport}/${league}`)?.label || league,
  };
  const base = `https://site.api.espn.com/apis/site/v2/sports/${sport}/${league}/teams/${id}`;
  const results = await Promise.allSettled([
    cache.json(`${base}/schedule`, 60000, (raw) => {
      const d = z
        .object({
          team: z.object({ displayName: z.string() }),
          events: z.array(z.unknown()),
        })
        .parse(raw);
      return {
        name: d.team.displayName,
        events: normalizeScoreboard(
          { events: d.events },
          descriptor,
          new Date().toISOString(),
          false,
        ),
      };
    }),
    cache.json(`${base}/roster`, 300000, (raw) => {
      const person = z.object({
        id: z.string(),
        displayName: z.string(),
        jersey: z.string().optional(),
        position: z.object({ displayName: z.string() }).optional(),
      });
      const d = z
        .object({
          athletes: z.array(z.unknown()),
          team: z.object({ displayName: z.string() }).optional(),
        })
        .parse(raw);
      return d.athletes
        .flatMap((a) => {
          const group = z.object({ items: z.array(person) }).safeParse(a);
          if (group.success) return group.data.items;
          const p = person.safeParse(a);
          return p.success ? [p.data] : [];
        })
        .map((p) => ({
          id: p.id,
          name: p.displayName,
          jersey: p.jersey,
          position: p.position?.displayName,
        }));
    }),
  ]);
  if (results.every((r) => r.status === "rejected"))
    throw Error("Team profile unavailable");
  const schedule = results[0],
    roster = results[1];
  return {
    data: schedule.status === "fulfilled" ? schedule.value.value.events : [],
    name:
      schedule.status === "fulfilled" ? schedule.value.value.name : undefined,
    players: roster.status === "fulfilled" ? roster.value.value : [],
    stale: results.some((r) => r.status === "fulfilled" && r.value.stale),
  };
}
