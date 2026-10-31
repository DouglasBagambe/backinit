import { z } from "zod";
import { type SportEvent } from "../../../../packages/domain/src/index.js";
import { ProviderCache } from "./cache.js";

const supported: Record<string, string> = {
  Football: "football",
  Basketball: "basketball",
  Tennis: "tennis",
  Cricket: "cricket",
};
const row = z.object({
  home: z.string(),
  away: z.string(),
  time: z.string(),
  url: z.string(),
  status: z.string(),
});
const fixtures = z.object({
  sport: z.string(),
  matches: z.array(row).max(200),
});
const teamSearch = z.object({
  sport: z.string(),
  teams: z
    .array(
      z.object({
        name: z.string(),
        slug: z.string().regex(/^[a-z0-9-]{1,160}$/),
      }),
    )
    .max(200),
});
const detail = z.object({
  sport: z.string(),
  updated: z.string(),
  match: row.extend({
    tracker: z
      .object({ id: z.string().min(1), sport: z.string() })
      .nullable()
      .optional(),
  }),
});
const name = (value: string) =>
  value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
// The official club/league pages use these full senior-club names:
// https://www.laliga.com/es-GB/partido/temporada-2026-2027-laliga-ea-sports-fc-barcelona-deportivo-alaves-11
// Scope short-name aliases to ESPN's soccer participant IDs. "Barcelona"
// alone also finds unrelated clubs and can fill a whole search result page.
const footballIdentities: Record<string, { label: string; names: string[] }> = {
  "83": { label: "FC Barcelona", names: ["barcelona", "fcbarcelona"] },
  "96": { label: "Deportivo Alavés", names: ["alaves", "deportivoalaves"] },
};
function participantLabel(event: SportEvent, value: string) {
  if (event.sport === "Football" && event.kind === "score") {
    for (const participant of [event.homeParticipant, event.awayParticipant]) {
      if (!participant?.provider.startsWith("ESPN:soccer/")) continue;
      const identity = footballIdentities[participant.id];
      if (identity?.names.includes(name(value))) return identity.label;
    }
  }
  return value;
}
function participantName(event: SportEvent, value: string): string {
  if (event.sport === "Tennis" && value.includes("/"))
    // Partnership order is presentation, not match identity. Preserve each
    // complete name and all partners; never match surnames or initials alone.
    return value
      .split("/")
      .map((partner) => participantName(event, partner))
      .sort()
      .join("/");
  const sport = event.sport;
  value = participantLabel(event, value);
  const normalized = name(value);
  // The senior club's official name is FC Internazionale Milano (inter.it).
  // ESPN calls it Internazionale; the publisher calls it Inter Milan.
  // Keep youth/women's teams and other clubs containing "Inter" distinct.
  if (
    sport === "Football" &&
    ["internazionale", "intermilan"].includes(normalized)
  )
    return "fcinternazionalemilano";
  // RFET's published player record names Carlos Alcaraz Garfia;
  // ESPN uses Carlos Alcaraz. Keep this an explicit identity alias,
  // rather than accepting arbitrary first-name/surname prefix matches.
  // https://www.rfet.es/media/file/competicion/masinfo/626_Documento.pdf
  return sport === "Tennis" && normalized === "carlosalcarazgarfia"
    ? "carlosalcaraz"
    : normalized;
}
function same(event: SportEvent, value: z.infer<typeof row>) {
  if (event.kind !== "score") return false;
  const home = participantName(event, event.home);
  const away = participantName(event, event.away);
  const vendorHome = participantName(event, value.home);
  const vendorAway = participantName(event, value.away);
  // Tennis does not have home/away teams. Providers can list the same two
  // players (or doubles partnerships) in opposite order.
  const participantsMatch =
    (home === vendorHome && away === vendorAway) ||
    (event.sport === "Tennis" && home === vendorAway && away === vendorHome);
  return (
    participantsMatch &&
    Number.isFinite(Date.parse(value.time)) &&
    // Tennis court schedules move as earlier matches finish. Exact participants,
    // the same UTC day and a unique listing still bind the match identity.
    (event.sport !== "Tennis" ||
      event.start.slice(0, 10) ===
        new Date(value.time).toISOString().slice(0, 10)) &&
    Math.abs(Date.parse(event.start) - Date.parse(value.time)) <=
      (event.sport === "Tennis" ? 180 : 10) * 60000
  );
}
function matchSlug(path: string, sport: string) {
  const escaped = new RegExp(
    `^/${sport}/match/([a-z0-9-]{1,220})(?:/[a-z0-9]{1,40})?/$`,
  );
  return escaped.exec(path)?.[1];
}

/** Public documented attribution-tier API. Uses the publisher's own embed, not its upstream credentials or private feed. */
export class MatchTrackerProvider {
  constructor(
    private cache = new ProviderCache(fetch, Date.now, 8000),
    private now = Date.now,
  ) {}
  async forEvent(event: SportEvent) {
    const sport = supported[event.sport];
    if (
      !sport ||
      event.kind !== "score" ||
      event.provenance !== "provider" ||
      event.source?.stale ||
      event.scheduleOnly ||
      event.status !== "live" ||
      process.env.SPORTS_PROVIDERS_DISABLED === "true"
    )
      return null;
    const day = event.start.slice(0, 10);
    const list = await this.cache.json(
      `https://sportscore.com/api/v1/fixtures/?${new URLSearchParams({ sport, date: day, status: "live", limit: "200" })}`,
      60000,
      (raw) => fixtures.parse(raw),
    );
    if (list.stale) throw new Error("Tracker discovery temporarily stale");
    if (list.value.sport !== sport) return null;
    let matches = list.value.matches.filter(
      (r) => same(event, r) && r.status === "live",
    );
    if (matches.length === 0 && event.sport !== "Tennis") {
      // Busy live lists can omit a covered game. Resolve the publisher's
      // exact team identity before requesting its narrower fixture list.
      const search = await this.cache.json(
        `https://sportscore.com/api/v1/search/?${new URLSearchParams({ sport, q: participantLabel(event, event.home), limit: "20" })}`,
        3600000,
        (raw) => teamSearch.parse(raw),
      );
      if (search.stale || search.value.sport !== sport) return null;
      const teams = search.value.teams.filter(
        (team) =>
          participantName(event, team.name) ===
          participantName(event, event.home),
      );
      if (teams.length !== 1) return null;
      const scoped = await this.cache.json(
        `https://sportscore.com/api/v1/fixtures/?${new URLSearchParams({ sport, date: day, team: teams[0]!.slug, limit: "200" })}`,
        60000,
        (raw) => fixtures.parse(raw),
      );
      if (scoped.stale || scoped.value.sport !== sport) return null;
      matches = scoped.value.matches.filter(
        (r) => same(event, r) && r.status === "live",
      );
    }
    if (matches.length !== 1) return null;
    const slug = matchSlug(matches[0]!.url, sport);
    if (!slug) return null;
    const result = await this.cache.json(
      `https://sportscore.com/api/widget/match/?${new URLSearchParams({ sport, slug })}`,
      60000,
      (raw) => detail.parse(raw),
    );
    const value = result.value;
    const updated = Date.parse(value.updated);
    if (result.stale) throw new Error("Tracker metadata temporarily stale");
    if (
      value.sport !== sport ||
      !same(event, value.match) ||
      value.match.status !== "live" ||
      value.match.tracker?.sport !== sport ||
      !Number.isFinite(updated) ||
      this.now() - updated > 5 * 60000 ||
      updated > this.now() + 60000
    )
      return null;
    const canonical = matchSlug(value.match.url, sport);
    if (!canonical) return null;
    return {
      provider: "SportScore" as const,
      eventId: event.id,
      url: `https://sportscore.com/embed/tracker/${sport}/${canonical}/`,
      sourceUrl: "https://sportscore.com/",
      checkedAt: result.fetchedAt,
      validUntil: new Date(Date.parse(result.fetchedAt) + 120000).toISOString(),
      kind: "publisher-tracker" as const,
    };
  }
}
