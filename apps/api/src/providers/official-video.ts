import { createHash } from "node:crypto";
import { XMLParser } from "fast-xml-parser";
import { z } from "zod";
import type {
  Sport,
  StreamSource,
} from "../../../../packages/domain/src/index.js";
import type { Streams } from "../streams.js";
import { ProviderCache } from "./cache.js";
export const officialChannels: Array<{
  name: string;
  id: string;
  sport: Sport;
  archive?: string[];
}> = [
  {
    name: "WWE",
    id: "UCJ5v_MCY6GNUBTO8-D3XoAg",
    sport: "WWE",
  },
  {
    name: "WWE Vault",
    id: "UCNSnSemXKDc9UEZ7m31wY9Q",
    sport: "WWE",
    archive: ["MkImSUkk4Js"],
  },
  { name: "UFC", id: "UCvgfXK4nTYKudb0rFR6noLA", sport: "MMA" },
  {
    name: "FIBA Basketball",
    id: "UCtInrnU3QbWqFGsdKT1GZtg",
    sport: "Basketball",
  },
  { name: "NBA", id: "UCWJ2lWNubArHWmf3FIHbfcQ", sport: "Basketball" },
  {
    name: "Australian Open",
    id: "UCeTKJSW1NTAkf27nNmjWt5A",
    sport: "Tennis",
    archive: ["6I06-ITW88k"],
  },
  {
    name: "ICC",
    id: "UCt2JXOLNxqry7B_4rRZME3Q",
    sport: "Cricket",
    archive: ["R5RL6Pr0tHg"],
  },
  { name: "FIFA", id: "UCpcTrCXblq78GZrTUTLWeBw", sport: "Football" },
  { name: "FORMULA 1", id: "UCB_qr75-ydFVKSF9Dmo6izg", sport: "Formula 1" },
];
const metadataSchema = z.object({
  title: z.string().min(1).max(500),
  author_name: z.string(),
  thumbnail_url: z.string().url(),
});
export function parseChannel(raw: unknown, expected: string) {
  if (
    typeof raw !== "string" ||
    raw.length > 1024 * 1024 ||
    /<!DOCTYPE|<!ENTITY/i.test(raw)
  )
    throw new Error("Invalid channel feed");
  const feed = new XMLParser({
    ignoreAttributes: true,
    processEntities: false,
  }).parse(raw)?.feed;
  if (
    ![expected, expected.slice(2)].includes(feed?.["yt:channelId"]) ||
    feed?.author?.uri !== `https://www.youtube.com/channel/${expected}`
  )
    throw new Error("Unexpected channel");
  const entries: unknown[] = Array.isArray(feed.entry)
    ? feed.entry
    : feed.entry
      ? [feed.entry]
      : [];
  return entries.flatMap((item) => {
    const parsed = z
      .object({
        "yt:videoId": z.string().regex(/^[\w-]{11}$/),
        title: z.string(),
        published: z.string(),
      })
      .safeParse(item);
    if (!parsed.success || !Number.isFinite(Date.parse(parsed.data.published)))
      return [];
    return [
      {
        id: parsed.data["yt:videoId"],
        title: parsed.data.title,
        publishedAt: new Date(parsed.data.published).toISOString(),
      },
    ];
  });
}
export function videoCategory(
  title: string,
): NonNullable<StreamSource["catalog"]>["category"] {
  if (/highlight/i.test(title)) return "Highlights";
  if (/full fight|free fight/i.test(title)) return "Full fight";
  if (/full basketball game|full game/i.test(title)) return "Full game";
  if (/full match/i.test(title)) return "Full match";
  return "Official video"; // Never infer live status from a title.
}
export class OfficialVideoCatalog {
  constructor(
    private readonly streams: Streams,
    private readonly cache = new ProviderCache(),
  ) {}
  async feed() {
    const admitted = new Set<string>();
    const coverage = await Promise.all(
      officialChannels.map(async (channel) => {
        try {
          const feed = await this.cache.json(
            `https://www.youtube.com/feeds/videos.xml?channel_id=${channel.id}`,
            900000,
            (raw) => parseChannel(raw, channel.id),
            {},
            (r) => r.text(),
          );
          const selected = feed.value
            .filter(
              (v) =>
                /full match|full fight|free fight|full basketball game|full game|highlights|recap/i.test(
                  v.title,
                ) && !/#shorts|2k2\d|video game/i.test(v.title),
            )
            .slice(0, 2);
          const choices = [
            ...selected,
            ...(channel.archive || [])
              .filter((id) => !selected.some((v) => v.id === id))
              .map((id) => ({ id, title: "", publishedAt: null })),
          ];
          const results = await Promise.allSettled(
            choices.map(async (video) => {
              const watchUrl = `https://www.youtube.com/watch?v=${video.id}`;
              const meta = await this.cache.json(
                `https://www.youtube.com/oembed?url=${encodeURIComponent(watchUrl)}&format=json`,
                900000,
                (raw) => metadataSchema.parse(raw),
              );
              if (
                meta.stale ||
                feed.stale ||
                meta.value.author_name.toLowerCase() !==
                  channel.name.toLowerCase()
              )
                return;
              const thumbnail = new URL(meta.value.thumbnail_url);
              if (
                !["i.ytimg.com", "img.youtube.com"].includes(
                  thumbnail.hostname,
                ) ||
                thumbnail.protocol !== "https:"
              )
                throw new Error("Unexpected thumbnail");
              const checkedAt = meta.fetchedAt;
              const sourceId = `yt-${createHash("sha256").update(video.id).digest("hex").slice(0, 24)}`;
              this.streams.admit({
                id: sourceId,
                name:
                  meta.value.title.length > 100
                    ? meta.value.title.slice(0, 97) + "…"
                    : meta.value.title,
                type: "embed",
                url: `https://www.youtube-nocookie.com/embed/${video.id}`,
                content: "official",
                eventId: null,
                rightsOwner: channel.name,
                rightsEvidence: watchUrl,
                validFrom: checkedAt,
                validUntil: new Date(
                  Date.parse(checkedAt) + 24 * 3600000,
                ).toISOString(),
                territory: "PROVIDER",
                revoked: false,
                version: 1,
                catalog: {
                  sport: channel.sport,
                  publisher: channel.name,
                  channelId: channel.id,
                  publishedAt: video.publishedAt,
                  thumbnail: thumbnail.href,
                  watchUrl,
                  category: videoCategory(meta.value.title),
                  checkedAt,
                },
              });
              admitted.add(sourceId);
              return true;
            }),
          );
          return {
            publisher: channel.name,
            sport: channel.sport,
            status: feed.stale
              ? "stale"
              : results.some((r) => r.status === "fulfilled" && r.value)
                ? "checked"
                : "unavailable",
            message:
              "Official feed and embed metadata checked; playback remains subject to provider restrictions.",
          };
        } catch {
          return {
            publisher: channel.name,
            sport: channel.sport,
            status: "unavailable",
            message:
              "Official channel unavailable. No substitute footage supplied.",
          };
        }
      }),
    );
    const priority = [
      "WWE",
      "MMA",
      "Basketball",
      "Tennis",
      "Cricket",
      "Football",
      "Formula 1",
    ];
    const data = this.streams
      .library()
      .filter((source) => admitted.has(source.id))
      .sort(
        (a, b) =>
          priority.indexOf(a.catalog!.sport) -
            priority.indexOf(b.catalog!.sport) ||
          Number(!a.catalog!.category.startsWith("Full")) -
            Number(!b.catalog!.category.startsWith("Full")) ||
          (b.catalog!.publishedAt || "").localeCompare(
            a.catalog!.publishedAt || "",
          ),
      );
    return { data, coverage };
  }
}
