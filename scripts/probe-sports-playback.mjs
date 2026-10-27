// Optional network-backed playback checks; provider restrictions are expected outcomes.
import { chromium } from "@playwright/test";
const base = process.env.PREVIEW_URL || "http://127.0.0.1:3000";
const sports = process.argv.slice(2);
if (!sports.length) sports.push("WWE", "Basketball", "Tennis");
const browser = await chromium.launch();
try {
  for (const sport of sports) {
    const context = await browser.newContext();
    const page = await context.newPage();
    const evidence = { sport };
    try {
      await page.goto(`${base}/watch?sport=${encodeURIComponent(sport)}`);
      const consent = page.getByRole("button", {
        name: "Load official player",
        exact: true,
      });
      await consent.waitFor({ timeout: 45000 });
      evidence.title = await page
        .locator(".watch-feature > .section-heading h2")
        .textContent();
      await consent.click();
      const frame = page.frameLocator(".official-embed iframe");
      await frame.locator("body").waitFor({ timeout: 20000 });
      const play = frame.getByRole("button", { name: /^Play/ }).first();
      try {
        await play.click({ timeout: 10000 });
      } catch {
        /* Provider may reject playback before controls appear. */
      }
      await page.waitForTimeout(6000);
      evidence.state = await frame.locator("body").evaluate((body) => {
        const v = body.querySelector("video");
        return {
          text: body.innerText.slice(0, 240),
          time: v?.currentTime ?? 0,
          readyState: v?.readyState ?? 0,
          paused: v?.paused ?? true,
        };
      });
      evidence.decodedPlayback =
        evidence.state.time > 0 &&
        evidence.state.readyState >= 2 &&
        !evidence.state.paused;
      evidence.playerStatus = await page.getByRole("status").allTextContents();
      await page.screenshot({
        path: `artifacts/playback-${sport.toLowerCase().replaceAll(" ", "-")}.png`,
      });
    } catch (error) {
      evidence.decodedPlayback = false;
      evidence.error = error.message.slice(0, 240);
    } finally {
      console.log(JSON.stringify(evidence));
      await context.close();
    }
  }
} finally {
  await browser.close();
}
