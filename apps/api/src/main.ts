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
  DemoProvider,
  filterEvents,
  sportSchema,
} from "../../../packages/domain/src/index.js";
const provider = new DemoProvider();
@Controller()
class SportsController {
  @Get("health") health() {
    return { status: "ok", provider: "demo", realTime: false };
  }
  @Get("events") async list(@Query() input: unknown) {
    const parsed = z
      .object({
        sport: sportSchema.optional(),
        q: z.string().max(100).optional(),
      })
      .safeParse(input);
    if (!parsed.success) throw new BadRequestException("Invalid event filters");
    const { sport, q: query } = parsed.data;
    return {
      data: filterEvents(await provider.getEvents(), { sport, query }),
      provenance: "demo",
      asOf: "2026-10-26T19:00:00Z",
    };
  }
  @Get("events/:id") async one(@Param("id") id: string) {
    const event = (await provider.getEvents()).find((e) => e.id === id);
    if (!event) throw new NotFoundException("Event not found");
    return event;
  }
  @Sse("updates") updates() {
    return interval(15000).pipe(
      map(() => ({
        data: {
          type: "heartbeat",
          provider: "demo",
          at: new Date().toISOString(),
        },
      })),
    );
  }
}
@Module({
  imports: [ThrottlerModule.forRoot([{ ttl: 60000, limit: 120 }])],
  controllers: [SportsController],
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
