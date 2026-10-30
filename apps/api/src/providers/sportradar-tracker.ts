import { z } from "zod";
import {
  type SportEvent,
  type TrackerSource,
} from "../../../../packages/domain/src/index.js";

const configuration = z.object({
  clientId: z.string().regex(/^[a-f0-9]{32}$/),
  matches: z
    .array(
      z
        .object({
          eventId: z.string().regex(/^[a-z0-9-]{1,80}$/),
          matchId: z.string().regex(/^sr:match:[1-9][0-9]{0,14}$/),
          sport: z.string().min(1),
          home: z.string().min(1),
          away: z.string().min(1),
          start: z.string().datetime(),
        })
        .strict(),
    )
    .max(2000),
});

/** Pilot mappings must come from our licensed Sportradar feed or dashboard.
 * Never infer Sportradar IDs from ESPN IDs, or reuse another customer's Client ID.
 */
export class SportradarTrackerProvider {
  constructor(private now = Date.now) {}

  forEvent(event: SportEvent): TrackerSource | null {
    if (
      !process.env.SPORTRADAR_CLIENT_ID ||
      !process.env.SPORTRADAR_TRACKER_MATCHES ||
      process.env.SPORTS_PROVIDERS_DISABLED === "true" ||
      event.kind !== "score" ||
      event.provenance !== "provider" ||
      event.status !== "live" ||
      event.source?.stale ||
      event.scheduleOnly
    )
      return null;
    let parsed: z.infer<typeof configuration>;
    try {
      parsed = configuration.parse({
        clientId: process.env.SPORTRADAR_CLIENT_ID,
        matches: JSON.parse(process.env.SPORTRADAR_TRACKER_MATCHES),
      });
    } catch {
      return null;
    }
    const matches = parsed.matches.filter((row) => row.eventId === event.id);
    if (matches.length !== 1) return null;
    const match = matches[0]!;
    if (
      match.home !== event.home ||
      match.away !== event.away ||
      match.sport !== event.sport ||
      Date.parse(match.start) !== Date.parse(event.start)
    )
      return null;
    const now = this.now();
    return {
      provider: "Sportradar",
      eventId: event.id,
      kind: "publisher-tracker",
      clientId: parsed.clientId,
      matchId: match.matchId,
      checkedAt: new Date(now).toISOString(),
      validUntil: new Date(now + 120000).toISOString(),
    };
  }
}
