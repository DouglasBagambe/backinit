import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("weekend fixtures remain discoverable without claiming a video or animated feed", async ({
  page,
  baseURL,
}) => {
  await page
    .context()
    .addCookies([{ name: "backinit-edition", value: "real", url: baseURL! }]);
  await page.clock.setFixedTime(new Date("2026-10-30T22:00:00Z"));
  await page.addInitScript(() =>
    localStorage.setItem("backinit-timezone", "Africa/Kampala"),
  );
  const event = {
    id: "espn-soccer-eng-1-401879248",
    sport: "Football",
    competition: "Premier League",
    start: "2026-10-31T12:30:00Z",
    kind: "score",
    home: "Chelsea",
    away: "Manchester United",
    homeScore: null,
    awayScore: null,
    clock: "Scheduled",
    status: "upcoming",
    provenance: "provider",
  };
  await page.route("**/api/events", (route) =>
    route.fulfill({
      json: {
        data: [event],
        edition: "real",
        source: "Browser contract",
        coverage: [],
      },
    }),
  );
  await page.route("**/api/watch*", (route) =>
    route.fulfill({
      json: { data: [], coverage: [], generatedAt: "2026-10-30T22:00:00Z" },
    }),
  );
  const loaded = page.waitForResponse((response) =>
    response.url().includes("/api/watch"),
  );
  await page.goto("/watch");
  await loaded;
  await page.clock.fastForward(31000);
  const section = page.getByRole("region", { name: "Weekend football" });
  await expect(section).toContainText("Match of the day");
  await expect(section).toContainText("15:30");
  await expect(section.getByRole("link", { name: /Chelsea/ })).toHaveAttribute(
    "href",
    `/watch/${event.id}`,
  );
  await expect(section).not.toContainText("Watch live");
  await expect(section).toContainText("Match centre & viewing options");
  expect(
    (await new AxeBuilder({ page }).include(".weekend-matches").analyze())
      .violations,
  ).toEqual([]);
  await page.setViewportSize({ width: 375, height: 812 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await expect(section.getByRole("link", { name: /Chelsea/ })).toBeVisible();
});
