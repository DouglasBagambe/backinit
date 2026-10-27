import { Body, Controller, Delete, Get, Headers, Post } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { Accounts } from "./accounts.js";
export const accounts = new Accounts();
@Controller("account")
export class AccountController {
  @Post("register")
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  register(@Body() body: unknown) {
    return accounts.authenticate(body, true);
  }
  @Post("login")
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  login(@Body() body: unknown) {
    return accounts.authenticate(body, false);
  }
  @Get("me") me(@Headers("authorization") auth?: string) {
    return { user: accounts.user(auth) };
  }
  @Post("logout") logout(@Headers("authorization") auth?: string) {
    return accounts.logout(auth);
  }
  @Delete("saved-events") clearEvents(@Headers("authorization") auth?: string) {
    return accounts.clearEvents(accounts.user(auth));
  }
  @Get("favorites") favorites(@Headers("authorization") auth?: string) {
    return { data: accounts.list(accounts.user(auth)) };
  }
  @Post("favorites") save(
    @Body() body: unknown,
    @Headers("authorization") auth?: string,
  ) {
    return { data: accounts.favorite(accounts.user(auth), body, false) };
  }
  @Delete("favorites") remove(
    @Body() body: unknown,
    @Headers("authorization") auth?: string,
  ) {
    return { data: accounts.favorite(accounts.user(auth), body, true) };
  }
}
