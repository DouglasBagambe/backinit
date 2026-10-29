import { expect, it, vi } from "vitest";
import {
  broadcastIds,
  broadcastPublishers,
  normalizeBroadcast,
  OfficialBroadcastProvider,
} from "../apps/api/src/providers/official-broadcasts";
import { ProviderCache } from "../apps/api/src/providers/cache";
import {
  broadcastMetadata,
  broadcastEventId,
} from "../apps/api/src/providers/bwf";
const publisher = broadcastPublishers[0];
const videoId = "X8zS3uXmwFA";
const start = "2026-10-29T09:08:32Z";
const at = Date.parse("2026-10-29T15:55:00Z");
it("keeps case-sensitive publisher video IDs distinct and generated routes URL-safe", () => {
  expect(broadcastEventId("fiba", "JUQysb8G3_o")).toMatch(/^[a-z0-9-]+$/);
  expect(broadcastEventId("fiba", "JUQysb8G3_o")).not.toBe(
    broadcastEventId("fiba", "juqysb8g3_o"),
  );
  expect(broadcastEventId("bwf", "gxDHTZ_Ar2A")).toMatch(/^[a-z0-9-]+$/);
});
function metadata(
  live = true,
  allowed = true,
  channel = publisher.channel as string,
) {
  return {
    playabilityStatus: { status: "OK", playableInEmbed: allowed },
    videoDetails: {
      channelId: channel,
      title: "Official court session",
      isUpcoming: !live,
    },
    microformat: {
      playerMicroformatRenderer: {
        liveBroadcastDetails: { startTimestamp: start, isLiveNow: live },
      },
    },
    streamingData: { neverCache: "private media payload" },
  };
}
function setup() {
  let now = at;
  let raw: unknown = metadata();
  const fetcher = vi.fn(async (url: string | URL | Request) => {
    const path = String(url);
    if (path.includes("/streams"))
      return new Response(
        `var ytInitialData = ${JSON.stringify({ contents: [{ videoRenderer: { videoId } }] })};`,
      );
    if (path.includes("/feeds/"))
      return new Response("offline", { status: 404 });
    return new Response(
      `var ytInitialPlayerResponse = ${JSON.stringify(raw)};`,
    );
  });
  const provider = new OfficialBroadcastProvider(
    publisher,
    new ProviderCache(fetcher, () => now),
    () => now,
  );
  return {
    provider,
    fetcher,
    advance: (seconds: number) => (now += seconds * 1000),
    change: (value: unknown) => (raw = value),
  };
}
it("automatically discovers an exact publisher broadcast and offers only its permitted live embed", async () => {
  const { provider } = setup();
  const feed = await provider.events();
  const event = feed.value[0]!;
  expect(event).toMatchObject({
    id: "bwf-x8zs3uxmwfa",
    status: "live",
    sport: "Badminton",
    provenance: "provider",
  });
  expect(event.kind).toBe("card");
  expect(provider.sourcesFor(event)[0]).toMatchObject({
    type: "embed",
    content: "sports",
    eventId: event.id,
    territory: "PROVIDER",
    presentation: "live",
    url: `https://www.youtube-nocookie.com/embed/${videoId}`,
  });
  expect(provider.sourcesFor({ ...event, externalId: "different01" })).toEqual(
    [],
  );
  expect(provider.sourcesFor({ ...event, status: "finished" })).toEqual([]);
  expect(JSON.stringify(broadcastMetadata(metadata()))).not.toContain(
    "private media payload",
  );
});
it("withdraws sources when live becomes ended, embedding is disabled, or checks expire", async () => {
  const { provider, advance, change } = setup();
  let event = (await provider.events()).value[0]!;
  advance(121);
  expect(provider.sourcesFor(event)).toEqual([]);
  change(metadata(true, false));
  event = (await provider.events()).value[0]!;
  expect(event.status).toBe("live");
  expect(provider.sourcesFor(event)).toEqual([]);
  advance(31);
  change({
    ...metadata(false),
    videoDetails: {
      channelId: publisher.channel,
      title: "LIVE - archived session",
    },
    microformat: {
      playerMicroformatRenderer: {
        liveBroadcastDetails: {
          isLiveNow: false,
          startTimestamp: start,
          endTimestamp: "2026-10-29T15:00:00Z",
        },
      },
    },
  });
  event = (await provider.events()).value[0]!;
  expect(event.status).toBe("finished");
  expect(provider.sourcesFor(event)).toEqual([]);
});
it("does not infer live from titles or timestamps and rejects other uploaders", async () => {
  const { provider, change, advance } = setup();
  change(metadata(false));
  let event = (await provider.events()).value[0]!;
  expect(event.status).toBe("upcoming");
  expect(provider.sourcesFor(event)).toEqual([]);
  advance(31);
  change(metadata(true));
  event = (await provider.events()).value[0]!;
  expect(provider.sourcesFor(event)).toHaveLength(1);
  advance(31);
  change(metadata(true, true, "UCwrong"));
  await expect(provider.events()).rejects.toThrow("No official broadcast");
  expect(
    normalizeBroadcast(
      metadata(),
      "not-a-video",
      broadcastPublishers[1],
      new Date(at).toISOString(),
      false,
    ),
  ).toBeNull();
});
it("ranks live candidates before distant upcoming items without trusting title text", () => {
  const upcoming = Array.from({ length: 30 }, (_, i) => ({
    lockupViewModel: {
      contentId: `upcoming${String(i).padStart(3, "0")}`,
      contentImage: { text: "Upcoming" },
    },
  }));
  expect(
    broadcastIds([
      ...upcoming,
      {
        lockupViewModel: {
          contentId: videoId,
          contentImage: { badgeStyle: "THUMBNAIL_OVERLAY_BADGE_STYLE_LIVE" },
        },
      },
    ])[0],
  ).toBe(videoId);
});
it("does not turn a stale publisher snapshot into live availability", () => {
  const r = metadata();
  const e = normalizeBroadcast(
    {
      ...r,
      videoDetails: {
        ...r.videoDetails,
        channelId: broadcastPublishers[1].channel,
      },
    },
    videoId,
    broadcastPublishers[1],
    new Date(at).toISOString(),
    true,
  );
  expect(e?.status).toBe("unknown");
});
