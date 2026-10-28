import {
  eventSchema,
  type SportEvent,
} from "../../../../packages/domain/src/index.js";
import { ProviderCache } from "./cache.js";
const channel = "UChh-akEbUM8_6ghGVnJd6cQ";
/** Read public page metadata only. Never reads streamingData, media URLs or private APIs. */
export function pageJson(html: string, marker: string): unknown {
  const found = new RegExp(`(?:var )?${marker}\\s*=\\s*`).exec(html);
  if (!found) throw new Error("Publisher metadata missing");
  const start = found.index + found[0].length;
  let depth = 0,
    quoted = false,
    escaped = false;
  for (let i = start; i < html.length; i++) {
    const c = html[i];
    if (quoted) {
      if (escaped) escaped = false;
      else if (c === "\\") escaped = true;
      else if (c === '"') quoted = false;
      continue;
    }
    if (c === '"') quoted = true;
    else if (c === "{") depth++;
    else if (c === "}" && --depth === 0)
      return JSON.parse(html.slice(start, i + 1));
  }
  throw new Error("Publisher metadata incomplete");
}
function record(v: unknown): Record<string, unknown> {
  return v !== null && typeof v === "object"
    ? (v as Record<string, unknown>)
    : {};
}
export function publishedVideoIds(raw: unknown): string[] {
  const ids = new Set<string>();
  function visit(v: unknown) {
    if (Array.isArray(v)) {
      v.forEach(visit);
      return;
    }
    const r = record(v);
    const lockup = record(r.lockupViewModel);
    const video = record(r.videoRenderer);
    for (const id of [lockup.contentId, video.videoId])
      if (typeof id === "string" && /^[\w-]{11}$/.test(id)) ids.add(id);
    Object.values(r).forEach((x) => {
      if (x && typeof x === "object") visit(x);
    });
  }
  visit(raw);
  return [...ids].slice(0, 6);
}
export function normalizeBwf(
  raw: unknown,
  id: string,
  fetchedAt: string,
  stale: boolean,
): SportEvent | null {
  const r = record(raw),
    video = record(r.videoDetails),
    micro = record(record(r.microformat).playerMicroformatRenderer),
    live = record(micro.liveBroadcastDetails);
  if (
    video.channelId !== channel ||
    typeof video.title !== "string" ||
    typeof live.startTimestamp !== "string" ||
    !Number.isFinite(Date.parse(live.startTimestamp))
  )
    return null;
  const ended =
    typeof live.endTimestamp === "string" &&
    Number.isFinite(Date.parse(live.endTimestamp));
  const state =
    live.isLiveNow === true
      ? stale
        ? "unknown"
        : "live"
      : ended
        ? "finished"
        : video.isUpcoming === true
          ? "upcoming"
          : "unknown";
  return eventSchema.parse({
    id: `bwf-${id.toLowerCase()}`,
    externalId: id,
    sport: "Badminton",
    kind: "card",
    competition: "BWF World Tour",
    title: video.title,
    start: new Date(live.startTimestamp).toISOString(),
    ...(ended
      ? { end: new Date(live.endTimestamp as string).toISOString() }
      : {}),
    status: state,
    provenance: "provider",
    bouts: [],
    scheduleOnly: false,
    source: {
      provider: "BWF TV",
      url: `https://www.youtube.com/watch?v=${id}`,
      license:
        "Official publisher page metadata. Playback via publisher-controlled embed only; regional restrictions apply.",
      fetchedAt,
      stale,
    },
  });
}
export class BwfProvider {
  constructor(private cache: ProviderCache) {}
  async events() {
    const list = await this.cache.json(
      `https://www.youtube.com/channel/${channel}/streams`,
      60000,
      (raw) => publishedVideoIds(pageJson(String(raw), "ytInitialData")),
      { "User-Agent": "Mozilla/5.0" },
      (r) => r.text(),
    );
    const results = await Promise.allSettled(
      list.value.map(async (id) => {
        const r = await this.cache.json(
          `https://www.youtube.com/watch?v=${id}`,
          30000,
          (raw) => pageJson(String(raw), "ytInitialPlayerResponse"),
          { "User-Agent": "Mozilla/5.0" },
          (response) => response.text(),
        );
        return {
          ...r,
          value: normalizeBwf(r.value, id, r.fetchedAt, r.stale || list.stale),
        };
      }),
    );
    const good = results.flatMap((r) =>
      r.status === "fulfilled" && r.value.value ? [r.value] : [],
    );
    if (!good.length)
      throw new Error("No current BWF event metadata available");
    return {
      value: good.map((r) => r.value!),
      fetchedAt: good.map((r) => r.fetchedAt).sort()[0],
      stale: good.some((r) => r.stale),
    };
  }
}
