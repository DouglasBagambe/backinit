/** DATABASE_URL must use the owner role and a direct connection. Never prints credentials. */
import {
  databasePool,
  migrateAccounts,
} from "../apps/api/dist/apps/api/src/postgres.js";
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
if (new URL(process.env.DATABASE_URL).hostname.includes("-pooler."))
  throw new Error("Migrations require a direct connection");
const pool = databasePool(process.env.DATABASE_URL);
try {
  await migrateAccounts(pool);
  console.log("Account schema version 1 ready");
} finally {
  await pool.end();
}
