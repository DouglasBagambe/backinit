import { createHash } from "node:crypto";
import { BadRequestException, Logger } from "@nestjs/common";
import { z } from "zod";
import {
  eventTitle,
  type SportEvent,
} from "../../../packages/domain/src/index.js";
import type { User } from "./account-types.js";
import type { PostgresAccounts } from "./postgres-accounts.js";
import { transaction } from "./postgres.js";
import { service } from "./providers/service.js";

/** Updates are refreshed while a signed-in user opens their inbox; no idle database polling. */
export class PostgresNotifications {
  private running = new Set<string>();
  constructor(private readonly accounts: PostgresAccounts) {}
  async list(user: User) {
    const db = this.accounts.pool;
    const enabled = Boolean(
      (
        await db.query(
          "SELECT enabled FROM notification_preferences WHERE user_id=$1",
          [user.id],
        )
      ).rows[0]?.enabled,
    );
    if (enabled && !this.running.has(user.id)) {
      this.running.add(user.id);
      void this.refresh(user)
        .catch(() =>
          Logger.warn(
            "Match updates temporarily unavailable",
            "AccountUpdates",
          ),
        )
        .finally(() => this.running.delete(user.id));
    }
    return {
      enabled,
      data: (
        await db.query(
          'SELECT id,event_id AS "eventId",title,message,provider,source_url AS "sourceUrl",reported_at AS "reportedAt",created_at AS "createdAt",read FROM notifications WHERE user_id=$1 ORDER BY id DESC LIMIT 100',
          [user.id],
        )
      ).rows,
    };
  }
  async preferences(user: User, input: unknown) {
    const body = z.object({ enabled: z.boolean() }).strict().safeParse(input);
    if (!body.success)
      throw new BadRequestException("Invalid notification preference.");
    await transaction(this.accounts.pool, async (db) => {
      await db.query("SELECT id FROM users WHERE id=$1 FOR UPDATE", [user.id]);
      const old = (
        await db.query(
          "SELECT enabled FROM notification_preferences WHERE user_id=$1",
          [user.id],
        )
      ).rows[0];
      await db.query(
        "INSERT INTO notification_preferences VALUES ($1,$2,$3) ON CONFLICT(user_id) DO UPDATE SET enabled=excluded.enabled,changed_at=excluded.changed_at",
        [user.id, Number(body.data.enabled), Date.now()],
      );
      if (body.data.enabled && !old?.enabled)
        await db.query("DELETE FROM observed_events WHERE user_id=$1", [
          user.id,
        ]);
    });
    return { enabled: body.data.enabled };
  }
  async read(user: User, input: unknown) {
    const body = z
      .object({ id: z.number().int().positive().optional() })
      .strict()
      .safeParse(input);
    if (!body.success) throw new BadRequestException("Invalid notification.");
    if (body.data.id)
      await this.accounts.pool.query(
        "UPDATE notifications SET read=1 WHERE user_id=$1 AND id=$2",
        [user.id, body.data.id],
      );
    else
      await this.accounts.pool.query(
        "UPDATE notifications SET read=1 WHERE user_id=$1",
        [user.id],
      );
    return { ok: true };
  }
  private async refresh(user: User) {
    const feed = await service.feed("real");
    await this.ingest(user, feed.data);
  }
  async ingest(user: User, events: SportEvent[]) {
    await transaction(this.accounts.pool, async (db) => {
      const owner = await db.query(
        "SELECT id FROM users WHERE id=$1 FOR UPDATE",
        [user.id],
      );
      if (!owner.rowCount) return;
      const prefs = (
        await db.query(
          "SELECT enabled,changed_at FROM notification_preferences WHERE user_id=$1",
          [user.id],
        )
      ).rows[0];
      if (!prefs?.enabled) return;
      const follows = new Set(
        (
          await db.query("SELECT kind,target FROM favorites WHERE user_id=$1", [
            user.id,
          ])
        ).rows.map((r) => `${r.kind}:${r.target}`),
      );
      if (!follows.size) return;
      const selected = events.filter((e) => {
        if (e.provenance !== "provider" || !e.source || e.source.stale)
          return false;
        const keys = [
          `event:${e.id}`,
          `sport:${e.sport}`,
          `competition:${e.competition}`,
        ];
        if (e.kind === "score") keys.push(`team:${e.home}`, `team:${e.away}`);
        for (const g of e.detail?.goals || [])
          if (g.player) keys.push(`athlete:${g.player}`);
        for (const c of e.detail?.classification || [])
          keys.push(`athlete:${c.driver}`, `team:${c.team}`);
        return keys.some((k) => follows.has(k));
      });
      const before = new Map(
        (
          await db.query(
            "SELECT id,revision,start FROM observed_events WHERE user_id=$1",
            [user.id],
          )
        ).rows.map((r) => [r.id, r]),
      );
      const observations: Array<{
        id: string;
        revision: string;
        start: string;
      }> = [];
      const updates = [];
      for (const event of selected) {
        const state = {
          start: event.start,
          status: event.status,
          score:
            event.kind === "score" ? [event.homeScore, event.awayScore] : null,
          goals: event.detail?.goals,
          classification: event.detail?.classification,
        };
        const revision = createHash("sha256")
          .update(JSON.stringify(state))
          .digest("hex");
        observations.push({ id: event.id, revision, start: event.start });
        const old = before.get(event.id);
        if (
          !old ||
          old.revision === revision ||
          Date.parse(event.source!.fetchedAt) < Number(prefs.changed_at)
        )
          continue;
        const score =
          event.kind === "score"
            ? `${event.homeScore ?? "–"}–${event.awayScore ?? "–"}`
            : event.status;
        updates.push({
          event_id: event.id,
          revision,
          title: eventTitle(event),
          message:
            old.start !== event.start
              ? `Schedule updated: ${event.start}`
              : `Provider update: ${score}. ${event.status === "finished" ? "Result reported." : "Snapshot may be delayed."}`,
          provider: event.source!.provider,
          source_url: event.source!.url,
          reported_at: event.source!.fetchedAt,
          created_at: new Date().toISOString(),
        });
      }
      if (observations.length)
        await db.query(
          `INSERT INTO observed_events(user_id,id,revision,start) SELECT $1,x.id,x.revision,x.start FROM jsonb_to_recordset($2::jsonb) AS x(id text,revision text,start text) ON CONFLICT(user_id,id) DO UPDATE SET revision=excluded.revision,start=excluded.start`,
          [user.id, JSON.stringify(observations)],
        );
      if (updates.length)
        await db.query(
          `INSERT INTO notifications(user_id,event_id,revision,title,message,provider,source_url,reported_at,created_at) SELECT $1,x.event_id,x.revision,x.title,x.message,x.provider,x.source_url,x.reported_at,x.created_at FROM jsonb_to_recordset($2::jsonb) AS x(event_id text,revision text,title text,message text,provider text,source_url text,reported_at text,created_at text) ON CONFLICT DO NOTHING`,
          [user.id, JSON.stringify(updates)],
        );
      await db.query(
        "DELETE FROM notifications WHERE user_id=$1 AND (created_at<$2 OR id NOT IN (SELECT id FROM notifications WHERE user_id=$1 ORDER BY id DESC LIMIT 100))",
        [user.id, new Date(Date.now() - 30 * 86400000).toISOString()],
      );
      await db.query(
        "DELETE FROM observed_events WHERE user_id=$1 AND start<$2",
        [user.id, new Date(Date.now() - 30 * 86400000).toISOString()],
      );
    });
  }
}
