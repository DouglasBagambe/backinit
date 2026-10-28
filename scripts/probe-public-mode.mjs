/** Isolated production-mode check. Never connects to or changes the public deployment. */
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
const root = resolve(import.meta.dirname, "..");
const web = "http://127.0.0.1:3500",
  api = "http://127.0.0.1:4500";
const shared = {
  ...process.env,
  NODE_ENV: "production",
  ALLOW_DEMO_MODE: "false",
  SPORTS_DATA_MODE: "demo",
  SPORTS_PROVIDERS_DISABLED: "true",
  API_INTERNAL_URL: "",
  API_URL: api,
  APP_ORIGIN: web,
  WEB_ORIGIN: web,
  DATABASE_PATH: ":memory:",
};
const children = [
  spawn(process.execPath, ["dist/apps/api/src/main.js"], {
    cwd: resolve(root, "apps/api"),
    env: { ...shared, PORT: "4500" },
    stdio: "ignore",
  }),
  spawn(
    process.execPath,
    ["node_modules/next/dist/bin/next", "start", "--port", "3500"],
    { cwd: resolve(root, "apps/web"), env: shared, stdio: "ignore" },
  ),
];
let browser;
try {
  for (const url of [api + "/health", web]) {
    let ready = false;
    for (let i = 0; i < 60; i++) {
      try {
        if ((await fetch(url)).ok) {
          ready = true;
          break;
        }
      } catch {}
      await new Promise((r) => setTimeout(r, 500));
    }
    assert(ready, `Server unavailable: ${url}`);
  }
  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page
    .context()
    .addCookies([{ name: "backinit-edition", value: "demo", url: web }]);
  const events = await (await page.request.get(web + "/api/events")).json();
  assert.equal(events.edition, "real");
  assert.deepEqual(events.data, []);
  const rejected = await page.request.post(web + "/api/edition", {
    headers: { Origin: web },
    data: { edition: "demo" },
  });
  assert.equal(rejected.status(), 403);
  assert.equal(
    (await page.request.get(api + "/events?edition=demo")).status(),
    403,
  );
  assert.deepEqual(
    (await (await page.request.get(api + "/streams")).json()).data,
    [],
  );
  assert.equal((await page.request.get(web + "/playback")).status(), 404);
  assert.equal(
    (await page.request.get(web + "/api/calendar/north-london")).status(),
    404,
  );
  await page.goto(web + "/scores");
  assert.equal(
    await page
      .getByRole("button", { name: "Demo edition", exact: true })
      .count(),
    0,
  );
  assert(
    !(await page.locator("body").innerText()).includes("Arsenal vs Liverpool"),
  );
  mkdirSync(resolve(root, "artifacts"), { recursive: true });
  await page.screenshot({
    path: resolve(root, "artifacts/public-mode-mobile.png"),
  });
  children[0].kill("SIGTERM");
  await new Promise((resolve) => children[0].once("exit", resolve));
  const offline = await page.request.get(web + "/api/events");
  assert.equal(offline.status(), 503);
  assert.deepEqual((await offline.json()).data, []);
  const result = {
    at: new Date().toISOString(),
    oldDemoCookieIgnored: true,
    demoApiRejected: true,
    demoSwitcherHidden: true,
    testPlayerNotFound: true,
    testStreamsHidden: true,
    demoCalendarNotFound: true,
    disabledProvidersReturnNoSnapshots: true,
    offlineBackendReturns503: true,
  };
  writeFileSync(
    resolve(root, "artifacts/public-mode.json"),
    JSON.stringify(result, null, 2),
  );
  console.log(JSON.stringify(result));
} finally {
  await browser?.close();
  for (const child of children) child.kill("SIGTERM");
}
