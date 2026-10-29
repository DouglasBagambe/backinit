import type { OnModuleDestroy } from "@nestjs/common";
import { databasePool, checkAccountSchema } from "./postgres.js";
import { PostgresAccounts } from "./postgres-accounts.js";
import { PostgresNotifications } from "./postgres-notifications.js";
import { createAccountController } from "./account-routes.js";
const pool = databasePool(process.env.DATABASE_URL!);
await checkAccountSchema(pool);
export const accounts = new PostgresAccounts(pool);
export const notifications = new PostgresNotifications(accounts);
export const AccountController = createAccountController(
  accounts,
  notifications,
);
export class AccountDatabaseLifecycle implements OnModuleDestroy {
  async onModuleDestroy() {
    await pool.end();
  }
}
