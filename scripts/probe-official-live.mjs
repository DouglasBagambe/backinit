/** Real provider → API → event page → decoded live embed. No footage or media URLs are saved. */
import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import assert from "node:assert/strict";
const base = process.env.PROBE_WEB_URL || "http://127.0.0.1:3000";
const output = resolve("artifacts");
mkdirSync(output, { recursive: true });
const feedResponse = await fetch(base + "/api/watch");
assert.equal(feedResponse.status, 200);
const feed = await feedResponse.json();
const candidates = feed.data
  .filter(
    (r) =>
      r.event.status === "live" &&
      r.event.provenance === "provider" &&
      r.sources.some((s) => s.type === "embed" && s.id.startsWith("official-")),
  )
  .slice(0, 3);
const result = {
  at: new Date().toISOString(),
  origin: base,
  publisherReportedLive: candidates.length,
  attempts: [],
  decodedBroadcasts: 0,
};
const browser = await chromium.launch();
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  const page = await context.newPage();
  for (const row of candidates) {
    const attempt = {
      eventId: row.event.id,
      title: row.event.title,
      publisher: row.event.source.provider,
      checkedAt: new Date().toISOString(),
    };
    result.attempts.push(attempt);
    try {
      await page.goto(base + "/watch/" + row.event.id);
      await page
        .getByRole("button", { name: "Load official player", exact: true })
        .click({ timeout: 25000 });
      const frame = page.frameLocator(
        'iframe[title="' + row.sources[0].name + '"]',
      );
      await frame
        .getByRole("button", { name: "Play video", exact: true })
        .first()
        .click({ timeout: 20000 });
      const video = frame.locator("video");
      await video.waitFor({ state: "attached", timeout: 20000 });
      const sample = () =>
        video.evaluate((v) => ({
          currentTime: v.currentTime,
          width: v.videoWidth,
          height: v.videoHeight,
          readyState: v.readyState,
          paused: v.paused,
          frames: v.getVideoPlaybackQuality().totalVideoFrames,
        }));
      for (let i = 0; i < 20; i++) {
        attempt.before = await sample();
        if (attempt.before.width > 0 && !attempt.before.paused) break;
        await page.waitForTimeout(1000);
      }
      await page.waitForTimeout(10000);
      attempt.after = await sample();
      attempt.played =
        attempt.after.frames > attempt.before.frames &&
        attempt.after.currentTime > attempt.before.currentTime + 2 &&
        attempt.after.width > 0 &&
        !attempt.after.paused;
      await page.screenshot({
        path: resolve(output, "official-live-desktop.png"),
      });
      if (attempt.played) {
        result.decodedBroadcasts++;
        await page.setViewportSize({ width: 390, height: 844 });
        await page.waitForTimeout(2000);
        attempt.mobile = {
          overflow: await page.evaluate(
            () => document.documentElement.scrollWidth > innerWidth,
          ),
          sample: await sample(),
        };
        await page.screenshot({
          path: resolve(output, "official-live-mobile.png"),
        });
        assert.equal(attempt.mobile.overflow, false);
        const before = attempt.after.currentTime;
        // Exercise the ordinary 60s source poll: renewed leases must preserve the iframe/video.
        await page.waitForTimeout(65000);
        attempt.afterRefresh = await sample();
        attempt.refreshPreservedPlayback =
          attempt.afterRefresh.currentTime > before + 30 &&
          !attempt.afterRefresh.paused;
        break;
      }
    } catch (e) {
      attempt.error = e.message;
    }
  }
  result.status = result.decodedBroadcasts
    ? "LIVE PLAYBACK VERIFIED"
    : "LIVE PLAYBACK NOT ACHIEVED";
  writeFileSync(
    resolve(output, "official-live-playback.json"),
    JSON.stringify(result, null, 2),
  );
  console.log(JSON.stringify(result, null, 2));
} finally {
  await browser.close();
}
