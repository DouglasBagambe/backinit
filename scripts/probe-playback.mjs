// Optional external-network verification. Start the built web/API first.
import { chromium } from "@playwright/test";
const browser = await chromium.launch();
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  for (const source of ["bbb-hls", "bbb-dash"]) {
    await page.goto("http://127.0.0.1:3000/watch");
    await page
      .getByLabel("Stream source", { exact: true })
      .selectOption(source);
    await page.getByRole("button", { name: "Load test player" }).click();
    await page.waitForFunction(
      () => {
        const v = document.querySelector("video");
        return v && v.readyState >= 2;
      },
      {},
      { timeout: 45000 },
    );
    await page.locator("video").evaluate(async (v) => {
      v.muted = true;
      await v.play();
    });
    await page.waitForFunction(
      () => document.querySelector("video").currentTime > 2,
      {},
      { timeout: 20000 },
    );
    console.log(
      source,
      JSON.stringify(
        await page.locator("video").evaluate((v) => ({
          currentTime: v.currentTime,
          readyState: v.readyState,
          width: v.videoWidth,
          height: v.videoHeight,
          paused: v.paused,
        })),
      ),
    );
    await page.screenshot({ path: `artifacts/playback-${source}.png` });
  }
} finally {
  await browser.close();
}
