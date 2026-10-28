import { Controller, Get, Query, BadRequestException } from "@nestjs/common";
import { validateScheduleDate, watchFeed } from "./watch-feed.js";
import { streams } from "./stream-controller.js";
import { service } from "./providers/service.js";
import { OfficialVideoCatalog } from "./providers/official-video.js";
const catalog = new OfficialVideoCatalog(streams);
@Controller()
export class WatchController {
  @Get("watch") async feed(@Query("date") date?: string) {
    validateScheduleDate(date);
    return watchFeed(await service.feed("real", date), date, (event) =>
      streams.forEvent(event),
    );
  }
  @Get("videos") videos() {
    return catalog.feed();
  }
}
