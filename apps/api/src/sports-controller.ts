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
import {
  searchEntities,
  athleteProfile,
  teamProfile,
} from "./providers/entity-search.js";
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
  onModuleInit() {
    if (process.env.SPORTS_PROVIDERS_DISABLED !== "true") void news.feed();
  }
  constructor(
    @Optional()
    @Inject("SPORTS_NOTIFICATIONS")
    private readonly notifications?: { ingest(events: SportEvent[]): unknown },
  ) {}
  @Get("news") news() {
    return news.feed();
  }
  @Get("search") async search(@Query("q") input?: string) {
    const query = input?.trim() || "";
    if (query.length < 2 || query.length > 80)
      throw new BadRequestException("Search needs 2–80 characters");
    return searchEntities(query);
  }
  @Get("athlete-profile") async athlete(@Query() input: unknown) {
    const parsed = z
      .object({
        sport: z.string().regex(/^[a-z]{2,20}$/),
        league: z.string().regex(/^[a-z0-9][a-z0-9._-]{0,39}$/),
        id: z.string().regex(/^\d{1,15}$/),
      })
      .safeParse(input);
    if (!parsed.success) throw new BadRequestException("Invalid profile");
    return athleteProfile(
      parsed.data.sport,
      parsed.data.league,
      parsed.data.id,
    );
  }
  @Get("team-profile") async team(@Query() input: unknown) {
    const parsed = z
      .object({
        sport: z.string().regex(/^[a-z]{2,20}$/),
        league: z.string().regex(/^[a-z0-9][a-z0-9._-]{0,39}$/),
        id: z.string().regex(/^\d{1,15}$/),
      })
      .safeParse(input);
    if (!parsed.success) throw new BadRequestException("Invalid profile");
    return teamProfile(parsed.data.sport, parsed.data.league, parsed.data.id);
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
      mode:
        process.env.SPORTS_DATA_ONLY === "true"
          ? process.env.DATABASE_URL
            ? "data+accounts"
            : "data-only"
          : "full",
    };
  }
  @Get("events") async list(@Query() input: unknown) {
    const parsed = z
      .object({
        sport: sportSchema.optional(),
        edition: editionSchema,
        q: z.string().max(100).optional(),
        date: z
          .string()
          .regex(/^20\d{2}-\d{2}-\d{2}$/)
          .refine((value) => {
            const parsed = new Date(`${value}T12:00:00Z`);
            return (
              Number.isFinite(parsed.getTime()) &&
              parsed.toISOString().slice(0, 10) === value
            );
          })
          .optional(),
      })
      .safeParse(input);
    if (!parsed.success) throw new BadRequestException("Invalid event filters");
    const { sport, q: query, edition, date } = parsed.data;
    const feed = await service.feed(edition, date, sport);
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
  @Get("standings") async standings(@Query("league") league?: string) {
    if (
      league &&
      !["eng.1", "esp.1", "ger.1", "ita.1", "fra.1", "ned.1", "por.1"].includes(
        league,
      )
    )
      throw new BadRequestException("Unsupported league");
    return service.standings(league);
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
