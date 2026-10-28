import { it, expect } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
it("backs up committed WAL writes, verifies restore and refuses overwrite", () => {
  const dir = mkdtempSync(join(tmpdir(), "backinit-backup-"));
  const source = join(dir, "source.sqlite");
  const target = join(dir, "backup.sqlite");
  const db = new DatabaseSync(source);
  try {
    db.exec(
      "PRAGMA journal_mode=WAL;CREATE TABLE example (value TEXT);INSERT INTO example VALUES ('durable')",
    );
    execFileSync(process.execPath, ["scripts/backup-database.mjs", target], {
      env: { ...process.env, DATABASE_PATH: source },
      stdio: "pipe",
    });
    const restore = new DatabaseSync(target, { readOnly: true });
    try {
      expect(restore.prepare("SELECT value FROM example").get()?.value).toBe(
        "durable",
      );
    } finally {
      restore.close();
    }
    expect(statSync(target).mode & 0o777).toBe(0o600);
    expect(() =>
      execFileSync(process.execPath, ["scripts/backup-database.mjs", target], {
        env: { ...process.env, DATABASE_PATH: source },
        stdio: "pipe",
      }),
    ).toThrow();
  } finally {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
