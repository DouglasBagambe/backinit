import { createHash } from "node:crypto";
import { BadRequestException } from "@nestjs/common";
import { z } from "zod";
import {
  eventTitle,
  type SportEvent,
} from "../../../packages/domain/src/index.js";
import type { Accounts, User } from "./accounts.js";
export class Notifications {
  constructor(private readonly accounts: Accounts) {
    accounts.db.exec(`
      CREATE TABLE IF NOT EXISTS notification_preferences (user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, enabled INTEGER NOT NULL, changed_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS observed_events (id TEXT PRIMARY KEY, revision TEXT NOT NULL, start TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS notifications (id INTEGER PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, event_id TEXT NOT NULL, revision TEXT NOT NULL, title TEXT NOT NULL, message TEXT NOT NULL, provider TEXT NOT NULL, source_url TEXT NOT NULL, reported_at TEXT NOT NULL, created_at TEXT NOT NULL, read INTEGER NOT NULL DEFAULT 0, UNIQUE(user_id,event_id,revision));
      CREATE INDEX IF NOT EXISTS notifications_user ON notifications(user_id,id DESC);
    `);
  }
  list(user: User) {
    return {
      enabled: Boolean(
        this.accounts.db
          .prepare(
            "SELECT enabled FROM notification_preferences WHERE user_id=?",
          )
          .get(user.id)?.enabled,
      ),
      data: this.accounts.db
        .prepare(
          "SELECT id,event_id AS eventId,title,message,provider,source_url AS sourceUrl,reported_at AS reportedAt,created_at AS createdAt,read FROM notifications WHERE user_id=? ORDER BY id DESC LIMIT 100",
        )
        .all(user.id),
    };
  }
  preferences(user: User, input: unknown) {
    const body = z.object({ enabled: z.boolean() }).strict().safeParse(input);
    if (!body.success)
      throw new BadRequestException("Invalid notification preference.");
    this.accounts.db
      .prepare(
        "INSERT INTO notification_preferences VALUES (?,?,?) ON CONFLICT(user_id) DO UPDATE SET enabled=excluded.enabled,changed_at=excluded.changed_at",
      )
      .run(user.id, Number(body.data.enabled), Date.now());
    return { enabled: body.data.enabled };
  }
  read(user: User, input: unknown) {
    const body = z
      .object({ id: z.number().int().positive().optional() })
      .strict()
      .safeParse(input);
    if (!body.success) throw new BadRequestException("Invalid notification.");
    if (body.data.id)
      this.accounts.db
        .prepare("UPDATE notifications SET read=1 WHERE user_id=? AND id=?")
        .run(user.id, body.data.id);
    else
      this.accounts.db
        .prepare("UPDATE notifications SET read=1 WHERE user_id=?")
        .run(user.id);
    return { ok: true };
  }
  ingest(events: SportEvent[]) {
    const db = this.accounts.db;
    const follows = db
      .prepare(
        "SELECT favorites.user_id,kind,target,changed_at FROM favorites JOIN notification_preferences ON favorites.user_id=notification_preferences.user_id WHERE enabled=1",
      )
      .all() as Array<{
      user_id: string;
      kind: string;
      target: string;
      changed_at: number;
    }>;
    const subscriptions = new Map<string, typeof follows>();
    for (const follow of follows) {
      const key = `${follow.kind}:${follow.target}`;
      subscriptions.set(key, [...(subscriptions.get(key) || []), follow]);
    }
    db.exec("BEGIN IMMEDIATE");
    try {
      for (const event of events) {
        if (
          event.provenance !== "provider" ||
          !event.source ||
          event.source.stale
        )
          continue;
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
        const old = db
          .prepare("SELECT revision,start FROM observed_events WHERE id=?")
          .get(event.id) as { revision: string; start: string } | undefined;
        db.prepare(
          "INSERT INTO observed_events VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET revision=excluded.revision,start=excluded.start",
        ).run(event.id, revision, event.start);
        if (!old || old.revision === revision) continue; // First observation establishes a baseline, never historical alerts.
        const keys = [
          `event:${event.id}`,
          `sport:${event.sport}`,
          `competition:${event.competition}`,
        ];
        if (event.kind === "score")
          keys.push(`team:${event.home}`, `team:${event.away}`);
        for (const goal of event.detail?.goals || [])
          if (goal.player) keys.push(`athlete:${goal.player}`);
        for (const result of event.detail?.classification || [])
          keys.push(`athlete:${result.driver}`, `team:${result.team}`);
        const users = new Map<string, number>();
        for (const key of keys)
          for (const follow of subscriptions.get(key) || [])
            users.set(follow.user_id, follow.changed_at);
        const score =
          event.kind === "score"
            ? `${event.homeScore ?? "–"}–${event.awayScore ?? "–"}`
            : event.status;
        const message =
          old.start !== event.start
            ? `Schedule updated: ${event.start}`
            : `Provider update: ${score}. ${event.status === "finished" ? "Result reported." : "Snapshot may be delayed."}`;
        for (const [user, since] of users) {
          if (Date.parse(event.source.fetchedAt) < since) continue;
          db.prepare(
            "INSERT OR IGNORE INTO notifications(user_id,event_id,revision,title,message,provider,source_url,reported_at,created_at) VALUES (?,?,?,?,?,?,?,?,?)",
          ).run(
            user,
            event.id,
            revision,
            eventTitle(event),
            message,
            event.source.provider,
            event.source.url,
            event.source.fetchedAt,
            new Date().toISOString(),
          );
        }
      }
      db.prepare("DELETE FROM notifications WHERE created_at < ?").run(
        new Date(Date.now() - 30 * 86400000).toISOString(),
      );
      for (const user of new Set(follows.map((f) => f.user_id)))
        db.prepare(
          "DELETE FROM notifications WHERE user_id=? AND id NOT IN (SELECT id FROM notifications WHERE user_id=? ORDER BY id DESC LIMIT 100)",
        ).run(user, user);
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }
}
