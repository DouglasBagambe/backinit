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
function same(event: SportEvent, value: z.infer<typeof row>) {
  return (
    event.kind === "score" &&
    name(event.home) === name(value.home) &&
    name(event.away) === name(value.away) &&
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
    const matches = list.value.matches.filter(
      (r) => same(event, r) && r.status === "live",
    );
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
