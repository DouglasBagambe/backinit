import { BadRequestException } from "@nestjs/common";
import type {
  EventFeed,
  SportEvent,
  StreamSource,
} from "../../../packages/domain/src/index.js";
import { hasMatchTracker } from "../../../packages/domain/src/index.js";
export function validateScheduleDate(date?: string) {
  if (
    date &&
    (!/^20\d{2}-\d{2}-\d{2}$/.test(date) ||
      !Number.isFinite(Date.parse(date)) ||
      new Date(date).toISOString().slice(0, 10) !== date)
  )
    throw new BadRequestException("Invalid schedule date");
}
export function watchFeed(
  feed: EventFeed,
  date: string | undefined,
  sourcesFor: (event: SportEvent) => StreamSource[],
) {
  const now = date ? Date.parse(`${date}T12:00:00Z`) : Date.now();
  return {
    data: feed.data
      .filter(
        (e) =>
          e.status !== "finished" &&
          (e.status === "live" ||
            Date.parse(e.end || e.start) >= now - 86400000) &&
          Date.parse(e.start) <= now + 14 * 86400000,
      )
      .map((event) => {
        const sources = sourcesFor(event);
        return {
          event,
          sources,
          availability: sources.some(
            (s) => (s.presentation || "live") === "live",
          )
            ? ("in-page" as const)
            : event.viewingLinks?.length
              ? ("external-only" as const)
              : ("unavailable" as const),
        };
      })
      // Match the Watch screen's eligibility before transferring the payload.
      // Fixtures without a broadcast or reported tracking data remain in Fixtures.
      .filter(
        ({ event, sources }) =>
          hasMatchTracker(event) ||
          sources.some((source) => (source.presentation || "live") === "live"),
      ),
    coverage: feed.coverage,
    generatedAt: new Date().toISOString(),
  };
}
