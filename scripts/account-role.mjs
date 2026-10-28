// Local operator tool. Does not create accounts, take passwords or grant by unverified email.
import { DatabaseSync } from "node:sqlite";
const [id, role] = process.argv.slice(2);
if (!/^[a-f0-9-]{36}$/.test(id || "") || !["user", "admin"].includes(role)) {
  console.error(
    "Usage: DATABASE_PATH=apps/api/.data/backinit.sqlite node scripts/account-role.mjs <account-id> <user|admin>",
  );
  process.exit(1);
}
const path = process.env.DATABASE_PATH;
if (!path) {
  console.error("Set DATABASE_PATH explicitly to the API database path.");
  process.exit(1);
}
const db = new DatabaseSync(path);
db.exec("BEGIN IMMEDIATE");
try {
  const result = db.prepare("UPDATE users SET role=? WHERE id=?").run(role, id);
  if (result.changes !== 1) throw new Error("Account not found");
  db.prepare("DELETE FROM sessions WHERE user_id=?").run(id);
  db.prepare(
    "INSERT INTO audit(user_id,action,target,at) VALUES (?,?,?,?)",
  ).run("local-operator", "role." + role, id, new Date().toISOString());
  db.exec("COMMIT");
  console.log("Role updated; existing sessions revoked. Sign in again.");
} catch (e) {
  db.exec("ROLLBACK");
  console.error(e.message);
  process.exitCode = 1;
} finally {
  db.close();
}
