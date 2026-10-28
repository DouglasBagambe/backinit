import { DatabaseSync } from "node:sqlite";
import { randomBytes, randomUUID, createHash } from "node:crypto";
import { passwordHash, passwordMatches } from "./passwords.js";
import { HttpException } from "@nestjs/common";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import {
  BadRequestException,
  UnauthorizedException,
  ForbiddenException,
  ConflictException,
} from "@nestjs/common";
import { z } from "zod";

export const credentialsSchema = z
  .object({
    email: z
      .string()
      .email()
      .max(254)
      .transform((x) => x.toLowerCase()),
    password: z.string().min(12).max(128),
  })
  .strict();
export const favoriteSchema = z
  .object({
    kind: z.enum(["event", "team", "athlete", "competition", "sport"]),
    target: z.string().min(1).max(150),
  })
  .strict();
export type Favorite = z.infer<typeof favoriteSchema>;
export type User = { id: string; email: string; role: "user" | "admin" };
const digest = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export class Accounts {
  readonly db: DatabaseSync;
  constructor(path = process.env.DATABASE_PATH || ".data/backinit.sqlite") {
    if (path !== ":memory:")
      mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
    this.db = new DatabaseSync(path);
    this.db
      .exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000; PRAGMA secure_delete=ON;
      CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, password TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('user','admin')));
      CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS favorites (user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, kind TEXT NOT NULL, target TEXT NOT NULL, PRIMARY KEY(user_id,kind,target));
      CREATE TABLE IF NOT EXISTS recovery_codes (user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, code_hash TEXT NOT NULL, PRIMARY KEY(user_id,code_hash));
      CREATE TABLE IF NOT EXISTS auth_limits (key TEXT PRIMARY KEY, attempts INTEGER NOT NULL, expires INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS audit (id INTEGER PRIMARY KEY, user_id TEXT NOT NULL, action TEXT NOT NULL, target TEXT NOT NULL, at TEXT NOT NULL);
    `);
  }
  async authenticate(input: unknown, register: boolean) {
    const parsed = credentialsSchema.safeParse(input);
    if (!parsed.success)
      throw new BadRequestException(
        "Use a valid email and a password of 12–128 characters.",
      );
    const { email, password } = parsed.data;
    const existing = this.db
      .prepare("SELECT * FROM users WHERE email = ?")
      .get(email) as (User & { password: string }) | undefined;
    const limitKey = this.attempt(register ? "register" : "login", email);
    let user: User;
    if (register) {
      const hash = await passwordHash(password);
      if (existing)
        throw new ConflictException(
          "Unable to create account. Try signing in.",
        );
      user = { id: randomUUID(), email, role: "user" };
      try {
        this.db
          .prepare("INSERT INTO users(id,email,password) VALUES (?,?,?)")
          .run(user.id, email, hash);
      } catch {
        throw new ConflictException(
          "Unable to create account. Try signing in.",
        );
      }
    } else {
      const valid = await passwordMatches(password, existing?.password);
      if (!valid || !existing)
        throw new UnauthorizedException("Email or password is incorrect.");
      // Recheck after asynchronous hashing so a concurrent reset/deletion cannot create a session.
      const current = this.db
        .prepare("SELECT password FROM users WHERE id=?")
        .get(existing.id);
      if (current?.password !== existing.password)
        throw new UnauthorizedException("Account changed. Sign in again.");
      if (!existing.password.startsWith("scrypt$v1$")) {
        const upgraded = await passwordHash(password);
        const changed = this.db
          .prepare("UPDATE users SET password=? WHERE id=? AND password=?")
          .run(upgraded, existing.id, existing.password);
        if (changed.changes !== 1)
          throw new UnauthorizedException("Account changed. Sign in again.");
      }
      const fresh = this.db
        .prepare("SELECT id,email,role FROM users WHERE id=?")
        .get(existing.id) as User | undefined;
      if (!fresh)
        throw new UnauthorizedException("Account changed. Sign in again.");
      user = fresh;
    }
    this.db.prepare("DELETE FROM auth_limits WHERE key=?").run(limitKey);
    const token = randomBytes(32).toString("hex");
    this.db.prepare("DELETE FROM sessions WHERE expires < ?").run(Date.now());
    this.db
      .prepare("INSERT INTO sessions VALUES (?,?,?)")
      .run(
        digest(token),
        user.id,
        Date.now() + (user.role === "admin" ? 15 * 60000 : 7 * 86400000),
      );
    return { user, token, expiresIn: user.role === "admin" ? 900 : 7 * 86400 };
  }
  private attempt(action: string, identity: string) {
    const key = digest(`${action}:${identity}`);
    const now = Date.now();
    this.db.prepare("DELETE FROM auth_limits WHERE expires < ?").run(now);
    const row = this.db
      .prepare(
        "INSERT INTO auth_limits VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET attempts=attempts+1 RETURNING attempts",
      )
      .get(key, now + 15 * 60000) as { attempts: number };
    if (row.attempts > 8)
      throw new HttpException("Too many attempts. Retry in 15 minutes.", 429);
    return key;
  }
  private async confirm(user: User, password: unknown) {
    if (typeof password !== "string" || password.length > 128)
      throw new UnauthorizedException("Password is incorrect.");
    this.attempt("reauth", user.id);
    const row = this.db
      .prepare("SELECT password FROM users WHERE id=?")
      .get(user.id) as { password: string } | undefined;
    if (!(await passwordMatches(password, row?.password)) || !row)
      throw new UnauthorizedException("Password is incorrect.");
    return row.password;
  }
  private transaction<T>(run: () => T): T {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const value = run();
      this.db.exec("COMMIT");
      return value;
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }
  private unchanged(user: User, hash: string) {
    if (
      this.db.prepare("SELECT password FROM users WHERE id=?").get(user.id)
        ?.password !== hash
    )
      throw new UnauthorizedException("Account changed. Sign in again.");
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
    this.transaction(() => {
      this.unchanged(user, previous);
      this.db
        .prepare("DELETE FROM recovery_codes WHERE user_id=?")
        .run(user.id);
      for (const code of codes)
        this.db
          .prepare("INSERT INTO recovery_codes VALUES (?,?)")
          .run(user.id, digest(code));
      this.audit(user, "account.recovery-codes.rotate", user.id);
    });
    return { codes };
  }
  async recover(input: unknown) {
    const body = credentialsSchema
      .extend({ code: z.string().regex(/^[A-Za-z0-9_-]{22}$/) })
      .safeParse(input);
    if (!body.success)
      throw new BadRequestException(
        "Enter your email, recovery code and a new password of 12–128 characters.",
      );
    const { email, password, code } = body.data;
    this.attempt("recover", email);
    const hash = await passwordHash(password);
    const row = this.db
      .prepare(
        "SELECT users.id,users.email,users.role FROM users JOIN recovery_codes ON users.id=user_id WHERE email=? AND code_hash=?",
      )
      .get(email, digest(code)) as User | undefined;
    if (!row)
      throw new UnauthorizedException("Email or recovery code is incorrect.");
    this.transaction(() => {
      const consumed = this.db
        .prepare("DELETE FROM recovery_codes WHERE user_id=? AND code_hash=?")
        .run(row.id, digest(code));
      if (consumed.changes !== 1)
        throw new UnauthorizedException("Email or recovery code is incorrect.");
      this.db
        .prepare("UPDATE users SET password=? WHERE id=?")
        .run(hash, row.id);
      this.db.prepare("DELETE FROM sessions WHERE user_id=?").run(row.id);
      this.audit(row, "account.password.recover", row.id);
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
    const previous = await this.confirm(user, body.data.currentPassword);
    const hash = await passwordHash(body.data.password);
    this.transaction(() => {
      this.unchanged(user, previous);
      this.db
        .prepare("UPDATE users SET password=? WHERE id=?")
        .run(hash, user.id);
      this.db.prepare("DELETE FROM sessions WHERE user_id=?").run(user.id);
      this.audit(user, "account.password.change", user.id);
    });
    return { ok: true };
  }
  export(user: User) {
    return {
      exportedAt: new Date().toISOString(),
      account: user,
      favorites: this.list(user),
      notificationPreferences: this.db
        .prepare("SELECT enabled FROM notification_preferences WHERE user_id=?")
        .get(user.id) || { enabled: 0 },
      notifications: this.db
        .prepare(
          "SELECT event_id,title,message,provider,reported_at,created_at,read FROM notifications WHERE user_id=? ORDER BY id DESC LIMIT 100",
        )
        .all(user.id),
      recoveryCodesRemaining: this.db
        .prepare("SELECT count(*) AS count FROM recovery_codes WHERE user_id=?")
        .get(user.id)?.count,
    };
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
    this.transaction(() => {
      this.unchanged(user, previous);
      this.db
        .prepare("UPDATE audit SET user_id='deleted-account' WHERE user_id=?")
        .run(user.id);
      this.db
        .prepare("UPDATE audit SET target='deleted-account' WHERE target=?")
        .run(user.id);
      this.db
        .prepare("DELETE FROM auth_limits WHERE key IN (?,?,?,?)")
        .run(
          digest(`reauth:${user.id}`),
          digest(`login:${user.email}`),
          digest(`register:${user.email}`),
          digest(`recover:${user.email}`),
        );
      this.db.prepare("DELETE FROM users WHERE id=?").run(user.id);
    });
    return { ok: true };
  }
  logoutAll(user: User) {
    this.db.prepare("DELETE FROM sessions WHERE user_id=?").run(user.id);
    return { ok: true };
  }
  user(authorization?: string): User {
    const token = authorization?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
    if (!token) throw new UnauthorizedException("Sign in to continue.");
    const user = this.db
      .prepare(
        "SELECT users.id, users.email, users.role FROM users JOIN sessions ON users.id = sessions.user_id WHERE token_hash = ? AND expires > ?",
      )
      .get(digest(token), Date.now()) as User | undefined;
    if (!user)
      throw new UnauthorizedException("Session expired. Please sign in again.");
    return user;
  }
  logout(authorization?: string) {
    const token = authorization?.slice(7);
    if (token)
      this.db
        .prepare("DELETE FROM sessions WHERE token_hash = ?")
        .run(digest(token));
    return { ok: true };
  }
  list(user: User): Favorite[] {
    return this.db
      .prepare(
        "SELECT kind,target FROM favorites WHERE user_id = ? ORDER BY kind,target",
      )
      .all(user.id) as Favorite[];
  }
  clearEvents(user: User) {
    this.db
      .prepare("DELETE FROM favorites WHERE user_id=? AND kind='event'")
      .run(user.id);
    return { ok: true };
  }
  favorite(user: User, input: unknown, remove: boolean) {
    const parsed = favoriteSchema.safeParse(input);
    if (!parsed.success) throw new BadRequestException("Invalid favorite");
    const { kind, target } = parsed.data;
    if (!remove && this.list(user).length >= 500)
      throw new BadRequestException("Favorite limit reached");
    this.db
      .prepare(
        remove
          ? "DELETE FROM favorites WHERE user_id=? AND kind=? AND target=?"
          : "INSERT OR IGNORE INTO favorites VALUES (?,?,?)",
      )
      .run(user.id, kind, target);
    return this.list(user);
  }
  admin(authorization?: string) {
    const user = this.user(authorization);
    if (user.role !== "admin")
      throw new ForbiddenException("Administrator access required.");
    return user;
  }
  audit(user: User, action: string, target: string) {
    this.db
      .prepare("INSERT INTO audit(user_id,action,target,at) VALUES (?,?,?,?)")
      .run(user.id, action, target, new Date().toISOString());
  }
}
