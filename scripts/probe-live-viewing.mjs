// Optional external-network verification. These feeds are testing signals, never match sources.
import { chromium, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
const base = process.env.PREVIEW_URL || "http://127.0.0.1:3000";
const browser = await chromium.launch();
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    timezoneId: "Africa/Kampala",
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(base + "/watch?date=2026-10-28");
  await expect(page.locator(".live-spotlight")).toContainText("23:00");
  const response = await page.request.get(base + "/api/watch?date=2026-10-28");
  const feed = await response.json();
  console.log(
    JSON.stringify({
      cup: feed.data
        .filter((x) => x.event.id.startsWith("efl-20261028"))
        .map((x) => ({
          event: x.event.id,
          start: x.event.start,
          availability: x.availability,
          sources: x.sources.length,
        })),
      sports: [...new Set(feed.data.map((x) => x.event.sport))],
    }),
  );
  for (const theme of ["light", "dark"]) {
    for (const path of [
      "/watch?date=2026-10-28",
      "/watch/efl-20261028-liverpool-chelsea",
    ]) {
      await page.goto(base + path);
      await page
        .locator("footer")
        .getByRole("button", { name: theme, exact: true })
        .click();
      for (const width of [390, 1440]) {
        await page.setViewportSize({ width, height: 1000 });
        await page.evaluate(() => scrollTo(0, 0));
        await page.waitForTimeout(500);
        const result = await new AxeBuilder({ page }).analyze();
        expect(
          result.violations
            .filter((v) => ["serious", "critical"].includes(v.impact))
            .map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
        ).toEqual([]);
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
        await page.screenshot({
          path: `artifacts/live-real-${path.includes("?") ? "discovery" : "event"}-${theme}-${width}.png`,
        });
      }
    }
  }
  await page.goto(base + "/playback");
  let first = true;
  for (const source of ["bbb-hls", "bbb-dash", "dash-live-simulator"]) {
    await page
      .getByLabel("Stream source", { exact: true })
      .selectOption(source);
    if (first) {
      await page.getByRole("button", { name: /Load test player/ }).click();
      first = false;
    }
    await page.waitForFunction(
      () => document.querySelector("video")?.readyState >= 2,
      {},
      { timeout: 45000 },
    );
    const before = await page.locator("video").evaluate(async (v) => {
      v.muted = true;
      await v.play();
      return v.currentTime;
    });
    await page.waitForFunction(
      (t) => document.querySelector("video").currentTime > t + 1.5,
      before,
      { timeout: 20000 },
    );
    const result = await page
      .locator("video")
      .evaluate((v) => ({
        currentTime: v.currentTime,
        readyState: v.readyState,
        width: v.videoWidth,
        height: v.videoHeight,
        paused: v.paused,
        live: v.duration === Infinity,
        seekable: v.seekable.length
          ? {
              start: v.seekable.start(0),
              end: v.seekable.end(v.seekable.length - 1),
            }
          : null,
      }));
    if (source === "dash-live-simulator") {
      expect(result.live).toBe(true);
      await expect(
        page.getByRole("button", { name: "Go live", exact: true }),
      ).toBeVisible();
      await page.locator("video").evaluate((v) => {
        v.currentTime = v.seekable.end(v.seekable.length - 1) - 20;
      });
      await page.getByRole("button", { name: "Go live", exact: true }).click();
      await expect
        .poll(() =>
          page
            .locator("video")
            .evaluate(
              (v) => v.seekable.end(v.seekable.length - 1) - v.currentTime,
            ),
        )
        .toBeLessThan(5);
    }
    const full = page.getByRole("button", { name: "Fullscreen", exact: true });
    if (await full.isEnabled()) {
      await full.click();
      await page.waitForFunction(() => !!document.fullscreenElement);
      await page.evaluate(() => document.exitFullscreen());
      result.fullscreen = true;
    }
    const pip = page.getByRole("button", {
      name: "Picture-in-picture",
      exact: true,
    });
    if (await pip.isEnabled()) {
      await pip.click();
      await page.waitForFunction(
        () => !!document.pictureInPictureElement,
        {},
        { timeout: 5000 },
      );
      await page.evaluate(() => document.exitPictureInPicture());
      result.pictureInPicture = true;
    }
    console.log(source, JSON.stringify(result));
    await page.screenshot({ path: `artifacts/live-proof-${source}.png` });
  }
  expect(errors).toEqual([]);
  console.log(JSON.stringify({ pageErrors: errors }));
} finally {
  await browser.close();
}
