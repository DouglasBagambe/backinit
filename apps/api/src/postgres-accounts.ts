import { randomBytes, randomUUID, createHash } from "node:crypto";
import type { DatabasePool, DatabaseClient } from "./postgres.js";
import { z } from "zod";
import {
  BadRequestException,
  UnauthorizedException,
  ConflictException,
  HttpException,
} from "@nestjs/common";
import {
  credentialsSchema,
  favoriteSchema,
  type User,
  type Favorite,
} from "./account-types.js";
import { passwordHash, passwordMatches } from "./passwords.js";
import { transaction } from "./postgres.js";

const digest = (s: string) => createHash("sha256").update(s).digest("hex");
type StoredUser = User & { password: string };
const publicUser = ({ id, email, role }: User): User => ({ id, email, role });

/** Durable hosted account store. Row locks serialize credential changes and session issuance. */
export class PostgresAccounts {
  constructor(readonly pool: DatabasePool) {}
  private async attempt(action: string, identity: string) {
    const key = digest(`${action}:${identity}`),
      now = Date.now();
    await this.pool.query("DELETE FROM auth_limits WHERE expires < $1", [now]);
    const r = await this.pool.query<{ attempts: number }>(
      `INSERT INTO auth_limits VALUES ($1,1,$2) ON CONFLICT(key) DO UPDATE SET attempts=auth_limits.attempts+1 RETURNING attempts`,
      [key, now + 15 * 60000],
    );
    if (r.rows[0]!.attempts > 8)
      throw new HttpException("Too many attempts. Retry in 15 minutes.", 429);
    return key;
  }
  private async locked(db: DatabaseClient, id: string, hash?: string) {
    const r = await db.query<StoredUser>(
      "SELECT * FROM users WHERE id=$1 FOR UPDATE",
      [id],
    );
    const row = r.rows[0];
    if (!row || (hash !== undefined && row.password !== hash))
      throw new UnauthorizedException("Account changed. Sign in again.");
    return row;
  }
  private async audit(db: DatabaseClient, user: User, action: string) {
    await db.query(
      "INSERT INTO audit(user_id,action,target,at) VALUES ($1,$2,$1,$3)",
      [user.id, action, new Date().toISOString()],
    );
  }
  async authenticate(input: unknown, register: boolean) {
    const body = credentialsSchema.safeParse(input);
    if (!body.success)
      throw new BadRequestException(
        "Use a valid email and a password of 12–128 characters.",
      );
    const { email, password } = body.data;
    const key = await this.attempt(register ? "register" : "login", email);
    const previous = (
      await this.pool.query<StoredUser>("SELECT * FROM users WHERE email=$1", [
        email,
      ])
    ).rows[0];
    // Hash outside transactions; even nonexistent identities do bounded password work.
    const hash = register ? await passwordHash(password) : undefined;
    if (!register && !(await passwordMatches(password, previous?.password)))
      throw new UnauthorizedException("Email or password is incorrect.");
    if (register && previous)
      throw new ConflictException("Unable to create account. Try signing in.");
    const upgrade =
      !register && previous && !previous.password.startsWith("scrypt$v1$")
        ? await passwordHash(password)
        : null;
    try {
      return await transaction(this.pool, async (db) => {
        let row: User;
        if (register) {
          row = { id: randomUUID(), email, role: "user" };
          await db.query(
            "INSERT INTO users(id,email,password) VALUES ($1,$2,$3)",
            [row.id, email, hash],
          );
        } else {
          if (!previous)
            throw new UnauthorizedException("Email or password is incorrect.");
          row = publicUser(
            await this.locked(db, previous.id, previous.password),
          );
          if (upgrade)
            await db.query("UPDATE users SET password=$1 WHERE id=$2", [
              upgrade,
              row.id,
            ]);
        }
        const token = randomBytes(32).toString("hex"),
          expiresIn = row.role === "admin" ? 900 : 7 * 86400;
        await db.query("DELETE FROM sessions WHERE expires<$1", [Date.now()]);
        await db.query("INSERT INTO sessions VALUES ($1,$2,$3)", [
          digest(token),
          row.id,
          Date.now() + expiresIn * 1000,
        ]);
        await db.query("DELETE FROM auth_limits WHERE key=$1", [key]);
        return { user: row, token, expiresIn };
      });
    } catch (error) {
      if (register && (error as { code?: string }).code === "23505")
        throw new ConflictException(
          "Unable to create account. Try signing in.",
        );
      throw error;
    }
  }
  async user(authorization?: string): Promise<User> {
    const token = authorization?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
    if (!token) throw new UnauthorizedException("Sign in to continue.");
    const row = (
      await this.pool.query<User>(
        "SELECT users.id,email,role FROM users JOIN sessions ON users.id=sessions.user_id WHERE token_hash=$1 AND expires>$2",
        [digest(token), Date.now()],
      )
    ).rows[0];
    if (!row)
      throw new UnauthorizedException("Session expired. Please sign in again.");
    return row;
  }
  async logout(authorization?: string) {
    const token = authorization?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
    if (token)
      await this.pool.query("DELETE FROM sessions WHERE token_hash=$1", [
        digest(token),
      ]);
    return { ok: true };
  }
  async logoutAll(user: User) {
    await transaction(this.pool, async (db) => {
      await this.locked(db, user.id);
      await db.query("DELETE FROM sessions WHERE user_id=$1", [user.id]);
    });
    return { ok: true };
  }
  private async confirm(user: User, password: string) {
    await this.attempt("reauth", user.id);
    const row = (
      await this.pool.query<{ password: string }>(
        "SELECT password FROM users WHERE id=$1",
        [user.id],
      )
    ).rows[0];
    if (!(await passwordMatches(password, row?.password)) || !row)
      throw new UnauthorizedException("Password is incorrect.");
    return row.password;
  }
  async recoveryCodes(user: User, input: unknown) {
    const body = z
      .object({ password: z.string().min(1).max(128) })
      .strict()
      .safeParse(input);
    if (!body.success)
      throw new BadRequestException("Enter your current password.");
    const previous = await this.confirm(user, body.data.password);
    const codes = Array.from({ length: 5 }, () =>
      randomBytes(16).toString("base64url"),
    );
    await transaction(this.pool, async (db) => {
      await this.locked(db, user.id, previous);
      await db.query("DELETE FROM recovery_codes WHERE user_id=$1", [user.id]);
      for (const code of codes)
        await db.query("INSERT INTO recovery_codes VALUES ($1,$2)", [
          user.id,
          digest(code),
        ]);
      await this.audit(db, user, "account.recovery-codes.rotate");
    });
    return { codes };
  }
  async recover(input: unknown) {
    const body = credentialsSchema
      .extend({ code: z.string().regex(/^[A-Za-z0-9_-]{22}$/) })
      .strict()
      .safeParse(input);
    if (!body.success)
      throw new BadRequestException(
        "Enter your email, recovery code and a new password of 12–128 characters.",
      );
    const { email, password, code } = body.data;
    await this.attempt("recover", email);
    const hash = await passwordHash(password);
    await transaction(this.pool, async (db) => {
      const user = (
        await db.query<User>(
          "SELECT id,email,role FROM users WHERE email=$1 FOR UPDATE",
          [email],
        )
      ).rows[0];
      if (!user)
        throw new UnauthorizedException("Email or recovery code is incorrect.");
      const consumed = await db.query(
        "DELETE FROM recovery_codes WHERE user_id=$1 AND code_hash=$2 RETURNING code_hash",
        [user.id, digest(code)],
      );
      if (consumed.rowCount !== 1)
        throw new UnauthorizedException("Email or recovery code is incorrect.");
      await db.query("UPDATE users SET password=$1 WHERE id=$2", [
        hash,
        user.id,
      ]);
      await db.query("DELETE FROM sessions WHERE user_id=$1", [user.id]);
      await this.audit(db, user, "account.password.recover");
    });
    return { ok: true };
  }
  async changePassword(user: User, input: unknown) {
    const body = z
      .object({
        currentPassword: z.string().min(1).max(128),
        password: z.string().min(12).max(128),
      })
      .strict()
      .safeParse(input);
    if (!body.success)
      throw new BadRequestException(
        "Enter your current password and a new password of 12–128 characters.",
      );
    const previous = await this.confirm(user, body.data.currentPassword),
      hash = await passwordHash(body.data.password);
    await transaction(this.pool, async (db) => {
      await this.locked(db, user.id, previous);
      await db.query("UPDATE users SET password=$1 WHERE id=$2", [
        hash,
        user.id,
      ]);
      await db.query("DELETE FROM sessions WHERE user_id=$1", [user.id]);
      await this.audit(db, user, "account.password.change");
    });
    return { ok: true };
  }
  async list(user: User) {
    return (
      await this.pool.query<{
        kind: "event" | "team" | "athlete" | "competition" | "sport";
        target: string;
      }>(
        "SELECT kind,target FROM favorites WHERE user_id=$1 ORDER BY kind,target",
        [user.id],
      )
    ).rows;
  }
  async favorite(user: User, input: unknown, remove: boolean) {
    const body = favoriteSchema.safeParse(input);
    if (!body.success) throw new BadRequestException("Invalid favorite");
    const { kind, target } = body.data;
    await transaction(this.pool, async (db) => {
      await this.locked(db, user.id);
      const count = Number(
        (
          await db.query(
            "SELECT count(*) AS count FROM favorites WHERE user_id=$1",
            [user.id],
          )
        ).rows[0].count,
      );
      if (!remove && count >= 500)
        throw new BadRequestException("Favorite limit reached");
      await db.query(
        remove
          ? "DELETE FROM favorites WHERE user_id=$1 AND kind=$2 AND target=$3"
          : "INSERT INTO favorites VALUES ($1,$2,$3) ON CONFLICT DO NOTHING",
        [user.id, kind, target],
      );
    });
    return this.list(user);
  }
  async clearEvents(user: User) {
    await this.pool.query(
      "DELETE FROM favorites WHERE user_id=$1 AND kind='event'",
      [user.id],
    );
    return { ok: true };
  }
  async export(user: User) {
    return transaction(this.pool, async (db) => {
      await this.locked(db, user.id);
      return {
        exportedAt: new Date().toISOString(),
        account: user,
        favorites: (
          await db.query<Favorite>(
            "SELECT kind,target FROM favorites WHERE user_id=$1 ORDER BY kind,target",
            [user.id],
          )
        ).rows,
        notificationPreferences: (
          await db.query(
            "SELECT enabled FROM notification_preferences WHERE user_id=$1",
            [user.id],
          )
        ).rows[0] || { enabled: 0 },
        notifications: (
          await db.query(
            "SELECT event_id,title,message,provider,reported_at,created_at,read FROM notifications WHERE user_id=$1 ORDER BY id DESC LIMIT 100",
            [user.id],
          )
        ).rows,
        recoveryCodesRemaining: Number(
          (
            await db.query(
              "SELECT count(*) AS count FROM recovery_codes WHERE user_id=$1",
              [user.id],
            )
          ).rows[0].count,
        ),
      };
    });
  }
  async removeAccount(user: User, input: unknown) {
    const body = z
      .object({
        password: z.string().min(1).max(128),
        confirmation: z.literal("DELETE"),
      })
      .strict()
      .safeParse(input);
    if (!body.success)
      throw new BadRequestException(
        "Enter your password and type DELETE to confirm.",
      );
    const previous = await this.confirm(user, body.data.password);
    await transaction(this.pool, async (db) => {
      await this.locked(db, user.id, previous);
      await db.query(
        "UPDATE audit SET user_id='deleted-account' WHERE user_id=$1",
        [user.id],
      );
      await db.query(
        "UPDATE audit SET target='deleted-account' WHERE target=$1",
        [user.id],
      );
      await db.query("DELETE FROM auth_limits WHERE key=ANY($1::text[])", [
        [
          digest(`reauth:${user.id}`),
          digest(`login:${user.email}`),
          digest(`register:${user.email}`),
          digest(`recover:${user.email}`),
        ],
      ]);
      await db.query("DELETE FROM users WHERE id=$1", [user.id]);
    });
    return { ok: true };
  }
}
