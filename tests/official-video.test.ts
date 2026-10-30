import { it, expect, vi, afterEach } from "vitest";
import { createHash } from "node:crypto";
import { ProviderCache } from "../apps/api/src/providers/cache";
import {
  OfficialVideoCatalog,
  officialChannels,
  parseChannel,
  videoCategory,
} from "../apps/api/src/providers/official-video";
it("validates official channel identity and distinguishes highlights from complete games", () => {
  const channel = "UCexample_channel";
  const xml = `<feed><yt:channelId>example_channel</yt:channelId><author><uri>https://www.youtube.com/channel/${channel}</uri></author><entry><yt:videoId>PM5UPYoDvf0</yt:videoId><title>Full Match</title><published>2026-10-27T10:00:00+00:00</published></entry></feed>`;
  expect(parseChannel(xml, channel)[0]?.id).toBe("PM5UPYoDvf0");
  expect(() => parseChannel(xml, "UCdifferent")).toThrow("Unexpected");
  expect(() => parseChannel("<!DOCTYPE evil>" + xml, channel)).toThrow();
  expect(videoCategory("NBA FULL GAME HIGHLIGHTS")).toBe("Highlights");
  expect(videoCategory("France v USA | Full Basketball Game")).toBe(
    "Full game",
  );
  expect(videoCategory("LIVE - an archived game")).toBe("Official video");
});

afterEach(() => vi.unstubAllEnvs());
function providerFixture(authorMismatch = false) {
  const videos = new Map(
    officialChannels.map((c) => [
      createHash("sha256").update(c.id).digest("hex").slice(0, 11),
      c,
    ]),
  );
  const fetcher = vi.fn(async (input: string | URL | Request) => {
    const url = new URL(String(input));
    if (url.pathname === "/feeds/videos.xml") {
      const channel = officialChannels.find(
        (c) => c.id === url.searchParams.get("channel_id"),
      )!;
      const id = [...videos].find(([, c]) => c === channel)![0];
      return new Response(
        `<feed><yt:channelId>${channel.id}</yt:channelId><author><uri>https://www.youtube.com/channel/${channel.id}</uri></author><entry><yt:videoId>${id}</yt:videoId><title>Full match</title><published>2026-10-30T10:00:00Z</published></entry></feed>`,
      );
    }
    const id = new URL(url.searchParams.get("url")!).searchParams.get("v")!;
    const channel = videos.get(id);
    return channel
      ? Response.json({
          title: "Full match",
          author_name: authorMismatch ? "Impostor" : channel.name,
          thumbnail_url: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
        })
      : new Response("Missing", { status: 404 });
  });
  return { fetcher, cache: new ProviderCache(fetcher as typeof fetch) };
}
it("discovers public videos without a user/source database and coalesces simultaneous requests", async () => {
  const { fetcher, cache } = providerFixture();
  const catalog = new OfficialVideoCatalog(undefined, cache);
  const [a, b] = await Promise.all([catalog.feed(), catalog.feed()]);
  expect(a).toEqual(b);
  expect(a.data).toHaveLength(officialChannels.length);
  expect(new Set(a.data.map((s) => s.catalog!.sport)).size).toBe(7);
  expect(
    a.data.every(
      (s) =>
        s.content === "official" && s.eventId === null && s.type === "embed",
    ),
  ).toBe(true);
  expect(
    a.data.every((s) =>
      s.url.startsWith("https://www.youtube-nocookie.com/embed/"),
    ),
  ).toBe(true);
  const count = fetcher.mock.calls.length;
  expect((await catalog.feed()).data).toEqual(a.data);
  expect(fetcher).toHaveBeenCalledTimes(count);
});
it("does not admit a video from an unexpected publisher", async () => {
  const { cache } = providerFixture(true);
  expect(
    (await new OfficialVideoCatalog(undefined, cache).feed()).data,
  ).toEqual([]);
});
it("does not expose stale embeds when provider refresh fails", async () => {
  vi.useFakeTimers();
  try {
    const { cache, fetcher } = providerFixture();
    const catalog = new OfficialVideoCatalog(undefined, cache);
    expect((await catalog.feed()).data.length).toBeGreaterThan(0);
    vi.advanceTimersByTime(900001);
    fetcher.mockRejectedValue(new Error("Provider unavailable"));
    const result = await catalog.feed();
    expect(result.data).toEqual([]);
    expect(result.coverage.every((c) => c.status === "stale")).toBe(true);
  } finally {
    vi.useRealTimers();
  }
});
it("disabled ingestion returns no snapshots and makes no network requests", async () => {
  vi.stubEnv("SPORTS_PROVIDERS_DISABLED", "true");
  const { cache, fetcher } = providerFixture();
  expect(await new OfficialVideoCatalog(undefined, cache).feed()).toEqual({
    data: [],
    coverage: [],
  });
  expect(fetcher).not.toHaveBeenCalled();
});
