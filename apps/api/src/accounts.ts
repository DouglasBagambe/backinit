import { DatabaseSync } from "node:sqlite";
import {
  randomBytes,
  randomUUID,
  scrypt as scryptCallback,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import { promisify } from "node:util";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import {
  BadRequestException,
  UnauthorizedException,
  ForbiddenException,
  ConflictException,
} from "@nestjs/common";
import { z } from "zod";
const scrypt = promisify(scryptCallback);
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
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
      CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, password TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('user','admin')));
      CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS favorites (user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, kind TEXT NOT NULL, target TEXT NOT NULL, PRIMARY KEY(user_id,kind,target));
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
    const salt =
      existing?.password.split(":")[0] || randomBytes(16).toString("hex");
    const hash = (await scrypt(password, salt, 64)) as Buffer;
    let user: User;
    if (register) {
      if (existing)
        throw new ConflictException(
          "Unable to create account. Try signing in.",
        );
      user = { id: randomUUID(), email, role: "user" };
      try {
        this.db
          .prepare("INSERT INTO users(id,email,password) VALUES (?,?,?)")
          .run(user.id, email, `${salt}:${hash.toString("hex")}`);
      } catch {
        throw new ConflictException(
          "Unable to create account. Try signing in.",
        );
      }
    } else {
      const expected = existing
        ? Buffer.from(existing.password.split(":")[1]!, "hex")
        : Buffer.alloc(64);
      if (
        !existing ||
        expected.length !== hash.length ||
        !timingSafeEqual(hash, expected)
      )
        throw new UnauthorizedException("Email or password is incorrect.");
      user = { id: existing.id, email: existing.email, role: existing.role };
    }
    const token = randomBytes(32).toString("hex");
    this.db.prepare("DELETE FROM sessions WHERE expires < ?").run(Date.now());
    this.db
      .prepare("INSERT INTO sessions VALUES (?,?,?)")
      .run(digest(token), user.id, Date.now() + 7 * 86400000);
    return { user, token };
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
