import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test("news loads independently, retries an outage and credits the live index", async ({
  page,
  baseURL,
}) => {
  await page
    .context()
    .addCookies([{ name: "backinit-edition", value: "real", url: baseURL! }]);
  let attempts = 0;
  await page.route("**/api/news", async (route) => {
    attempts++;
    if (attempts === 1)
      return route.fulfill({
        status: 503,
        json: {
          data: [],
          status: "unavailable",
          message: "News updates are temporarily unavailable.",
          fetchedAt: null,
        },
      });
    return route.fulfill({
      json: {
        data: [
          {
            title: "Football fixture headline",
            url: "https://www.bbc.com/sport/football/articles/fixture",
            publishedAt: "2026-11-01T01:00:00Z",
            dateKind: "indexed",
            source: "BBC Sport",
            category: "Football",
          },
        ],
        status: "available",
        message: "Publisher links indexed by GDELT.",
        fetchedAt: new Date().toISOString(),
        attribution: {
          name: "GDELT Project",
          url: "https://www.gdeltproject.org/",
        },
      },
    });
  });
  await page.goto("/news");
  await expect(
    page.getByRole("heading", { name: "News", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Retry news", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Football fixture headline" }),
  ).toBeVisible();
  await expect(page.getByText(/BBC Sport · Indexed/)).toBeVisible();
  await page.getByText("News coverage", { exact: true }).click();
  await expect(
    page.getByRole("link", { name: "GDELT Project" }),
  ).toHaveAttribute("href", "https://www.gdeltproject.org/");
  await page.setViewportSize({ width: 320, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const results = await new AxeBuilder({ page }).include("main").analyze();
  expect(
    results.violations.filter((v) =>
      ["serious", "critical"].includes(v.impact || ""),
    ),
  ).toEqual([]);
});
