import { z } from "zod";
import type { Broadcast } from "../../../../packages/domain/src/index.js";

const origin = "https://matchora.to";
const eventSchema = z.object({
  id: z.string().regex(/^\d{1,24}$/),
  home: z.string().trim().min(1).max(140),
  away: z.string().trim().min(1).max(140),
  league: z.string().trim().min(1).max(100),
  kickoff: z.number().int().positive().max(4102444800),
  live: z.boolean(),
  embed_url: z.string(),
});

export function parseMatchora(raw: unknown, now: number): Broadcast[] {
  const { events } = z.object({ events: z.array(z.unknown()) }).parse(raw);
  const broadcasts = new Map<string, Broadcast>();
  for (const candidate of events) {
    const parsed = eventSchema.safeParse(candidate);
    if (!parsed.success) continue;
    const event = parsed.data;
    const url = `${origin}/embed/match/${event.id}`;
    if (event.embed_url !== url) continue;
    const start = event.kickoff * 1000;
    // The schedule has kickoff and live status, but no planned end time.
    const end = start + 3 * 60 * 60 * 1000;
    if (!event.live && start <= now) continue;
    const id = `matchora-${event.id}`;
    broadcasts.set(id, {
      id,
      title: `${event.home} vs ${event.away}`,
      category: "Football",
      competition: event.league,
      poster: null,
      start,
      end: event.live ? Math.max(end, now + 60_000) : end,
      channel: false,
      viewers: null,
      pageUrl: url,
      sources: [{ id, label: "Matchora", url }],
      replay: false,
    });
  }
  return [...broadcasts.values()];
}

export class MatchoraCatalogue {
  private snapshot: Broadcast[] = [];
  private refreshAt = 0;
  private pending?: Promise<Broadcast[]>;

  constructor(
    private readonly fetcher: typeof fetch = fetch,
    private readonly now = Date.now,
  ) {}

  feed(): Promise<Broadcast[]> {
    if (this.pending) return this.pending;
    if (this.now() < this.refreshAt) return Promise.resolve(this.snapshot);
    this.pending = this.refresh().finally(() => {
      this.refreshAt = this.now() + 60_000;
      this.pending = undefined;
    });
    return this.pending;
  }

  private async refresh(): Promise<Broadcast[]> {
    try {
      const response = await this.fetcher(
        `${origin}/api/v1/schedule?watchable=1`,
        { cache: "no-store", redirect: "error", signal: AbortSignal.timeout(6000) },
      );
      if (!response.ok) return this.snapshot;
      this.snapshot = parseMatchora(await response.json(), this.now());
    } catch {
      // An upstream outage must not take down the PPV catalogue.
    }
    return this.snapshot;
  }
}

export const matchoraCatalogue = new MatchoraCatalogue();
