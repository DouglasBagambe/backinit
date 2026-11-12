import {
  participantKey,
  type Broadcast,
  type BroadcastFeed,
} from "../../../../packages/domain/src/index.js";
import { ppvCatalogue } from "./ppv-catalogue.js";
import { additionalCatalogues } from "./additional-catalogues.js";

function titleKey(title: string) {
  return title
    .toLowerCase()
    .split(/\s+(?:vs?\.?|versus|at)\s+/)
    .map(participantKey)
    .sort()
    .join("|");
}
function sportKey(sport: string) {
  return sport.toLowerCase().replace("motorsports", "motorsport");
}
/** Conservative match: same sport, participants/title and start within 15 minutes.
 * Channels with the exact same title merge; unrelated dates/replays never do. */
export function mergeBroadcasts(feeds: Broadcast[][]): Broadcast[] {
  const result: Broadcast[] = [];
  for (const item of feeds.flat()) {
    const existing = result.find(
      (b) =>
        b.channel === item.channel &&
        b.replay === item.replay &&
        titleKey(b.title) === titleKey(item.title) &&
        (b.channel ||
          (sportKey(b.category) === sportKey(item.category) &&
            Math.abs(b.start - item.start) <= 15 * 60000)),
    );
    const target = existing || { ...item, sources: [] };
    if (!existing) result.push(target);
    const urls = new Set(target.sources.map((s) => s.url));
    for (const source of item.sources) {
      if (urls.has(source.url)) continue;
      urls.add(source.url);
      target.sources.push({
        ...source,
        label: `Stream ${target.sources.length + 1}`,
      });
    }
    if (!target.poster && item.poster) target.poster = item.poster;
  }
  return result;
}
export class BroadcastCatalogue {
  constructor(
    private providers: { feed(): Promise<BroadcastFeed> }[] = [
      ppvCatalogue,
      ...additionalCatalogues,
    ],
  ) {}
  async feed(): Promise<BroadcastFeed> {
    const results = await Promise.allSettled(
      this.providers.map((p) => p.feed()),
    );
    const feeds = results.flatMap((r) =>
      r.status === "fulfilled" ? [r.value] : [],
    );
    const dated = feeds.filter((f) => f.updatedAt);
    const data = mergeBroadcasts(feeds.map((f) => f.data));
    const partial =
      results.some((r) => r.status === "rejected") ||
      feeds.some((f) => f.stale);
    return {
      data,
      updatedAt: dated.map((f) => f.updatedAt!).sort()[0] || null,
      stale: partial,
      ...(partial
        ? {
            message:
              "Some stream sources could not refresh. Available streams are still listed.",
          }
        : {}),
    };
  }
}
export const broadcastCatalogue = new BroadcastCatalogue();
