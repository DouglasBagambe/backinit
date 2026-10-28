import "reflect-metadata";
import {
  All,
  Controller,
  Get,
  Module,
  Query,
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
        "Broadcast sources and accounts need persistent storage. This API currently serves real sports data only.",
      fetchedAt: null,
    });
    return watchFeed(feed, date, () => []);
  }
  @All(["streams", "streams/*path", "videos", "account/*path", "admin/*path"])
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
