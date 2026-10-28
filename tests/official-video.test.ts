import { it, expect } from "vitest";
import {
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
