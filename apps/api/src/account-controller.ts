import { Notifications } from "./notifications.js";
import { Accounts } from "./accounts.js";
import { createAccountController } from "./account-routes.js";
export const accounts = new Accounts();
export const notifications = new Notifications(accounts);
export const AccountController = createAccountController(
  accounts,
  notifications,
);
