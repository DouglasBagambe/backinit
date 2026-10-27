import { Controller, Get } from "@nestjs/common";
import { streams } from "./stream-controller.js";
import { OfficialVideoCatalog } from "./providers/official-video.js";
const catalog = new OfficialVideoCatalog(streams);
@Controller("watch")
export class WatchController {
  @Get() feed() {
    return catalog.feed();
  }
}
