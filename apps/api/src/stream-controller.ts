import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
} from "@nestjs/common";
import { accounts } from "./account-controller.js";
import { Streams } from "./streams.js";
export const streams = new Streams(accounts);
@Controller()
export class StreamController {
  @Get("streams") list(
    @Query("event") event?: string,
    @Query("library") library?: string,
  ) {
    return { data: streams.public(event, library === "1") };
  }
  @Get("streams/:id/health") health(@Param("id") id: string) {
    return streams.health(id);
  }
  @Get("admin/sources") sources(@Headers("authorization") auth?: string) {
    accounts.admin(auth);
    return { data: streams.all() };
  }
  @Post("admin/sources") save(
    @Body() body: unknown,
    @Headers("authorization") auth?: string,
  ) {
    return streams.save(accounts.admin(auth), body);
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
