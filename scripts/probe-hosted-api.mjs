/** Real hosted API + local production frontend. Read-only: never deploys or publishes sources. */
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
const root = resolve(import.meta.dirname, "..");
const api = process.env.PROBE_API_URL || "https://backinit-api.onrender.com";
const web = "http://127.0.0.1:3501";
const checks = [];
async function get(base, path, expected = 200) {
  const start = Date.now();
  const r = await fetch(base + path, { signal: AbortSignal.timeout(90000) });
  assert.equal(r.status, expected, `${base}${path}`);
  const body = await r.json();
  checks.push({ base, path, status: r.status, elapsedMs: Date.now() - start });
  return body;
}
// Warm the free instance before checking the ordinary frontend request deadline.
const health = await get(api, "/health");
assert.equal(health.mode, "data-only");
const events = await get(api, "/events?edition=real");
assert.equal(events.edition, "real");
assert(events.data.length > 0, "No real provider records returned");
assert(
  events.data.every((e) => e.provenance === "provider" && e.source?.provider),
);
await get(api, "/events?edition=demo", 403);
await get(api, "/account/me", 503);
assert.deepEqual((await get(api, "/streams")).data, []);
const child = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "start",
    "--hostname",
    "127.0.0.1",
    "--port",
    "3501",
  ],
  {
    cwd: resolve(root, "apps/web"),
    env: {
      ...process.env,
      NODE_ENV: "production",
      VERCEL: "1",
      API_BACKEND: "external",
      API_URL: api,
      API_INTERNAL_URL: "https://invalid-old-binding.example",
      SPORTS_DATA_MODE: "demo",
      ALLOW_DEMO_MODE: "false",
      APP_ORIGIN: web,
    },
    stdio: "ignore",
  },
);
let browser;
try {
  let ready = false;
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(web + "/api/streams")).status === 200) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  assert(ready, "Local frontend failed to start");
  const feed = await get(web, "/api/events");
  assert.equal(feed.edition, "real");
  assert(feed.data.length > 0);
  const schedule = await get(web, "/api/watch");
  assert(schedule.data.length > 0);
  assert(
    schedule.data.every(
      (x) =>
        x.event.provenance === "provider" &&
        x.sources.every(
          (s) => s.content === "sports" && s.eventId === x.event.id,
        ),
    ),
  );
  browser = await chromium.launch();
  const page = await browser.newPage();
  await page
    .context()
    .addCookies([{ name: "backinit-edition", value: "demo", url: web }]);
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Kampala",
  }).format(new Date());
  mkdirSync(resolve(root, "artifacts"), { recursive: true });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  for (const [name, width, height] of [
    ["desktop", 1440, 1000],
    ["mobile", 390, 844],
  ]) {
    await page.setViewportSize({ width, height });
    await page.goto(web + "/watch?date=" + today);
    await page.getByRole("heading", { name: "Watch", exact: true }).waitFor();
    await page.waitForFunction(
      () => document.querySelectorAll('a[href^="/watch/"]').length > 0,
    );
    assert.equal(
      await page
        .getByRole("button", { name: "Demo edition", exact: true })
        .count(),
      0,
    );
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    await page.screenshot({
      path: resolve(root, `artifacts/render-data-${name}.png`),
      fullPage: false,
    });
  }
  const first = page.locator('a[href^="/watch/"]').first();
  const matchHref = await first.getAttribute("href");
  await first.click();
  await page.waitForURL("**" + matchHref);
  assert.equal((await page.request.get(web + "/api/streams")).status(), 200);
  assert.deepEqual(errors, []);
  const result = {
    at: new Date().toISOString(),
    api,
    checks,
    records: events.data.length,
    sports: [...new Set(events.data.map((e) => e.sport))],
    providerReportedLive: events.data
      .filter((e) => e.status === "live")
      .map((e) => ({ id: e.id, sport: e.sport, source: e.source })),
    coverage: events.coverage,
    frontendRecords: feed.data.length,
    watchRecords: schedule.data.length,
    matchHref,
    actualBroadcastsVerified: 0,
    playback:
      "Playback not exercised by this data probe; verify eligible broadcasts separately",
    oldDemoCookieIgnored: true,
    externalBackendSelected: true,
    desktopAndMobile: true,
  };
  writeFileSync(
    resolve(root, "artifacts/hosted-api.json"),
    JSON.stringify(result, null, 2),
  );
  console.log(JSON.stringify(result, null, 2));
} finally {
  await browser?.close();
  child.kill("SIGTERM");
}
