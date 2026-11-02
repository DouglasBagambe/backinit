import { it, expect, vi } from "vitest";
import {
  parsePpv,
  ppvEmbed,
  PpvCatalogue,
} from "../apps/api/src/providers/ppv-catalogue";
import { broadcastState } from "../apps/web/app/lib/broadcast-types";
const raw = {
  success: true,
  streams: [
    {
      category: "Football",
      streams: [
        {
          id: 1,
          name: "Home v Away",
          uri_name: "football/home-away",
          starts_at: 1793700000,
          ends_at: 1793710000,
          always_live: 0,
          viewers: "12",
          iframe: "https://taifood-blog.asia/embed/home-away",
          substreams: [
            {
              id: 2,
              iframe: "https://taifood-blog.asia/embed/home-away-sd",
              source_tag: "SD",
            },
          ],
        },
      ],
    },
  ],
};
it("keeps supplied upcoming source choices and never admits arbitrary embeds or corrupt entries", () => {
  const entries = parsePpv({
    ...raw,
    streams: [
      {
        category: "Football",
        streams: [
          ...raw.streams[0]!.streams,
          { id: "bad" },
          {
            ...raw.streams[0]!.streams[0],
            id: 3,
            iframe: "https://evil.example/embed/a",
            substreams: [],
          },
        ],
      },
    ],
  });
  expect(entries).toHaveLength(2);
  expect(entries[0]?.sources).toHaveLength(2);
  expect(entries[1]?.sources).toHaveLength(0);
  expect(entries[0]?.viewers).toBe(12);
  expect(entries[0]?.pageUrl).toBe("https://ppv.st/live/football/home-away");
  expect(broadcastState(entries[0]!, 0)).toBe("Upcoming");
  expect(broadcastState(entries[0]!, 1793705000000)).toBe("Live");
  expect(broadcastState(entries[0]!, 1793720000000)).toBe("Ended");
  expect(
    ppvEmbed('<iframe src="https://taifood-blog.asia/embed/test"></iframe>'),
  ).toBe("https://taifood-blog.asia/embed/test");
  for (const url of [
    "javascript:alert(1)",
    "https://evil.example/embed/a",
    "https://name:pass@taifood-blog.asia/embed/a",
    "http://taifood-blog.asia/embed/a",
    "https://taifood-blog.asia/elsewhere",
  ])
    expect(ppvEmbed(url)).toBeNull();
});
it("coalesces requests, respects one-minute cache and retains last catalogue without waiting for failed refresh", async () => {
  let time = 1000000;
  let fail = false;
  let release!: () => void;
  const wait = new Promise<void>((r) => (release = r));
  const fetcher = vi.fn(async () => {
    if (fail) {
      await wait;
      throw Error("upstream down");
    }
    return Response.json(raw);
  });
  const cache = new PpvCatalogue(fetcher as typeof fetch, () => time);
  const [a, b] = await Promise.all([cache.feed(), cache.feed()]);
  expect(a).toEqual(b);
  expect(fetcher).toHaveBeenCalledTimes(1);
  await cache.feed();
  expect(fetcher).toHaveBeenCalledTimes(1);
  time += 61000;
  fail = true;
  const stale = await cache.feed();
  expect(stale.stale).toBe(true);
  expect(stale.data).toEqual(a.data);
  release();
  await Promise.resolve();
  await Promise.resolve();
  expect((await cache.feed()).data).toEqual(a.data);
});
it("returns explicit no-data state and backs off after first upstream failure", async () => {
  const fetcher = vi.fn(
    async () => new Response("unavailable", { status: 503 }),
  );
  const cache = new PpvCatalogue(fetcher as typeof fetch, () => 1000000);
  expect((await cache.feed()).updatedAt).toBeNull();
  await cache.feed();
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it("retains channels in every sport when provider uses negative placeholder timestamps", () => {
  const categories = ["Australian Football", "Cricket", "Rugby", "New sport"];
  const result = parsePpv({
    success: true,
    streams: categories.map((category, i) => ({
      category,
      streams: [
        {
          ...raw.streams[0]!.streams[0],
          id: i + 10,
          always_live: 1,
          starts_at: -3600,
          ends_at: 10800,
        },
      ],
    })),
  });
  expect(result.map((x) => x.category)).toEqual(categories);
  expect(
    result.every(
      (x) =>
        x.channel && x.start === 0 && x.end === 0 && x.sources.length === 2,
    ),
  ).toBe(true);
});
