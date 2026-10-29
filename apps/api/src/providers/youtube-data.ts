import { z } from "zod";
/** Public metadata only. Never requests media, licenses, viewer cookies or playback keys. */
const itemSchema = z.object({
  id: z.string().regex(/^[\w-]{11}$/),
  snippet: z.object({
    channelId: z.string(),
    title: z.string(),
    liveBroadcastContent: z.enum(["live", "upcoming", "none"]),
  }),
  status: z.object({
    privacyStatus: z.string(),
    embeddable: z.boolean(),
    uploadStatus: z.string().optional(),
  }),
  liveStreamingDetails: z
    .object({
      actualStartTime: z.string().optional(),
      scheduledStartTime: z.string().optional(),
      actualEndTime: z.string().optional(),
    })
    .optional(),
});
export function youtubeDataMetadata(raw: unknown) {
  const response = z.object({ items: z.array(itemSchema).max(50) }).parse(raw);
  return response.items.map((item) => ({
    id: item.id,
    metadata: {
      playabilityStatus: {
        status:
          item.status.privacyStatus === "public" &&
          (!item.status.uploadStatus ||
            item.status.uploadStatus === "processed")
            ? "OK"
            : "UNAVAILABLE",
        playableInEmbed: item.status.embeddable,
      },
      videoDetails: {
        channelId: item.snippet.channelId,
        title: item.snippet.title,
        isUpcoming: item.snippet.liveBroadcastContent === "upcoming",
      },
      microformat: {
        playerMicroformatRenderer: {
          liveBroadcastDetails: {
            isLiveNow:
              item.snippet.liveBroadcastContent === "live" &&
              !item.liveStreamingDetails?.actualEndTime,
            startTimestamp:
              item.liveStreamingDetails?.actualStartTime ||
              item.liveStreamingDetails?.scheduledStartTime,
            endTimestamp: item.liveStreamingDetails?.actualEndTime,
          },
        },
      },
    },
  }));
}
