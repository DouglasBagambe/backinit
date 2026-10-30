import {
  Controller,
  Get,
  Param,
  BadRequestException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { MatchTrackerProvider } from "./providers/match-tracker.js";
import { service } from "./providers/service.js";
const tracker = new MatchTrackerProvider();
@Controller()
export class TrackerController {
  @Get("trackers/:id") async forEvent(@Param("id") id: string) {
    if (!/^[a-z0-9-]{1,80}$/.test(id))
      throw new BadRequestException("Invalid event");
    try {
      const event = await service.fixture(id, "real");
      return { data: event ? await tracker.forEvent(event) : null };
    } catch {
      throw new ServiceUnavailableException(
        "Match tracker temporarily unavailable",
      );
    }
  }
}
