import { Pool, type QueryResultRow } from "pg";
import { Pool as NeonPool, neonConfig } from "@neondatabase/serverless";
import WebSocket from "ws";
// Allow a real round trip before Node races another address on high-latency links.
class DatabaseWebSocket extends WebSocket {
  constructor(address: string, protocols?: string | string[]) {
    const options = {
      handshakeTimeout: 10000,
      autoSelectFamilyAttemptTimeout: 2000,
    };
    super(address, protocols, options);
  }
}
neonConfig.webSocketConstructor = DatabaseWebSocket;
interface DatabaseQuery {
  query<R extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: unknown[],
  ): Promise<{ rows: R[]; rowCount: number | null }>;
}
export interface DatabaseClient extends DatabaseQuery {
  release(): void;
}
export interface DatabasePool extends DatabaseQuery {
  connect(): Promise<DatabaseClient>;
  end(): Promise<void>;
  on(event: "error", listener: () => void): unknown;
}

/** Small bounded pool; secrets and database error details never enter responses. */
export function databasePool(connectionString: string): DatabasePool {
  const url = new URL(connectionString);
  if (!["postgres:", "postgresql:"].includes(url.protocol))
    throw new Error("DATABASE_URL must be a PostgreSQL connection string");
  const local = ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname);
  // URL SSL options override pg's explicit TLS configuration; enforce certificate validation.
  for (const key of ["sslmode", "sslcert", "sslkey", "sslrootcert"])
    url.searchParams.delete(key);
  const neon = url.hostname.endsWith(".neon.tech");
  const PoolDriver = neon ? NeonPool : Pool;
  const pool: DatabasePool = new PoolDriver({
    connectionString: url.href,
    ...(neon ? {} : { ssl: local ? false : { rejectUnauthorized: true } }),
    max: 4,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 10000,
    statement_timeout: 5000,
    query_timeout: 8000,
  });
  pool.on("error", () =>
    console.warn("Account database connection interrupted."),
  );
  return pool;
}

export async function transaction<T>(
  pool: DatabasePool,
  action: (db: DatabaseClient) => Promise<T>,
) {
  const db = await pool.connect();
  try {
    await db.query("BEGIN");
    const result = await action(db);
    await db.query("COMMIT");
    return result;
  } catch (error) {
    await db.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    db.release();
  }
}

/** Versioned, additive migration. Run explicitly with the owner role before rollout. */
export async function migrateAccounts(pool: DatabasePool) {
  await transaction(pool, async (db) => {
    await db.query("SELECT pg_advisory_xact_lock(74219001)");
    await db.query(
      `CREATE TABLE IF NOT EXISTS backinit_schema (version INTEGER PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())`,
    );
    const current = await db.query(
      "SELECT version FROM backinit_schema WHERE version=1",
    );
    if (current.rowCount) return;
    await db.query(`
      CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, password TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('user','admin')));
      CREATE TABLE sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires BIGINT NOT NULL);
      CREATE INDEX sessions_expiry ON sessions(expires);
      CREATE INDEX sessions_user ON sessions(user_id);
      CREATE TABLE favorites (user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, kind TEXT NOT NULL CHECK(kind IN ('event','team','athlete','competition','sport')), target TEXT NOT NULL, PRIMARY KEY(user_id,kind,target));
      CREATE TABLE recovery_codes (user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, code_hash TEXT NOT NULL, PRIMARY KEY(user_id,code_hash));
      CREATE TABLE auth_limits (key TEXT PRIMARY KEY, attempts INTEGER NOT NULL, expires BIGINT NOT NULL);
      CREATE INDEX auth_limits_expiry ON auth_limits(expires);
      CREATE TABLE audit (id BIGSERIAL PRIMARY KEY, user_id TEXT NOT NULL, action TEXT NOT NULL, target TEXT NOT NULL, at TEXT NOT NULL);
      CREATE INDEX audit_user ON audit(user_id);
      CREATE TABLE notification_preferences (user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, enabled INTEGER NOT NULL CHECK(enabled IN (0,1)), changed_at BIGINT NOT NULL);
      CREATE TABLE observed_events (user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, id TEXT NOT NULL, revision TEXT NOT NULL, start TEXT NOT NULL, PRIMARY KEY(user_id,id));
      CREATE TABLE notifications (id SERIAL PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, event_id TEXT NOT NULL, revision TEXT NOT NULL, title TEXT NOT NULL, message TEXT NOT NULL, provider TEXT NOT NULL, source_url TEXT NOT NULL, reported_at TEXT NOT NULL, created_at TEXT NOT NULL, read INTEGER NOT NULL DEFAULT 0 CHECK(read IN (0,1)), UNIQUE(user_id,event_id,revision));
      CREATE INDEX notifications_user ON notifications(user_id,id DESC);
      INSERT INTO backinit_schema(version) VALUES (1);
    `);
  });
}

export async function checkAccountSchema(pool: DatabasePool) {
  const r = await pool.query(
    "SELECT version FROM backinit_schema ORDER BY version DESC LIMIT 1",
  );
  if (r.rows[0]?.version !== 1)
    throw new Error("Account schema migration required");
}
