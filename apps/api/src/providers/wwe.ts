import {
  eventSchema,
  type SportEvent,
} from "../../../../packages/domain/src/index.js";
import { ProviderCache } from "./cache.js";
const text = (s: string) =>
  s
    .replace(/<[^>]*>/g, "")
    .replaceAll("&amp;", "&")
    .replaceAll("&#039;", "'")
    .replaceAll("&quot;", '"')
    .trim();
export function normalizeWwe(
  html: unknown,
  fetchedAt: string,
  stale: boolean,
): SportEvent[] {
  if (typeof html !== "string") throw new Error("Invalid WWE schedule");
  const events = new Map<string, SportEvent>();
  for (const row of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const link = row[1].match(
      /<h2[^>]*class="events-upcoming-header"[^>]*>\s*<a href="(\/event\/[a-z0-9-]+)"[^>]*>([\s\S]*?)<\/a>/i,
    );
    const date = row[1].match(/<time datetime="([^"]+)"/);
    if (!link || !date || !Number.isFinite(Date.parse(date[1]))) continue;
    const slug = link[1].split("/").pop()!;
    events.set(
      slug,
      eventSchema.parse({
        id: `wwe-${slug}`.slice(0, 80),
        externalId: slug,
        kind: "card",
        sport: "WWE",
        competition: "WWE",
        title: text(link[2]),
        start: new Date(date[1]).toISOString(),
        status:
          Date.parse(date[1]) < Date.parse(fetchedAt) ? "unknown" : "upcoming",
        scheduleOnly: true,
        provenance: "provider",
        bouts: [],
        source: {
          provider: "WWE official schedule",
          url: `https://www.wwe.com${link[1]}`,
          license:
            "Officially published event facts; no broadcast rights implied",
          fetchedAt,
          stale,
        },
        detail: {
          venue:
            text(row[1].match(/<\/time>\s*\|\s*([^<]+)/)?.[1] || "") || null,
        },
      }),
    );
  }
  if (!events.size)
    throw new Error("WWE schedule markup changed or no events returned");
  return [...events.values()];
}
export class WweProvider {
  constructor(private cache: ProviderCache) {}
  async events() {
    const r = await this.cache.json(
      "https://www.wwe.com/events/results/all-events/all-dates/0/0/all/US",
      900000,
      (raw) => raw,
      {},
      (response) => response.text(),
    );
    return { ...r, value: normalizeWwe(r.value, r.fetchedAt, r.stale) };
  }
}
