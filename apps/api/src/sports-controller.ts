import {
  Controller,
  Get,
  Param,
  Query,
  NotFoundException,
  BadRequestException,
  Sse,
  Optional,
  Inject,
} from "@nestjs/common";
import { z } from "zod";
import { interval, map } from "rxjs";
import {
  filterEvents,
  sportSchema,
  type SportEvent,
} from "../../../packages/domain/src/index.js";
import { service } from "./providers/service.js";
import { NewsService } from "./providers/news.js";
const news = new NewsService();
const editionSchema = z
  .enum(["real", "demo"])
  .default(
    process.env.ALLOW_DEMO_MODE === "true" &&
      process.env.SPORTS_DATA_MODE === "demo"
      ? "demo"
      : "real",
  );
@Controller()
export class SportsController {
  constructor(
    @Optional()
    @Inject("SPORTS_NOTIFICATIONS")
    private readonly notifications?: { ingest(events: SportEvent[]): unknown },
  ) {}
  @Get("news") news() {
    return news.feed();
  }
  @Get("health") health() {
    return {
      status: "ok",
      provider:
        process.env.ALLOW_DEMO_MODE === "true" &&
        process.env.SPORTS_DATA_MODE === "demo"
          ? "demo"
          : "Automated sports providers",
      realTime: false,
      mode: process.env.SPORTS_DATA_ONLY === "true" ? "data-only" : "full",
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
    if (edition === "real") this.notifications?.ingest(feed.data);
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
