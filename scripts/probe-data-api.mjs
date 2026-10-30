/** Checks that the stateless hosting mode cannot create disposable user/source databases. */
import { spawn } from "node:child_process";
import {
  mkdtempSync,
  existsSync,
  rmSync,
  mkdirSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import assert from "node:assert/strict";
const root = resolve(import.meta.dirname, "..");
const directory = mkdtempSync(resolve(tmpdir(), "backinit-data-"));
const database = resolve(directory, "must-not-exist.sqlite");
const api = "http://127.0.0.1:4502";
const child = spawn(process.execPath, ["dist/apps/api/src/main.js"], {
  cwd: resolve(root, "apps/api"),
  env: {
    ...process.env,
    PORT: "4502",
    HOST: "0.0.0.0",
    NODE_ENV: "production",
    SPORTS_DATA_ONLY: "true",
    ALLOW_DEMO_MODE: "false",
    SPORTS_PROVIDERS_DISABLED: "true",
    DATABASE_PATH: database,
  },
  stdio: "ignore",
});
try {
  let ready = false;
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(api + "/health")).ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  assert(ready, "Data API did not start");
  const health = await (await fetch(api + "/health")).json();
  assert.equal(health.mode, "data-only");
  for (const path of ["/admin/sources", "/account/me", "/account/register"]) {
    const r = await fetch(api + path, {
      method: path.endsWith("register") ? "POST" : "GET",
    });
    assert.equal(r.status, 503, path);
  }
  assert.deepEqual(await (await fetch(api + "/streams")).json(), { data: [] });
  assert.deepEqual(await (await fetch(api + "/videos")).json(), {
    data: [],
    coverage: [],
  });
  assert.deepEqual(await (await fetch(api + "/streams?library=1")).json(), {
    data: [],
  });
  assert.equal(
    (await fetch(api + "/streams/yt-000000000000000000000000/health")).status,
    404,
  );
  assert.equal((await fetch(api + "/streams/example/health")).status, 404);
  assert.deepEqual(await (await fetch(api + "/streams?event=missing")).json(), {
    data: [],
  });
  assert.equal(
    (await fetch(api + "/streams/official-missing/health")).status,
    404,
  );
  assert.equal((await fetch(api + "/events?edition=demo")).status, 403);
  const events = await (await fetch(api + "/events?edition=real")).json();
  assert.equal(events.edition, "real");
  assert.deepEqual(events.data, []);
  const watch = await (await fetch(api + "/watch")).json();
  assert(
    watch.coverage.some(
      (c) =>
        c.provider === "Broadcast registry" && c.status === "not-configured",
    ),
  );
  assert.equal((await fetch(api + "/watch?date=2026-02-31")).status, 400);
  assert(
    !existsSync(database),
    "Data-only process created a disposable database",
  );
  const result = {
    at: new Date().toISOString(),
    mode: health.mode,
    createdDatabase: false,
    demoRejected: true,
    persistentFeaturesUnavailable: true,
    disabledProvidersDoNotSubstituteSnapshots: true,
    invalidDateRejected: true,
  };
  mkdirSync(resolve(root, "artifacts"), { recursive: true });
  writeFileSync(
    resolve(root, "artifacts/data-api-mode.json"),
    JSON.stringify(result, null, 2),
  );
  console.log(JSON.stringify(result));
} finally {
  child.kill("SIGTERM");
  rmSync(directory, { recursive: true, force: true });
}
