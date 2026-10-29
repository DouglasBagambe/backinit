import "reflect-metadata";
import {
  All,
  Controller,
  Get,
  Module,
  Query,
  Param,
  BadRequestException,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { APP_GUARD, NestFactory } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import helmet from "helmet";
import { SportsController } from "./sports-controller.js";
import { service } from "./providers/service.js";
import { validateScheduleDate, watchFeed } from "./watch-feed.js";
@Controller()
class DataController {
  @Get("watch") async watch(@Query("date") date?: string) {
    validateScheduleDate(date);
    const feed = await service.feed("real", date);
    feed.coverage.push({
      provider: "Broadcast registry",
      sport: "All",
      status: "not-configured",
      message:
        "Custom broadcast sources and accounts need persistent storage. Official publisher embeds are discovered automatically.",
      fetchedAt: null,
    });
    return watchFeed(feed, date, (event) => service.broadcastSources(event));
  }
  @Get("streams") async sources(@Query("event") id?: string) {
    if (!id) return { data: [] };
    if (!/^[a-z0-9-]{1,80}$/.test(id))
      throw new BadRequestException("Invalid event");
    const event = await service.fixture(id, "real");
    return { data: event ? service.broadcastSources(event) : [] };
  }
  @Get("streams/:id/health") async sourceHealth(@Param("id") id: string) {
    if (!/^official-[a-z0-9-]{1,70}$/.test(id))
      throw new NotFoundException("Source not found");
    const event = await service.fixture(id.slice("official-".length), "real");
    const source =
      event && service.broadcastSources(event).find((s) => s.id === id);
    if (!source)
      throw new NotFoundException("Broadcast ended, expired or unavailable");
    return {
      status: "metadata-available",
      checkedAt: source.validFrom,
      message:
        "Official publisher reports live and allows embedding. Actual playback depends on your region and is checked by the player.",
    };
  }
  @All(["streams/*path", "videos", "account/*path", "admin/*path"])
  unavailable() {
    throw new ServiceUnavailableException(
      "Persistent accounts and broadcast sources are not connected on this data-only API.",
    );
  }
}
@Module({
  imports: [ThrottlerModule.forRoot([{ ttl: 60000, limit: 120 }])],
  controllers: [SportsController, DataController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
class DataModule {}
const app = await NestFactory.create(DataModule, {
  logger: ["error", "warn", "log"],
});
app.enableShutdownHooks();
app.use(helmet());
app.enableCors({
  origin: process.env.WEB_ORIGIN || "https://www.backinit.live",
});
await app.listen(
  Number(process.env.PORT || 4000),
  process.env.HOST || "0.0.0.0",
);
