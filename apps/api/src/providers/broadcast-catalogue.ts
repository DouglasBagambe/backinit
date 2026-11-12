import {
  participantKey,
  type Broadcast,
  type BroadcastFeed,
} from "../../../../packages/domain/src/index.js";
import { ppvCatalogue } from "./ppv-catalogue.js";
import { additionalCatalogues } from "./additional-catalogues.js";
import {
  FileBroadcastSnapshot,
  type BroadcastSnapshot,
} from "./broadcast-snapshot.js";

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
  private saved: BroadcastFeed | null = null;
  private hydrated: Promise<void> | null = null;
  private pending: Promise<BroadcastFeed> | null = null;
  private checkedAt = -Infinity;
  constructor(
    private providers: { feed(): Promise<BroadcastFeed> }[] = [
      ppvCatalogue,
      ...additionalCatalogues,
    ],
    private snapshot?: BroadcastSnapshot,
  ) {}
  async feed(): Promise<BroadcastFeed> {
    if (!this.hydrated)
      this.hydrated = (async () => {
        const restored = await this.snapshot?.read().catch(() => null);
        this.saved = restored ? { ...restored, stale: true } : null;
      })();
    await this.hydrated;
    if (
      this.saved &&
      Date.now() - Date.parse(this.saved.updatedAt || "") > 6 * 3600000
    )
      this.saved = null;
    if (!this.pending && (!this.saved || Date.now() - this.checkedAt >= 60000))
      this.pending = this.refresh().finally(() => {
        this.pending = null;
        this.checkedAt = Date.now();
      });
    if (this.saved) {
      const age = Date.now() - Date.parse(this.saved.updatedAt || "");
      if (age <= 6 * 3600000)
        return {
          ...this.saved,
          stale: this.saved.stale || age > 180000,
          ...(this.saved.stale || age > 180000
            ? {
                message:
                  "Showing the last saved catalogue while sources reconnect. Stream availability may have changed.",
              }
            : {}),
        };
      this.saved = null;
    }
    return this.pending!;
  }
  private async refresh(): Promise<BroadcastFeed> {
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
    const feed: BroadcastFeed = {
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
    if (data.length && feed.updatedAt) {
      this.saved = feed;
      await this.snapshot?.write(feed).catch(() => {});
    } else if (this.saved && partial) {
      this.saved = { ...this.saved, stale: true };
      return {
        ...this.saved,
        message:
          "Showing the last saved catalogue. Stream availability may have changed.",
      };
    }
    if (!partial && !data.length) this.saved = null;
    return feed;
  }
}
export const broadcastCatalogue = new BroadcastCatalogue(
  undefined,
  new FileBroadcastSnapshot(
    process.env.BROADCAST_CACHE_PATH || ".data/broadcast-catalogue.json",
  ),
);
