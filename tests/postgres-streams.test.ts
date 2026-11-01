import { beforeAll, afterAll, describe, it, expect, vi } from "vitest";
import { randomUUID } from "node:crypto";
import {
  databasePool,
  migrateAccounts,
  type DatabasePool,
} from "../apps/api/src/postgres";
import {
  PostgresStreams,
  migrateStreams,
  checkStreamSchema,
} from "../apps/api/src/postgres-streams";
import { PostgresAccounts } from "../apps/api/src/postgres-accounts";
import { events, testSources } from "../packages/domain/src/index";
vi.setConfig({ testTimeout: 45000, hookTimeout: 30000 });
describe.skipIf(!process.env.POSTGRES_TEST_URL)(
  "durable PostgreSQL broadcast registry",
  () => {
    let pool: DatabasePool,
      registry: PostgresStreams,
      accounts: PostgresAccounts;
    const ids: string[] = [];
    const operator = {
      id: `operator-${randomUUID()}`,
      email: "operator@example.test",
      role: "admin" as const,
    };
    const fixture = {
      ...events.find((e) => e.kind === "score")!,
      provenance: "provider" as const,
      status: "live" as const,
    };
    const source = () => {
      const id = `qa-${randomUUID()}`;
      ids.push(id);
      return {
        ...testSources[0]!,
        type: "embed" as const,
        url: "https://www.youtube-nocookie.com/embed/6I06-ITW88k",
        id,
        content: "sports" as const,
        eventId: fixture.id,
        territory: "PROVIDER" as const,
        revoked: true,
        validFrom: new Date(Date.now() - 60000).toISOString(),
        validUntil: new Date(Date.now() + 3600000).toISOString(),
      };
    };
    beforeAll(async () => {
      pool = databasePool(process.env.POSTGRES_TEST_URL!);
      await migrateAccounts(pool);
      await migrateStreams(pool);
      await migrateStreams(pool);
      await checkStreamSchema(pool);
      registry = new PostgresStreams(pool);
      accounts = new PostgresAccounts(pool);
    });
    afterAll(async () => {
      if (!pool) return;
      for (const id of ids) {
        await pool.query("DELETE FROM broadcast_sources WHERE id=$1", [id]);
        await pool.query("DELETE FROM audit WHERE target=$1 AND user_id=$2", [
          id,
          operator.id,
        ]);
      }
      await pool.end();
    });
    it("requires real playback before publication, persists across connections, and expires checks", async () => {
      const input = source();
      expect(input.type).toBe("embed");
      const disabled = await registry.save(operator, input);
      expect(await registry.forEvent(fixture)).toEqual([]);
      await expect(
        registry.save(operator, { ...disabled, revoked: false }),
      ).rejects.toThrow("verify playback");
      await expect(
        registry.recordCheck(operator, {
          id: disabled.id,
          version: 1,
          result: "passed",
          method: "provider-player",
          currentTime: 0,
          width: 1280,
          height: 720,
          live: true,
          browser: "integration-test",
        }),
      ).rejects.toThrow("Advancing");
      const report = await registry.recordCheck(operator, {
        id: disabled.id,
        version: 1,
        result: "passed",
        method: "provider-player",
        currentTime: 3,
        width: 1280,
        height: 720,
        live: true,
        browser: "integration-test",
      });
      const enabled = await registry.save(operator, {
        ...disabled,
        revoked: false,
      });
      expect(enabled.version).toBe(2);
      const restartedPool = databasePool(process.env.POSTGRES_TEST_URL!);
      try {
        expect(
          (await new PostgresStreams(restartedPool).forEvent(fixture)).some(
            (s) => s.id === input.id,
          ),
        ).toBe(true);
      } finally {
        await restartedPool.end();
      }
      await pool.query(
        "UPDATE broadcast_checks SET body=$1 WHERE source_id=$2",
        [
          JSON.stringify({
            ...report,
            checkedAt: new Date(Date.now() - 86400001).toISOString(),
          }),
          input.id,
        ],
      );
      expect(
        (await registry.forEvent(fixture)).some((s) => s.id === input.id),
      ).toBe(false);
    });
    it("serializes competing edits and rejects a report for an old version", async () => {
      const initial = await registry.save(operator, source());
      const updates = await Promise.allSettled([
        registry.save(operator, initial),
        registry.save(operator, initial),
      ]);
      expect(updates.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      await expect(
        registry.recordCheck(operator, {
          id: initial.id,
          version: 1,
          result: "passed",
          method: "provider-player",
          currentTime: 3,
          width: 1280,
          height: 720,
          live: true,
          browser: "integration-test",
        }),
      ).rejects.toThrow("Source changed");
      expect(
        (await registry.auditLog()).filter((r) => r.target === initial.id),
      ).toHaveLength(2);
    });
    it("blocks anonymous and ordinary accounts from hosted administration", async () => {
      await expect(accounts.admin()).rejects.toThrow("Sign in");
      const session = await accounts.authenticate(
        { email: `qa-${randomUUID()}@example.test`, password: "Eight!42" },
        true,
      );
      try {
        await expect(accounts.admin(`Bearer ${session.token}`)).rejects.toThrow(
          "Administrator",
        );
        await pool.query("UPDATE users SET role='admin' WHERE id=$1", [
          session.user.id,
        ]);
        expect((await accounts.admin(`Bearer ${session.token}`)).id).toBe(
          session.user.id,
        );
      } finally {
        await pool.query("DELETE FROM users WHERE id=$1", [session.user.id]);
      }
    });
  },
);
