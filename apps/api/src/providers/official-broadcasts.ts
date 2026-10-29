import {
  eventSchema,
  streamSourceSchema,
  type SportEvent,
} from "../../../../packages/domain/src/index.js";
import {
  broadcastMetadata,
  pageJson,
  normalizeBwf,
  broadcastEventId,
} from "./bwf.js";
import { parseChannel } from "./official-video.js";
import { ProviderCache } from "./cache.js";
import { youtubeDataMetadata } from "./youtube-data.js";

export const broadcastPublishers = [
  {
    key: "bwf",
    name: "BWF TV",
    owner: "Badminton World Federation",
    channel: "UChh-akEbUM8_6ghGVnJd6cQ",
    sport: "Badminton",
  },
  {
    key: "fiba",
    name: "FIBA Basketball",
    owner: "FIBA",
    channel: "UCtInrnU3QbWqFGsdKT1GZtg",
    sport: "Basketball",
  },
] as const;
type Publisher = (typeof broadcastPublishers)[number];
const freshFor = 120000;
function record(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
}

/** Badges rank discovery only. The watch page must independently confirm live status. */
export function broadcastIds(raw: unknown) {
  const live = new Set<string>(),
    upcoming = new Set<string>(),
    recent = new Set<string>();
  function visit(value: unknown, depth = 0) {
    if (depth > 60 || !value || typeof value !== "object") return;
    const r = record(value);
    const lockup = record(r.lockupViewModel),
      video = record(r.videoRenderer);
    const id = lockup.contentId ?? video.videoId;
    if (typeof id === "string" && /^[\w-]{11}$/.test(id)) {
      const badges = JSON.stringify(
        lockup.contentImage ?? video.thumbnailOverlays ?? [],
      );
      if (/BADGE_STYLE_LIVE|OVERLAY_STYLE_LIVE/.test(badges)) live.add(id);
      else if (/Upcoming|UPCOMING/.test(badges) || video.upcomingEventData)
        upcoming.add(id);
      else recent.add(id);
    }
    Object.values(r).forEach((v) => visit(v, depth + 1));
  }
  visit(raw);
  // Channels can put dozens of distant scheduled broadcasts ahead of today's action.
  return [
    ...new Set(
      [...live, ...recent]
        .slice(0, 8)
        .concat([...upcoming].reverse().slice(0, 4)),
    ),
  ].slice(0, 12);
}

export function normalizeBroadcast(
  raw: unknown,
  id: string,
  publisher: Publisher,
  fetchedAt: string,
  stale: boolean,
): SportEvent | null {
  if (!/^[\w-]{11}$/.test(id)) return null;
  const viewingLinks = [
    {
      label: `${publisher.name} · official broadcast`,
      url: `https://www.youtube.com/watch?v=${id}`,
      evidenceUrl: `https://www.youtube.com/channel/${publisher.channel}`,
      countries: [],
      access: "information" as const,
      confirmation: "check-schedule" as const,
      note: "Official publisher page. Regional availability and embedding settings are controlled by the publisher.",
      checkedAt: fetchedAt,
    },
  ];
  if (publisher.key === "bwf") {
    const event = normalizeBwf(raw, id, fetchedAt, stale);
    return event ? { ...event, viewingLinks } : null;
  }
  const root = record(raw),
    video = record(root.videoDetails);
  const live = record(
    record(record(root.microformat).playerMicroformatRenderer)
      .liveBroadcastDetails,
  );
  if (
    video.channelId !== publisher.channel ||
    typeof video.title !== "string" ||
    typeof live.startTimestamp !== "string" ||
    !Number.isFinite(Date.parse(live.startTimestamp))
  )
    return null;
  const ended =
    typeof live.endTimestamp === "string" &&
    Number.isFinite(Date.parse(live.endTimestamp));
  return eventSchema.parse({
    id: broadcastEventId(publisher.key, id),
    externalId: id,
    sport: publisher.sport,
    kind: "card",
    title: video.title,
    competition:
      video.title.split(" | ").slice(1, 2).join("") || publisher.name,
    start: new Date(live.startTimestamp).toISOString(),
    ...(ended
      ? { end: new Date(live.endTimestamp as string).toISOString() }
      : {}),
    status: ended
      ? "finished"
      : stale
        ? "unknown"
        : live.isLiveNow === true
          ? "live"
          : video.isUpcoming === true
            ? "upcoming"
            : "unknown",
    provenance: "provider",
    viewingLinks,
    bouts: [],
    scheduleOnly: false,
    source: {
      provider: publisher.name,
      url: `https://www.youtube.com/watch?v=${id}`,
      license:
        "Official publisher broadcast metadata. Publisher-controlled embeds only; regional restrictions apply.",
      fetchedAt,
      stale,
    },
  });
}

/** Stateless, allowlisted discovery. No account database, media extraction or playback proxy. */
export class OfficialBroadcastProvider {
  private current = new Map<string, { event: SportEvent; allowed: boolean }>();
  constructor(
    readonly publisher: Publisher,
    private cache = new ProviderCache(),
    private now = Date.now,
  ) {}
  async events() {
    const headers = { "User-Agent": "Mozilla/5.0", "Accept-Language": "en" };
    const pageTask = this.cache.json(
      `https://www.youtube.com/channel/${this.publisher.channel}/streams`,
      60000,
      (raw) => broadcastIds(pageJson(String(raw), "ytInitialData")),
      headers,
      (r) => r.text(),
    );
    // RSS also surfaces recent live broadcasts hidden below scheduled items in channel pages.
    const rssTask = this.cache
      .json(
        `https://www.youtube.com/feeds/videos.xml?channel_id=${this.publisher.channel}`,
        60000,
        (raw) =>
          parseChannel(raw, this.publisher.channel)
            .slice(0, 6)
            .map((v) => v.id),
        headers,
        (r) => r.text(),
      )
      .catch(() => null);
    const [page, rss] = await Promise.all([
      pageTask.catch(() => null),
      rssTask,
    ]);
    if (!page && !rss)
      throw new Error("Official channel discovery unavailable");
    const ids = [
      ...new Set([
        ...(page?.value || []),
        ...(rss && !rss.stale ? rss.value : []),
      ]),
    ].slice(0, 18);
    const apiKey = process.env.YOUTUBE_API_KEY?.trim();
    const api =
      apiKey && ids.length
        ? await this.cache.json(
            `https://www.googleapis.com/youtube/v3/videos?${new URLSearchParams(
              {
                part: "snippet,status,liveStreamingDetails",
                id: [...ids].sort().join(","),
                fields:
                  "items(id,snippet(channelId,title,liveBroadcastContent),status(privacyStatus,embeddable,uploadStatus),liveStreamingDetails)",
              },
            )}`,
            60000,
            youtubeDataMetadata,
            { "X-Goog-Api-Key": apiKey },
          )
        : null;
    const results = await Promise.allSettled(
      ids.map(async (id) => {
        const item = api?.value.find((row) => row.id === id);
        if (api && !item) return { event: null, allowed: false };
        const response =
          api && item
            ? {
                value: item.metadata,
                fetchedAt: api.fetchedAt,
                stale: api.stale,
              }
            : await this.cache.json(
                `https://www.youtube.com/watch?v=${id}`,
                30000,
                (raw) =>
                  broadcastMetadata(
                    pageJson(String(raw), "ytInitialPlayerResponse"),
                  ),
                headers,
                (r) => r.text(),
              );
        const event = normalizeBroadcast(
          response.value,
          id,
          this.publisher,
          response.fetchedAt,
          response.stale || (page?.stale ?? false),
        );
        const state = response.value.playabilityStatus;
        return {
          event,
          allowed: state.status === "OK" && state.playableInEmbed === true,
        };
      }),
    );
    const rows = results.flatMap((r) =>
      r.status === "fulfilled" && r.value.event
        ? [{ event: r.value.event, allowed: r.value.allowed }]
        : [],
    );
    if (!rows.length)
      throw new Error("No official broadcast metadata available");
    this.current = new Map(rows.map((r) => [r.event.id, r]));
    return {
      value: rows.map((r) => r.event),
      fetchedAt: rows.map((r) => r.event.source!.fetchedAt).sort()[0]!,
      stale: rows.some((r) => r.event.source!.stale),
    };
  }
  sourcesFor(event: SportEvent) {
    const row = this.current.get(event.id),
      at = this.now();
    const checked = Date.parse(row?.event.source?.fetchedAt || "");
    if (
      !row ||
      !row.allowed ||
      row.event.status !== "live" ||
      event.status !== "live" ||
      event.provenance !== "provider" ||
      event.source?.provider !== this.publisher.name ||
      event.externalId !== row.event.externalId ||
      event.source?.stale ||
      row.event.source?.stale ||
      !Number.isFinite(checked) ||
      at - checked > freshFor ||
      checked > at + 60000
    )
      return [];
    const id = row.event.externalId!;
    return [
      streamSourceSchema.parse({
        id: `official-${event.id}`,
        name: this.publisher.name,
        type: "embed",
        content: "sports",
        eventId: event.id,
        url: `https://www.youtube-nocookie.com/embed/${id}`,
        fixtureRef: { provider: this.publisher.name, externalId: id },
        presentation: "live",
        rightsOwner: this.publisher.owner,
        rightsEvidence: row.event.source!.url,
        validFrom: new Date(checked).toISOString(),
        validUntil: new Date(checked + freshFor).toISOString(),
        territory: "PROVIDER",
        revoked: false,
        version: 1,
      }),
    ];
  }
}
