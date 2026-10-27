import "reflect-metadata";
import {
  Controller,
  Get,
  Module,
  Param,
  Query,
  NotFoundException,
  BadRequestException,
  Sse,
} from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerModule, ThrottlerGuard } from "@nestjs/throttler";
import { z } from "zod";
import helmet from "helmet";
import { interval, map } from "rxjs";
import {
  filterEvents,
  sportSchema,
} from "../../../packages/domain/src/index.js";
import { SportsService } from "./providers/service.js";
import { StreamController } from "./stream-controller.js";
import { AccountController } from "./account-controller.js";
import { NewsService } from "./providers/news.js";
const news = new NewsService();
const service = new SportsService();
const editionSchema = z
  .enum(["real", "demo"])
  .default(process.env.SPORTS_DATA_MODE === "demo" ? "demo" : "real");
@Controller()
class SportsController {
  @Get("news") news() {
    return news.feed();
  }
  @Get("health") health() {
    return {
      status: "ok",
      provider:
        process.env.SPORTS_DATA_MODE === "demo"
          ? "demo"
          : "OpenLigaDB / Jolpica",
      realTime: false,
    };
  }
  @Get("events") async list(@Query() input: unknown) {
    const parsed = z
      .object({
        sport: sportSchema.optional(),
        edition: editionSchema,
        q: z.string().max(100).optional(),
      })
      .safeParse(input);
    if (!parsed.success) throw new BadRequestException("Invalid event filters");
    const { sport, q: query, edition } = parsed.data;
    const feed = await service.feed(edition);
    return { ...feed, data: filterEvents(feed.data, { sport, query }) };
  }
  @Get("events/:id") async one(
    @Param("id") id: string,
    @Query("edition") input: unknown,
  ) {
    const edition = editionSchema.safeParse(input);
    if (!edition.success || !/^[a-z0-9-]{1,80}$/.test(id))
      throw new BadRequestException("Invalid event request");
    const event = await service.event(id, edition.data);
    if (!event) throw new NotFoundException("Event not found");
    return event;
  }
  @Get("standings") async standings() {
    return service.standings();
  }
  @Sse("updates") updates() {
    return interval(15000).pipe(
      map(() => ({
        data: {
          type: "heartbeat",
          realTime: false,
          message:
            "Connection heartbeat only; refresh feeds for provider snapshots.",
          at: new Date().toISOString(),
        },
      })),
    );
  }
}
@Module({
  imports: [
    ThrottlerModule.forRoot([
      { ttl: 60000, limit: process.env.NODE_ENV === "test" ? 10000 : 120 },
    ]),
  ],
  controllers: [SportsController, AccountController, StreamController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
class AppModule {}
async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ["error", "warn", "log"],
  });
  app.use(helmet());
  app.enableCors({ origin: process.env.WEB_ORIGIN || "http://127.0.0.1:3000" });
  await app.listen(Number(process.env.PORT || 4000), "127.0.0.1");
}
void bootstrap();
