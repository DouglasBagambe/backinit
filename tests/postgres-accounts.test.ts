import { beforeAll, afterAll, describe, it, expect, vi } from "vitest";
import { randomUUID } from "node:crypto";
import type { DatabasePool } from "../apps/api/src/postgres";
import {
  databasePool,
  migrateAccounts,
  checkAccountSchema,
} from "../apps/api/src/postgres";
import { PostgresAccounts } from "../apps/api/src/postgres-accounts";
import { PostgresNotifications } from "../apps/api/src/postgres-notifications";
import { events, type SportEvent } from "../packages/domain/src/index";

vi.setConfig({ testTimeout: 45000, hookTimeout: 30000 });

describe.skipIf(!process.env.POSTGRES_TEST_URL)(
  "real PostgreSQL account storage",
  () => {
    let pool: DatabasePool, accounts: PostgresAccounts;
    const ids: string[] = [];
    const credentials = () => ({
      email: `qa-${randomUUID()}@example.test`,
      password: "correct-horse-battery-staple",
    });
    async function register() {
      const input = credentials(),
        session = await accounts.authenticate(input, true);
      ids.push(session.user.id);
      return { input, ...session };
    }
    beforeAll(async () => {
      pool = databasePool(process.env.POSTGRES_TEST_URL!);
      await migrateAccounts(pool);
      await migrateAccounts(pool);
      await checkAccountSchema(pool);
      accounts = new PostgresAccounts(pool);
    }, 30000);
    afterAll(async () => {
      if (!pool) return;
      // Only this suite's randomly generated fixture accounts; never blanket-reset a database.
      for (const id of ids) {
        await pool.query(
          "UPDATE audit SET user_id='test-fixture',target='test-fixture' WHERE user_id=$1",
          [id],
        );
        await pool.query("DELETE FROM users WHERE id=$1", [id]);
      }
      await pool.end();
    });
    it("stores hashes, persists favorites across a fresh connection, isolates users and revokes sessions", async () => {
      const a = await register(),
        b = await register();
      const stored = (
        await pool.query("SELECT password FROM users WHERE id=$1", [a.user.id])
      ).rows[0].password;
      expect(stored).toMatch(/^scrypt\$v1\$/);
      expect(stored).not.toContain(a.input.password);
      expect(
        (
          await pool.query("SELECT token_hash FROM sessions WHERE user_id=$1", [
            a.user.id,
          ])
        ).rows[0].token_hash,
      ).not.toBe(a.token);
      await accounts.favorite(
        a.user,
        { kind: "team", target: "Arsenal" },
        false,
      );
      expect(await accounts.list(b.user)).toEqual([]);
      const restartedPool = databasePool(process.env.POSTGRES_TEST_URL!);
      try {
        const restarted = new PostgresAccounts(restartedPool);
        expect(await restarted.user(`Bearer ${a.token}`)).toEqual(a.user);
        expect(await restarted.list(a.user)).toEqual([
          { kind: "team", target: "Arsenal" },
        ]);
        await restarted.logout(`Bearer ${a.token}`);
      } finally {
        await restartedPool.end();
      }
      await expect(accounts.user(`Bearer ${a.token}`)).rejects.toThrow(
        "expired",
      );
      await expect(
        accounts.authenticate({ ...a.input, role: "admin" }, true),
      ).rejects.toThrow("valid email");
    });
    it("consumes a recovery code exactly once under concurrent recovery and revokes all sessions", async () => {
      const a = await register();
      const { codes } = await accounts.recoveryCodes(a.user, {
        password: a.input.password,
      });
      const replacement = {
        email: a.input.email,
        code: codes[0],
        password: "new-secure-password-recovery",
      };
      const results = await Promise.allSettled([
        accounts.recover(replacement),
        accounts.recover(replacement),
      ]);
      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      await expect(accounts.user(`Bearer ${a.token}`)).rejects.toThrow(
        "expired",
      );
      await expect(accounts.authenticate(a.input, false)).rejects.toThrow(
        "incorrect",
      );
      expect(
        await accounts.authenticate(replacement, false).catch(() => null),
      ).toBeNull(); // strict login rejects recovery-only fields
      expect(
        (
          await accounts.authenticate(
            { email: a.input.email, password: replacement.password },
            false,
          )
        ).user.id,
      ).toBe(a.user.id);
    });
    it("handles duplicate signup atomically and persists failed-login limits", async () => {
      const input = credentials();
      const results = await Promise.allSettled([
        accounts.authenticate(input, true),
        accounts.authenticate(input, true),
      ]);
      const successful = results.flatMap((r) =>
        r.status === "fulfilled" ? [r.value] : [],
      );
      expect(successful).toHaveLength(1);
      ids.push(successful[0]!.user.id);
      expect(successful[0]!.user.role).toBe("user");
      const a = await register();
      for (let i = 0; i < 8; i++)
        await expect(
          accounts.authenticate(
            { ...a.input, password: "incorrect-password" },
            false,
          ),
        ).rejects.toThrow("incorrect");
      const other = new PostgresAccounts(pool);
      await expect(other.authenticate(a.input, false)).rejects.toThrow(
        "Too many attempts",
      );
    });
    it("serializes the favorite cap across concurrent writes", async () => {
      const a = await register();
      await pool.query(
        "INSERT INTO favorites SELECT $1,'team','fixture-' || n FROM generate_series(1,499) AS n",
        [a.user.id],
      );
      const results = await Promise.allSettled([
        accounts.favorite(a.user, { kind: "team", target: "one" }, false),
        accounts.favorite(a.user, { kind: "team", target: "two" }, false),
      ]);
      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      expect(await accounts.list(a.user)).toHaveLength(500);
    });
    it("delivers only changed followed provider data, honors opt-out and cascades account deletion", async () => {
      const a = await register(),
        alerts = new PostgresNotifications(accounts);
      await accounts.favorite(
        a.user,
        { kind: "sport", target: "Football" },
        false,
      );
      await alerts.preferences(a.user, { enabled: true });
      const original = events.find((e) => e.kind === "score")!;
      const fixture: SportEvent = {
        ...original,
        provenance: "provider",
        source: {
          provider: "Test fixture",
          url: "https://example.test/fixture",
          license: "Test only",
          fetchedAt: new Date(Date.now() + 100).toISOString(),
          stale: false,
        },
      };
      await alerts.ingest(a.user, [fixture]);
      expect(
        (
          await pool.query("SELECT id FROM notifications WHERE user_id=$1", [
            a.user.id,
          ])
        ).rows,
      ).toEqual([]);
      const changed: SportEvent = { ...fixture, status: "finished" };
      await alerts.ingest(a.user, [changed]);
      await alerts.ingest(a.user, [changed]);
      expect(
        (
          await pool.query("SELECT id FROM notifications WHERE user_id=$1", [
            a.user.id,
          ])
        ).rows,
      ).toHaveLength(1);
      await alerts.preferences(a.user, { enabled: false });
      const data = await accounts.export(a.user);
      expect(data.favorites).toHaveLength(1);
      expect(data.notifications).toHaveLength(1);
      expect(JSON.stringify(data)).not.toMatch(/scrypt\$|token_hash|code_hash/);
      await accounts.removeAccount(a.user, {
        password: a.input.password,
        confirmation: "DELETE",
      });
      await expect(accounts.user(`Bearer ${a.token}`)).rejects.toThrow();
      expect(
        (
          await pool.query("SELECT id FROM notifications WHERE user_id=$1", [
            a.user.id,
          ])
        ).rowCount,
      ).toBe(0);
      expect(
        (
          await pool.query("SELECT id FROM observed_events WHERE user_id=$1", [
            a.user.id,
          ])
        ).rowCount,
      ).toBe(0);
    });
  },
);
