import "reflect-metadata";
import { TrackerController } from "./tracker-controller.js";
import {
  Module,
  Injectable,
  type OnModuleInit,
  type OnModuleDestroy,
  Logger,
} from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerModule, ThrottlerGuard } from "@nestjs/throttler";
import helmet from "helmet";
import { service } from "./providers/service.js";
import { StreamController } from "./stream-controller.js";
import { AccountController, notifications } from "./account-controller.js";
import { WatchController } from "./watch-controller.js";
import { SportsController } from "./sports-controller.js";
@Injectable()
class SportsUpdates implements OnModuleInit, OnModuleDestroy {
  private timer?: ReturnType<typeof setInterval>;
  private running = false;
  onModuleInit() {
    if (
      process.env.ALLOW_DEMO_MODE === "true" &&
      process.env.SPORTS_DATA_MODE === "demo"
    )
      return;
    void this.poll();
    this.timer = setInterval(() => void this.poll(), 30000);
    this.timer.unref();
  }
  private async poll() {
    if (this.running) return;
    this.running = true;
    try {
      notifications.ingest((await service.feed("real")).data);
    } catch {
      Logger.warn(
        "Sports update ingestion failed; the next poll will retry.",
        "SportsUpdates",
      );
    } finally {
      this.running = false;
    }
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }
}
@Module({
  imports: [
    ThrottlerModule.forRoot([
      { ttl: 60000, limit: process.env.NODE_ENV === "test" ? 10000 : 120 },
    ]),
  ],
  controllers: [
    TrackerController,
    SportsController,
    AccountController,
    StreamController,
    WatchController,
  ],
  providers: [
    SportsUpdates,
    { provide: "SPORTS_NOTIFICATIONS", useValue: notifications },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
class AppModule {}
async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ["error", "warn", "log"],
  });
  app.enableShutdownHooks();
  app.use(helmet());
  app.enableCors({ origin: process.env.WEB_ORIGIN || "http://127.0.0.1:3000" });
  await app.listen(
    Number(process.env.PORT || 4000),
    process.env.HOST || "127.0.0.1",
  );
}
void bootstrap();
