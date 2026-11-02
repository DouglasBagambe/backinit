import { BroadcastController } from "./broadcast-controller.js";
import "reflect-metadata";
import { TrackerController } from "./tracker-controller.js";
import {
  All,
  Body,
  Controller,
  Get,
  Post,
  Headers,
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
import { OfficialVideoCatalog } from "./providers/official-video.js";
const catalog = new OfficialVideoCatalog();
import { validateScheduleDate, watchFeed } from "./watch-feed.js";
import { sourceCandidates } from "./providers/source-candidates.js";
const accountRuntime = process.env.DATABASE_URL
  ? await import("./hosted-accounts.js")
  : null;
@Controller()
class DataController {
  @Get("watch") async watch(@Query("date") date?: string) {
    validateScheduleDate(date);
    const feed = await service.feed("real", date);
    const custom = accountRuntime
      ? await accountRuntime.streams.publicForEvents(feed.data)
      : new Map();
    feed.coverage.push({
      provider: "Broadcast registry",
      sport: "All",
      status: accountRuntime
        ? custom
          ? "available"
          : "unavailable"
        : "not-configured",
      message: accountRuntime
        ? custom
          ? "Persistent broadcast registry connected. Verified sources and official publisher embeds are included."
          : "Custom broadcast registry is temporarily unavailable. Official publisher discovery remains available."
        : "Custom broadcast sources and accounts need persistent storage. Official publisher embeds are discovered automatically.",
      fetchedAt: null,
    });
    return watchFeed(feed, date, (event) => [
      ...(custom?.get(event.id) || []),
      ...service.broadcastSources(event),
    ]);
  }
  @Get("videos") videos() {
    return catalog.feed();
  }
  @Get("streams") async sources(
    @Query("event") id?: string,
    @Query("library") library?: string,
  ) {
    if (!id)
      return { data: library === "1" ? (await catalog.feed()).data : [] };
    if (!/^[a-z0-9-]{1,80}$/.test(id))
      throw new BadRequestException("Invalid event");
    const event = await service.fixture(id, "real");
    return {
      data: event
        ? [
            ...(accountRuntime
              ? (await accountRuntime.streams.publicForEvents([event]))?.get(
                  event.id,
                ) || []
              : []),
            ...service.broadcastSources(event),
          ]
        : [],
    };
  }
  @Get("streams/:id/health") async sourceHealth(@Param("id") id: string) {
    if (/^yt-[a-f0-9]{24}$/.test(id)) {
      const source = (await catalog.feed()).data.find((s) => s.id === id);
      if (!source) throw new NotFoundException("Video no longer available");
      return {
        status: "metadata-available",
        checkedAt: source.validFrom,
        message:
          "Official video metadata is available. The publisher controls playback and regional availability.",
      };
    }
    if (!/^official-[a-z0-9-]{1,70}$/.test(id)) {
      if (!/^[a-z0-9-]{1,80}$/.test(id) || !accountRuntime)
        throw new NotFoundException("Source not found");
      return accountRuntime.streams.health(id);
    }
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
  private async operator(auth?: string) {
    if (!accountRuntime)
      throw new ServiceUnavailableException(
        "Persistent source storage is not connected.",
      );
    return {
      runtime: accountRuntime,
      user: await accountRuntime.accounts.admin(auth),
    };
  }
  @Get("admin/sources") async adminSources(
    @Headers("authorization") auth?: string,
  ) {
    const { runtime } = await this.operator(auth);
    const [data, checks] = await Promise.all([
      runtime.streams.all(),
      runtime.streams.checks(),
    ]);
    return { data, checks };
  }
  @Post("admin/sources") async saveSource(
    @Body() body: unknown,
    @Headers("authorization") auth?: string,
  ) {
    const { runtime, user } = await this.operator(auth);
    const input = body as {
      content?: string;
      eventId?: string;
      fixtureRef?: { provider: string; externalId: string };
    } | null;
    if (input?.content === "sports") {
      const event = input.eventId
        ? await service.fixture(input.eventId, "real")
        : (await service.feed("real")).data.find(
            (e) =>
              e.source?.provider === input.fixtureRef?.provider &&
              e.externalId === input.fixtureRef?.externalId,
          );
      if (!event)
        throw new BadRequestException(
          "Choose a real, ingested fixture before saving a sports source.",
        );
    }
    return runtime.streams.save(user, body);
  }
  @Get("admin/fixtures") async adminFixtures(
    @Headers("authorization") auth?: string,
  ) {
    await this.operator(auth);
    const feed = await service.feed("real");
    return { ...feed, candidates: sourceCandidates(feed.data) };
  }
  @Get("admin/source-check") async checkSource(
    @Query("id") id: string,
    @Headers("authorization") auth?: string,
  ) {
    const { runtime } = await this.operator(auth);
    if (!/^[a-z0-9-]{1,80}$/.test(id || ""))
      throw new BadRequestException("Invalid source");
    return runtime.streams.health(id, true);
  }
  @Post("admin/source-check") async recordSource(
    @Body() body: unknown,
    @Headers("authorization") auth?: string,
  ) {
    const { runtime, user } = await this.operator(auth);
    return runtime.streams.recordCheck(user, body);
  }
  @Get("admin/audit") async sourceAudit(
    @Headers("authorization") auth?: string,
  ) {
    const { runtime } = await this.operator(auth);
    return { data: await runtime.streams.auditLog() };
  }
  @All(["streams/*path", ...(!accountRuntime ? ["account/*path"] : [])])
  unavailable() {
    throw new ServiceUnavailableException(
      "Persistent accounts and broadcast sources are not connected on this data-only API.",
    );
  }
}
@Module({
  imports: [ThrottlerModule.forRoot([{ ttl: 60000, limit: 120 }])],
  controllers: [
    BroadcastController,
    TrackerController,
    SportsController,
    DataController,
    ...(accountRuntime ? [accountRuntime.AccountController] : []),
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    ...(accountRuntime ? [accountRuntime.AccountDatabaseLifecycle] : []),
  ],
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
