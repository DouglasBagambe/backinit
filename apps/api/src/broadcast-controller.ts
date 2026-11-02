import {
  Controller,
  Get,
  type OnModuleInit,
  type OnModuleDestroy,
} from "@nestjs/common";
import { ppvCatalogue } from "./providers/ppv-catalogue.js";
@Controller()
export class BroadcastController implements OnModuleInit, OnModuleDestroy {
  private timer?: ReturnType<typeof setInterval>;
  onModuleInit() {
    if (process.env.SPORTS_PROVIDERS_DISABLED === "true") return;
    void ppvCatalogue.feed();
    this.timer = setInterval(() => void ppvCatalogue.feed(), 60000);
    this.timer.unref();
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }
  @Get("broadcasts") feed() {
    if (process.env.SPORTS_PROVIDERS_DISABLED === "true")
      return { data: [], updatedAt: null, stale: false };
    return ppvCatalogue.feed();
  }
}
