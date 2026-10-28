// Optional real-network identity/image proof; no metadata is substituted for fixture facts.
import { chromium, expect } from "@playwright/test";
const base = process.env.PREVIEW_URL || "http://127.0.0.1:3000";
const browser = await chromium.launch();
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    timezoneId: "Africa/Kampala",
  });
  const page = await context.newPage();
  await page.goto(base + "/watch?date=2026-10-28");
  await expect(page.locator(".live-spotlight")).toBeVisible();
  const feed = await (
    await page.request.get(base + "/api/watch?date=2026-10-28")
  ).json();
  const fixtures = feed.data.filter((x) =>
    x.event.id.startsWith("efl-20261028"),
  );
  expect(fixtures).toHaveLength(5);
  const records = [];
  for (const { event: e } of fixtures) {
    const row = page.locator(`a[href="/watch/${e.id}"]`);
    for (const side of ["home", "away"]) {
      const identity = e[`${side}Participant`];
      expect(identity?.id).toBeTruthy();
      expect(identity?.imageUrl).toBeTruthy();
      const image = row.locator(`img[src="${identity.imageUrl}"]`);
      await image.scrollIntoViewIfNeeded();
      await expect
        .poll(() => image.evaluate((i) => i.complete && i.naturalWidth > 0), {
          timeout: 15000,
        })
        .toBe(true);
      records.push({
        team: e[side],
        id: identity.id,
        provider: identity.provider,
        image: identity.imageUrl,
        decoded: true,
      });
    }
  }
  for (const theme of ["light", "dark"]) {
    await page
      .locator("footer")
      .getByRole("button", { name: theme, exact: true })
      .click();
    for (const width of [390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.evaluate(() => scrollTo(0, 0));
      await page.screenshot({
        path: `artifacts/identity-real-${theme}-${width}.png`,
      });
    }
  }
  await page.locator(".sports-picker > summary").click();
  await page.screenshot({ path: "artifacts/identity-sport-picker.png" });
  console.log(
    JSON.stringify(
      {
        teams: records,
        localSportImages: await page
          .locator(".sports-nav img")
          .evaluateAll((nodes) =>
            nodes.map((i) => ({
              src: i.src,
              decoded: i.complete && i.naturalWidth > 0,
            })),
          ),
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
