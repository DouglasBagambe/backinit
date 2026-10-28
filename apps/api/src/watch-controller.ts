import { Controller, Get, Query, BadRequestException } from "@nestjs/common";
import { streams } from "./stream-controller.js";
import { service } from "./providers/service.js";
import { OfficialVideoCatalog } from "./providers/official-video.js";
const catalog = new OfficialVideoCatalog(streams);
@Controller()
export class WatchController {
  @Get("watch") async feed(@Query("date") date?: string) {
    if (
      date &&
      (!/^20\d{2}-\d{2}-\d{2}$/.test(date) ||
        !Number.isFinite(Date.parse(date)) ||
        new Date(date).toISOString().slice(0, 10) !== date)
    )
      throw new BadRequestException("Invalid schedule date");
    const feed = await service.feed("real", date);
    const now = date ? Date.parse(`${date}T12:00:00Z`) : Date.now();
    const data = feed.data
      .filter(
        (e) =>
          (e.status === "live" ||
            Date.parse(e.end || e.start) >= now - 86400000) &&
          Date.parse(e.start) <= now + 14 * 86400000,
      )
      .map((event) => {
        const sources = streams.forEvent(event);
        return {
          event,
          sources,
          availability: sources.some(
            (s) => (s.presentation || "live") === "live",
          )
            ? "in-page"
            : event.viewingLinks?.length
              ? "external-only"
              : "unavailable",
        };
      });
    return {
      data,
      coverage: feed.coverage,
      generatedAt: new Date().toISOString(),
    };
  }
  @Get("videos") videos() {
    return catalog.feed();
  }
}
