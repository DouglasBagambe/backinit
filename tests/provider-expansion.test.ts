import { expect, it, vi } from "vitest";
import {
  AdditionalCatalogue,
  parseStreamfree,
  parseTimChannels,
} from "../apps/api/src/providers/additional-catalogues";
import {
  BroadcastCatalogue,
  mergeBroadcasts,
} from "../apps/api/src/providers/broadcast-catalogue";
import {
  broadcastCollection,
  broadcastState,
  isBroadcastId,
  type Broadcast,
} from "../packages/domain/src/index";
const raw = {
  streams: [
    {
      name: "Chelsea vs Arsenal",
      category: "soccer",
      stream_key: "chelsea-arsenal",
      match_timestamp: 1794502800,
      sources: [
        {
          url: "https://strmfree.st/embed/soccer/chelsea-arsenal1080p",
          live: false,
          quality: "HD",
        },
      ],
    },
  ],
};
const item = (): Broadcast => parseStreamfree(raw)[0]!;
it("admits future sources without caps, but excludes mixed entertainment and untrusted embed hosts", () => {
  const sources = Array.from({ length: 130 }, (_, i) => ({
    url: `https://strmfree.st/embed/soccer/a${i}`,
    live: false,
  }));
  const data = parseStreamfree({
    streams: [
      {
        ...raw.streams[0],
        sources: [
          ...sources,
          sources[0],
          { url: "https://attacker.test/embed/x" },
          { url: "https://strmfree.st@127.0.0.1/embed/x" },
        ],
      },
      { ...raw.streams[0], category: "cartoons" },
    ],
  });
  expect(data).toHaveLength(1);
  expect(data[0]!.sources).toHaveLength(130);
  expect(data[0]!.start).toBe(1794502800000);
  expect(data[0]!.channel).toBe(false);
  expect(isBroadcastId(data[0]!.id)).toBe(true);
});
it("keeps known continuous sports channels separate from expired match schedules", () => {
  const data = parseStreamfree({
    streams: [
      {
        ...raw.streams[0],
        name: "Sky Sports F1",
        category: "racing",
        stream_key: "skyf1",
        match_timestamp: 1,
      },
    ],
  });
  expect(data[0]).toMatchObject({ channel: true, start: 0, end: 0 });
});
it("uses Tim's sports category rather than importing TV entertainment or paid sources", () => {
  const channel = {
    name: "ESPN",
    url: "espn",
    genre: 2,
    streams: [{ url: "https://ehgembxe.cfd/example", vip: false }],
  };
  const data = parseTimChannels({
    genres: [
      { id: 1, name: "Entertainment" },
      { id: 2, name: "Sports" },
    ],
    channels: [
      channel,
      { ...channel, url: "abc", name: "ABC", genre: 1 },
      { ...channel, url: "vip", vip: true },
      { ...channel, streams: [{ url: "https://ehgembxe.cfd/vip", vip: true }] },
    ],
  });
  expect(data).toHaveLength(1);
  expect(data[0]).toMatchObject({
    title: "ESPN",
    channel: true,
    category: "Sports",
  });
});
it("combines same games conservatively, preserves PPV URLs, and does not merge another day", () => {
  const a = { ...item(), id: "ppv-1" };
  const b = {
    ...item(),
    id: "ext-tim-123",
    title: "Arsenal v Chelsea",
    sources: [{ id: "b", label: "Alt", url: "https://ehgembxe.cfd/other" }],
  };
  const result = mergeBroadcasts([
    [a],
    [b, { ...b, id: "ext-tim-456", start: b.start + 86400000 }],
  ]);
  expect(result).toHaveLength(2);
  expect(result[0]!.id).toBe("ppv-1");
  expect(result[0]!.sources.map((s) => s.label)).toEqual([
    "Stream 1",
    "Stream 2",
  ]);
  expect(a.sources).toHaveLength(1);
  expect(mergeBroadcasts([[a], [a]])[0]!.sources).toHaveLength(1);
});
it("serializes refresh, accepts a genuinely empty feed and retains stale data across outages", async () => {
  let now = 100000,
    fail = false;
  const fetcher = vi.fn(async () => {
    if (fail) throw Error("offline");
    return Response.json(raw);
  });
  const store = new AdditionalCatalogue(
    "test",
    "https://strmfree.pk/api/v1/streams",
    parseStreamfree,
    fetcher,
    () => now,
  );
  const [a, b] = await Promise.all([store.feed(), store.feed()]);
  expect(a.data).toHaveLength(1);
  expect(b).toBe(a);
  expect(fetcher).toHaveBeenCalledTimes(1);
  now += 61000;
  fail = true;
  await store.feed();
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect((await store.feed()).stale).toBe(true);
  expect((await store.feed()).data).toHaveLength(1);
  const empty = new AdditionalCatalogue(
    "empty",
    "https://strmfree.pk/api/v1/streams",
    parseStreamfree,
    async () => Response.json({ streams: [] }),
  );
  expect(await empty.feed()).toMatchObject({ data: [], stale: false });
});
it("one failed provider never removes another provider's available sources", async () => {
  const store = new BroadcastCatalogue([
    {
      feed: async () => ({
        data: [item()],
        updatedAt: "2026-11-12T12:00:00Z",
        stale: false,
      }),
    },
    {
      feed: async () => {
        throw Error("offline");
      },
    },
  ]);
  expect(await store.feed()).toMatchObject({
    data: [expect.objectContaining({ title: "Chelsea vs Arsenal" })],
    stale: true,
  });
  expect(isBroadcastId("ext-test/../x")).toBe(false);
});

it("groups explicit wrestling promotions and racing series without inventing coverage", () => {
  for (const [title, expected] of [
    ["WWE Raw", "WWE"],
    ["AEW Dynamite", "AEW"],
    ["Impact Wrestling", "TNA / Impact"],
    ["New Japan Cup", "NJPW"],
    ["Ring of Honor", "ROH"],
    ["MotoGP Valencia", "MotoGP"],
    ["Formula One practice", "Formula 1"],
  ]) {
    expect(
      broadcastCollection({ ...item(), title, competition: "Sports" }),
    ).toBe(expected);
  }
  expect(broadcastCollection(item())).toBe("Football");
});

it("does not label an inactive provider source live just because kickoff passed", () => {
  const b = item();
  expect(b.live).toBe(false);
  expect(broadcastState(b, b.start + 60000)).toBe("Awaiting stream");
  expect(broadcastState(b, b.start - 60000)).toBe("Upcoming");
  const active = parseStreamfree({
    streams: [
      {
        ...raw.streams[0],
        sources: [{ ...raw.streams[0]!.sources[0], live: true }],
      },
    ],
  })[0]!;
  expect(broadcastState(active, active.start + 60000)).toBe("Live");
});
