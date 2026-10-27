// Optional external-network review against a running local preview, never deterministic CI.
import { chromium, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
const base = process.env.PREVIEW_URL || "http://127.0.0.1:3000";
const browser = await chromium.launch();
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  const page = await context.newPage();
  await page.goto(base + "/videos");
  await page
    .getByRole("button", { name: "Load official player", exact: true })
    .waitFor({ timeout: 45000 });
  await expect(page.locator(".official-embed iframe")).toHaveCount(0);
  for (const theme of ["light", "dark"]) {
    await page
      .locator("footer")
      .getByRole("button", { name: theme, exact: true })
      .click();
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(1000);
      await page.screenshot({
        path: `artifacts/watch-official-${theme}-${width}.png`,
        fullPage: false,
      });
      const axe = await new AxeBuilder({ page }).analyze();
      const violations = axe.violations.filter((v) =>
        ["serious", "critical"].includes(v.impact),
      );
      if (violations.length)
        throw new Error(
          JSON.stringify(
            violations.map((v) => ({
              id: v.id,
              targets: v.nodes.map((n) => n.target),
            })),
          ),
        );
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
  }
  await page
    .getByRole("button", { name: "Load official player", exact: true })
    .click();
  try {
    const frame = page.locator(".official-embed iframe");
    await frame.waitFor({ timeout: 20000 });
    await page.waitForTimeout(3000);
    const content = page.frameLocator(".official-embed iframe");
    const play = content.getByRole("button", { name: /^Play/ }).first();
    if (await play.count()) await play.click({ timeout: 5000 });
    await page.waitForTimeout(6000);
    const state = await content.locator("body").evaluate((body) => ({
      text: body.innerText.slice(0, 240),
      video: (() => {
        const v = body.querySelector("video");
        return v
          ? { time: v.currentTime, readyState: v.readyState, paused: v.paused }
          : null;
      })(),
    }));
    console.log(JSON.stringify({ embedCreated: true, state }, null, 2));
  } catch (error) {
    console.log(
      JSON.stringify({
        embedPlaybackUnverified: true,
        reason: error.message.slice(0, 200),
        status: await page.getByRole("status").allTextContents(),
      }),
    );
  }
  await page.screenshot({ path: "artifacts/watch-official-player.png" });
} finally {
  await browser.close();
}
