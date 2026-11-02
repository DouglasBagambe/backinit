import {
  Controller,
  Get,
  Param,
  BadRequestException,
  type OnModuleInit,
  type OnModuleDestroy,
} from "@nestjs/common";
import { service } from "./providers/service.js";
import { broadcastEvent } from "./providers/broadcast-event.js";
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
      return { data: [], updatedAt: new Date().toISOString(), stale: false };
    return ppvCatalogue.feed();
  }
  @Get("broadcasts/:id/event") async event(@Param("id") id: string) {
    if (!/^ppv-\d+$/.test(id))
      throw new BadRequestException("Invalid broadcast");
    if (process.env.SPORTS_PROVIDERS_DISABLED === "true") return { data: null };
    const item = (await ppvCatalogue.feed()).data.find((b) => b.id === id);
    if (!item || item.channel) return { data: null };
    const events = await service.broadcastScoreboard(
      item.category,
      new Date(item.start).toISOString().slice(0, 10),
    );
    return { data: broadcastEvent(item, events) };
  }
}
