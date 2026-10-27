import { Body, Controller, Delete, Get, Headers, Post } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { Notifications } from "./notifications.js";
import { Accounts } from "./accounts.js";
export const accounts = new Accounts();
export const notifications = new Notifications(accounts);
@Controller("account")
export class AccountController {
  @Get("notifications") notifications(@Headers("authorization") auth?: string) {
    return notifications.list(accounts.user(auth));
  }
  @Post("notification-preferences") preferences(
    @Body() body: unknown,
    @Headers("authorization") auth?: string,
  ) {
    return notifications.preferences(accounts.user(auth), body);
  }
  @Post("notification-read") read(
    @Body() body: unknown,
    @Headers("authorization") auth?: string,
  ) {
    return notifications.read(accounts.user(auth), body);
  }
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
  @Post("recover")
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  recover(@Body() body: unknown) {
    return accounts.recover(body);
  }
  @Post("recovery-codes")
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  recoveryCodes(
    @Body() body: unknown,
    @Headers("authorization") auth?: string,
  ) {
    return accounts.recoveryCodes(accounts.user(auth), body);
  }
  @Post("password")
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  password(@Body() body: unknown, @Headers("authorization") auth?: string) {
    return accounts.changePassword(accounts.user(auth), body);
  }
  @Get("export") export(@Headers("authorization") auth?: string) {
    return accounts.export(accounts.user(auth));
  }
  @Post("delete")
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  deleteAccount(
    @Body() body: unknown,
    @Headers("authorization") auth?: string,
  ) {
    return accounts.removeAccount(accounts.user(auth), body);
  }
  @Post("logout-all") logoutAll(@Headers("authorization") auth?: string) {
    return accounts.logoutAll(accounts.user(auth));
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
