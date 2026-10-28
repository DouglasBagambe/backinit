import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
} from "@nestjs/common";
import { service } from "./providers/service.js";
import { NotFoundException, BadRequestException } from "@nestjs/common";
import { accounts } from "./account-controller.js";
import { Streams } from "./streams.js";
import { sourceCandidates } from "./providers/source-candidates.js";
export const streams = new Streams(accounts);
@Controller()
export class StreamController {
  @Get("streams") async list(
    @Query("event") event?: string,
    @Query("library") library?: string,
  ) {
    if (event) {
      const fixture = await service.fixture(event, "real");
      return { data: fixture ? streams.forEvent(fixture) : [] };
    }
    return {
      data:
        library === "1" || process.env.ALLOW_DEMO_MODE === "true"
          ? streams.public(undefined, library === "1")
          : [],
    };
  }
  @Get("streams/:id/health") health(@Param("id") id: string) {
    return streams.health(id);
  }
  @Get("admin/sources") sources(@Headers("authorization") auth?: string) {
    accounts.admin(auth);
    return {
      data: streams.all(),
      checks: Object.fromEntries(
        streams.all().map((s) => [s.id, streams.lastCheck(s.id)]),
      ),
    };
  }
  @Post("admin/sources") async save(
    @Body() body: unknown,
    @Headers("authorization") auth?: string,
  ) {
    const user = accounts.admin(auth);
    const input = body as {
      content?: string;
      eventId?: string;
      fixtureRef?: { provider: string; externalId: string };
    };
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
    return streams.save(user, body);
  }
  @Get("admin/fixtures") async fixtures(
    @Headers("authorization") auth?: string,
  ) {
    accounts.admin(auth);
    const feed = await service.feed("real");
    return { ...feed, candidates: sourceCandidates(feed.data) };
  }
  @Get("admin/source-check") check(
    @Query("id") id: string,
    @Headers("authorization") auth?: string,
  ) {
    accounts.admin(auth);
    if (!/^[a-z0-9-]{1,80}$/.test(id || ""))
      throw new BadRequestException("Invalid source");
    return streams.health(id, true);
  }
  @Post("admin/source-check") record(
    @Body() body: unknown,
    @Headers("authorization") auth?: string,
  ) {
    return streams.recordCheck(accounts.admin(auth), body);
  }
  @Get("admin/audit") audit(@Headers("authorization") auth?: string) {
    accounts.admin(auth);
    return {
      data: accounts.db
        .prepare(
          "SELECT id,action,target,at FROM audit ORDER BY id DESC LIMIT 100",
        )
        .all(),
    };
  }
}
