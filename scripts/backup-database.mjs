// Online, WAL-consistent SQLite backup. Run as the installation's operator.
import { DatabaseSync, backup } from "node:sqlite";
import { openSync, closeSync, mkdirSync, unlinkSync } from "node:fs";
import { resolve, dirname } from "node:path";
const source = process.env.DATABASE_PATH;
const destination = process.argv[2];
if (!source || !destination) {
  console.error(
    "Usage: DATABASE_PATH=/absolute/source.sqlite node scripts/backup-database.mjs /absolute/backup.sqlite",
  );
  process.exit(1);
}
const target = resolve(destination);
if (target === resolve(source))
  throw new Error("Backup must use a different file.");
mkdirSync(dirname(target), { recursive: true, mode: 0o700 });
closeSync(openSync(target, "wx", 0o600)); // Never overwrite an existing backup.
const db = new DatabaseSync(resolve(source), { readOnly: true });
try {
  await backup(db, target);
  const restored = new DatabaseSync(target, { readOnly: true });
  try {
    if (
      restored.prepare("PRAGMA integrity_check").get()?.integrity_check !== "ok"
    )
      throw new Error("Backup integrity check failed");
  } finally {
    restored.close();
  }
  console.log(
    "Backup created with owner-only permissions; restore integrity check passed.",
  );
} catch (error) {
  unlinkSync(target);
  throw error;
} finally {
  db.close();
}
