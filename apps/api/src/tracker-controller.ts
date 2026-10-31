import {
  Controller,
  Get,
  Query,
  Res,
  Param,
  BadRequestException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { MatchTrackerProvider } from "./providers/match-tracker.js";
import { SportradarTrackerProvider } from "./providers/sportradar-tracker.js";
import { service } from "./providers/service.js";
import { trackerView } from "./providers/tracker-view.js";
const tracker = new MatchTrackerProvider();
const sportradar = new SportradarTrackerProvider();
@Controller()
export class TrackerController {
  @Get("trackers/:id/view") async view(
    @Param("id") id: string,
    @Query("theme") theme: string | undefined,
    @Res({ passthrough: true })
    response: {
      setHeader(name: string, value: string): void;
      removeHeader(name: string): void;
    },
  ) {
    if (
      !/^[a-z0-9-]{1,80}$/.test(id) ||
      (theme && !["light", "dark"].includes(theme))
    )
      throw new BadRequestException("Invalid tracker view");
    const event = await service.trackerFixture(id);
    const source = event && (await tracker.forEvent(event));
    if (!source)
      throw new ServiceUnavailableException("Live animation unavailable");
    const html = await trackerView(source, theme === "dark" ? "dark" : "light");
    response.removeHeader("X-Frame-Options");
    response.setHeader(
      "Content-Security-Policy",
      "sandbox allow-scripts allow-same-origin; default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; frame-src https://widgets.thesports01.com; connect-src 'none'; img-src data:; base-uri https://sportscore.com; form-action 'none'; worker-src 'none'; frame-ancestors https://www.backinit.live https://backinit.live http://127.0.0.1:3000",
    );
    response.setHeader("Content-Type", "text/html; charset=utf-8");
    response.setHeader("Cache-Control", "no-store");
    return html;
  }
  @Get("trackers/:id") async forEvent(@Param("id") id: string) {
    if (!/^[a-z0-9-]{1,80}$/.test(id))
      throw new BadRequestException("Invalid event");
    try {
      const event = await service.trackerFixture(id);
      const data = event
        ? (sportradar.forEvent(event) ?? (await tracker.forEvent(event)))
        : null;
      return {
        data:
          data?.provider === "SportScore"
            ? {
                ...data,
                viewUrl: `https://backinit-api.onrender.com/trackers/${id}/view`,
              }
            : data,
      };
    } catch {
      throw new ServiceUnavailableException(
        "Match tracker temporarily unavailable",
      );
    }
  }
}
