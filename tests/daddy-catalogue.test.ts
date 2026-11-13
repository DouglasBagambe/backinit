import { it, expect } from "vitest";
import {
  channelArtwork,
  channelArtworkKey,
  daddyChannels,
  daddyFrame,
  daddySport,
  DaddyCatalogue,
} from "../apps/api/src/providers/daddy-catalogue";
const row = (id: number, name: string) =>
  `<a class="card" href="/watch.php?id=${id}" data-title="${name}"><div class="card__title">${name}</div><div>ID: ${id}</div></a>`;
it("discovers every explicit sports row without importing entertainment or guessed URLs", () => {
  const html =
    Array.from({ length: 220 }, (_, i) => row(i + 1, `Sky Sports ${i}`)).join(
      "",
    ) +
    row(999, "Family Guy") +
    row(1000, "ABC News") +
    row(1, "Sky Sports 0");
  expect(daddyChannels(html)).toHaveLength(220);
  expect(daddyChannels(html)[0]?.pageUrl).toBe(
    "https://thedaddy.li/watch.php?id=1",
  );
});
it("follows only provider supplied HTTPS player frames, excluding ads, credentials and other origins", () => {
  expect(
    daddyFrame(
      '<iframe src="https://ads.test/"></iframe><iframe src="https://thedaddy.li/stream/stream-60.php"></iframe>',
      "page",
    ),
  ).toBe("https://thedaddy.li/stream/stream-60.php");
  expect(
    daddyFrame(
      '<iframe src="https://dembed.st/premiumtv/daddy.php?id=60"></iframe>',
      "player",
    ),
  ).toBe("https://dembed.st/premiumtv/daddy.php?id=60");
  for (const url of [
    "http://dembed.st/premiumtv/daddy.php?id=60",
    "https://dembed.st.evil.test/premiumtv/daddy.php?id=60",
    "https://user:pass@dembed.st/premiumtv/daddy.php?id=60",
    "https://dembed.st/premiumtv/daddy.php?id=bad",
  ])
    expect(daddyFrame(`<iframe src="${url}"></iframe>`, "player")).toBeNull();
});
it("classifies channels by explicit sporting identity", () => {
  expect(daddySport("Sky Sports F1 UK")).toBe("Motorsport");
  expect(daddySport("Willow Cricket")).toBe("Cricket");
  expect(daddySport("WWE Network")).toBe("Wrestling");
  expect(daddySport("ESPN")).toBe("Sports");
});
it("publishes discovered embeds in the background without waiting in a page request or synthesizing sources", async () => {
  const calls: string[] = [];
  const fetcher = async (input: string | URL | Request) => {
    const u = String(input);
    calls.push(u);
    return new Response(
      u.endsWith("24-7-channels.php")
        ? row(60, "Sky Sports F1")
        : u.includes("watch.php")
          ? '<iframe src="https://thedaddy.li/stream/stream-60.php"></iframe>'
          : '<iframe src="https://dembed.st/premiumtv/daddy.php?id=60"></iframe>',
    );
  };
  const store = new DaddyCatalogue(fetcher as typeof fetch);
  expect((await store.feed()).data).toHaveLength(0);
  for (let i = 0; i < 30 && !(await store.feed()).data.length; i++)
    await new Promise((r) => setTimeout(r, 10));
  const feed = await store.feed();
  expect(feed.data[0]).toMatchObject({
    title: "Sky Sports F1",
    channel: true,
    category: "Motorsport",
    sources: [{ url: "https://dembed.st/premiumtv/daddy.php?id=60" }],
  });
  expect(calls).toHaveLength(3);
});
it("does not publish access denied pages as streams", async () => {
  const store = new DaddyCatalogue(
    (async () => new Response("Denied", { status: 403 })) as typeof fetch,
  );
  await store.feed();
  await new Promise((r) => setImmediate(r));
  expect(await store.feed()).toMatchObject({ data: [], stale: true });
});

it("matches supplied logos conservatively and rejects invalid image URLs", () => {
  const map = channelArtwork({
    channels: [
      {
        genre: 2,
        name: "Sky Sports F1",
        logo: "https://images.example.com/f1.png",
      },
      { genre: 1, name: "ABC", logo: "https://images.example.com/abc.png" },
      { genre: 2, name: "Bad", logo: "javascript:alert(1)" },
    ],
  });
  expect(map.get(channelArtworkKey("Sky Sports F1 UK"))).toBe(
    "https://images.example.com/f1.png",
  );
  expect(map.has(channelArtworkKey("Sky Sports F1 Italy"))).toBe(false);
  expect(map.size).toBe(1);
});
