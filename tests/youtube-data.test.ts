import { expect, it } from "vitest";
import { youtubeDataMetadata } from "../apps/api/src/providers/youtube-data";
const item = {
  id: "X8zS3uXmwFA",
  snippet: {
    channelId: "official",
    title: "LIVE - old broadcast",
    liveBroadcastContent: "none",
  },
  status: { privacyStatus: "public", embeddable: true },
  liveStreamingDetails: {
    actualStartTime: "2026-10-29T09:00:00Z",
    actualEndTime: "2026-10-29T10:00:00Z",
  },
};
it("maps actual API timestamps and status without inferring live from titles", () => {
  const r = youtubeDataMetadata({ items: [item] })[0]!;
  expect(
    r.metadata.microformat.playerMicroformatRenderer.liveBroadcastDetails,
  ).toMatchObject({
    isLiveNow: false,
    startTimestamp: "2026-10-29T09:00:00Z",
    endTimestamp: "2026-10-29T10:00:00Z",
  });
  const hidden = youtubeDataMetadata({
    items: [
      { ...item, status: { privacyStatus: "private", embeddable: false } },
    ],
  })[0]!;
  expect(hidden.metadata.playabilityStatus).toEqual({
    status: "UNAVAILABLE",
    playableInEmbed: false,
  });
  expect(() => youtubeDataMetadata({ error: { code: 403 } })).toThrow();
});
