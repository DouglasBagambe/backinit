/** Use the database owner and a direct connection. Credentials are never printed. */
import { databasePool } from "../apps/api/dist/apps/api/src/postgres.js";
import {
  migrateStreams,
  checkStreamSchema,
} from "../apps/api/dist/apps/api/src/postgres-streams.js";
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
if (new URL(process.env.DATABASE_URL).hostname.includes("-pooler."))
  throw new Error("Migrations require a direct connection");
const pool = databasePool(process.env.DATABASE_URL);
try {
  await migrateStreams(pool);
  await checkStreamSchema(pool);
  console.log("Persistent broadcast schema ready");
} finally {
  await pool.end();
}
