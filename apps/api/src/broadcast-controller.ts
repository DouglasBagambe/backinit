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
import type { Broadcast } from "../../../packages/domain/src/index.js";
import { matchoraCatalogue } from "./providers/matchora-catalogue.js";

function fixtureKey(item: Broadcast): string {
  const title = item.title
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s+(?:v\.?|vs\.?|versus)\s+/g, " vs ")
    .replace(/\s+/g, " ")
    .trim();
  return JSON.stringify([item.category.toLowerCase(), title, item.start]);
}

export function mergeBroadcasts(primary: Broadcast[], extra: Broadcast[]): Broadcast[] {
  const result = [...primary];
  const matches = new Map<string, number[]>();
  for (const [index, item] of primary.entries()) {
    if (item.channel || item.replay) continue;
    const key = fixtureKey(item);
    matches.set(key, [...(matches.get(key) ?? []), index]);
  }
  for (const item of extra) {
    const candidates = matches.get(fixtureKey(item));
    if (item.channel || item.replay || candidates?.length !== 1) {
      result.push(item);
      continue;
    }
    const index = candidates[0]!;
    const current = result[index]!;
    const sources = [...current.sources];
    const urls = new Set(sources.map((source) => source.url));
    for (const source of item.sources) {
      if (urls.has(source.url)) continue;
      urls.add(source.url);
      sources.push(source);
    }
    result[index] = { ...current, sources };
  }
  return result;
}

async function broadcastFeed() {
  if (process.env.MATCHORA_ENABLED !== "true") return ppvCatalogue.feed();
  const [ppv, extra] = await Promise.all([
    ppvCatalogue.feed(),
    matchoraCatalogue.feed(),
  ]);
  return { ...ppv, data: mergeBroadcasts(ppv.data, extra) };
}

@Controller()
export class BroadcastController implements OnModuleInit, OnModuleDestroy {
  private timer?: ReturnType<typeof setInterval>;
  onModuleInit() {
    if (process.env.SPORTS_PROVIDERS_DISABLED === "true") return;
    void broadcastFeed();
    this.timer = setInterval(() => void broadcastFeed(), 60000);
    this.timer.unref();
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }
  @Get("broadcasts") feed() {
    if (process.env.SPORTS_PROVIDERS_DISABLED === "true")
      return { data: [], updatedAt: new Date().toISOString(), stale: false };
    return broadcastFeed();
  }
  @Get("broadcasts/:id/event") async event(@Param("id") id: string) {
    if (!/^(?:ppv|matchora)-\d+$/.test(id))
      throw new BadRequestException("Invalid broadcast");
    if (process.env.SPORTS_PROVIDERS_DISABLED === "true") return { data: null };
    const item = (await broadcastFeed()).data.find((b) => b.id === id);
    if (!item || item.channel) return { data: null };
    const events = await service.broadcastScoreboard(
      item.category,
      new Date(item.start).toISOString().slice(0, 10),
    );
    return { data: broadcastEvent(item, events) };
  }
}
