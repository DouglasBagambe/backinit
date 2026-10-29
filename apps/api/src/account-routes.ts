import { Body, Controller, Delete, Get, Headers, Post } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type { Accounts } from "./accounts.js";
import type { Notifications } from "./notifications.js";
type AwaitableMethods<T> = {
  [K in keyof T]: T[K] extends (...args: infer A) => infer R
    ? (...args: A) => R | Promise<Awaited<R>>
    : never;
};
export type AccountOperations = AwaitableMethods<
  Pick<
    Accounts,
    | "user"
    | "authenticate"
    | "recover"
    | "recoveryCodes"
    | "changePassword"
    | "export"
    | "removeAccount"
    | "logoutAll"
    | "logout"
    | "clearEvents"
    | "list"
    | "favorite"
  >
>;
export type NotificationOperations = AwaitableMethods<
  Pick<Notifications, "list" | "preferences" | "read">
>;
export function createAccountController(
  accounts: AccountOperations,
  notifications: NotificationOperations,
) {
  @Controller("account")
  class AccountController {
    @Get("notifications") async notifications(
      @Headers("authorization") auth?: string,
    ) {
      return notifications.list(await accounts.user(auth));
    }
    @Post("notification-preferences") async preferences(
      @Body() body: unknown,
      @Headers("authorization") auth?: string,
    ) {
      return notifications.preferences(await accounts.user(auth), body);
    }
    @Post("notification-read") async read(
      @Body() body: unknown,
      @Headers("authorization") auth?: string,
    ) {
      return notifications.read(await accounts.user(auth), body);
    }
    @Post("register")
    @Throttle({ default: { limit: 5, ttl: 60000 } })
    async register(@Body() body: unknown) {
      return accounts.authenticate(body, true);
    }
    @Post("login")
    @Throttle({ default: { limit: 5, ttl: 60000 } })
    async login(@Body() body: unknown) {
      return accounts.authenticate(body, false);
    }
    @Post("recover")
    @Throttle({ default: { limit: 5, ttl: 60000 } })
    async recover(@Body() body: unknown) {
      return accounts.recover(body);
    }
    @Post("recovery-codes")
    @Throttle({ default: { limit: 5, ttl: 60000 } })
    async recoveryCodes(
      @Body() body: unknown,
      @Headers("authorization") auth?: string,
    ) {
      return accounts.recoveryCodes(await accounts.user(auth), body);
    }
    @Post("password")
    @Throttle({ default: { limit: 5, ttl: 60000 } })
    async password(
      @Body() body: unknown,
      @Headers("authorization") auth?: string,
    ) {
      return accounts.changePassword(await accounts.user(auth), body);
    }
    @Get("export") async export(@Headers("authorization") auth?: string) {
      return accounts.export(await accounts.user(auth));
    }
    @Post("delete")
    @Throttle({ default: { limit: 5, ttl: 60000 } })
    async deleteAccount(
      @Body() body: unknown,
      @Headers("authorization") auth?: string,
    ) {
      return accounts.removeAccount(await accounts.user(auth), body);
    }
    @Post("logout-all") async logoutAll(
      @Headers("authorization") auth?: string,
    ) {
      return accounts.logoutAll(await accounts.user(auth));
    }
    @Get("me") async me(@Headers("authorization") auth?: string) {
      return { user: await accounts.user(auth) };
    }
    @Post("logout") async logout(@Headers("authorization") auth?: string) {
      return accounts.logout(auth);
    }
    @Delete("saved-events") async clearEvents(
      @Headers("authorization") auth?: string,
    ) {
      return accounts.clearEvents(await accounts.user(auth));
    }
    @Get("favorites") async favorites(@Headers("authorization") auth?: string) {
      return { data: await accounts.list(await accounts.user(auth)) };
    }
    @Post("favorites") async save(
      @Body() body: unknown,
      @Headers("authorization") auth?: string,
    ) {
      return {
        data: await accounts.favorite(await accounts.user(auth), body, false),
      };
    }
    @Delete("favorites") async remove(
      @Body() body: unknown,
      @Headers("authorization") auth?: string,
    ) {
      return {
        data: await accounts.favorite(await accounts.user(auth), body, true),
      };
    }
  }

  return AccountController;
}
