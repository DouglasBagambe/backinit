import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
const widths = [360, 390, 430, 768, 1024, 1440, 1920];
for (const width of widths) {
  test(`responsive home and match at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    for (const path of ["/", "/match/north-london"]) {
      await page.goto(path);
      await expect(page.locator("main")).toBeVisible();
      await expect(
        page.getByText("DEMO EDITION", { exact: true }),
      ).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: `artifacts/${path === "/" ? "home" : "match"}-${width}.png`,
        fullPage: true,
        animations: "disabled",
      });
    }
  });
}
test("favorites persist and can be removed", async ({ page }) => {
  await page.goto("/scores");
  await page
    .getByRole("button", { name: "Save Arsenal vs Liverpool", exact: true })
    .click();
  await page.goto("/favorites");
  await expect(
    page.locator(".match-teams").filter({ hasText: "Arsenal" }),
  ).toBeVisible();
  await page.reload();
  await page
    .getByRole("button", { name: "Remove Arsenal vs Liverpool", exact: true })
    .click();
  await expect(page.getByText("Your favorites start here.")).toBeVisible();
});
test("search and sport filters produce meaningful results", async ({
  page,
}) => {
  await page.goto("/search");
  await page.getByRole("textbox", { name: "Search events" }).fill("boston");
  await expect(page.locator(".match-row")).toHaveCount(1);
  await page
    .getByRole("textbox", { name: "Search events" })
    .fill("missing-player");
  await expect(page.getByText("No events to show.")).toBeVisible();
  await page.goto("/sport/wwe");
  await expect(page.locator(".match-row")).toHaveCount(1);
  await page.goto("/match/wwe-showcase");
  await expect(
    page.getByRole("heading", { name: "The match card" }),
  ).toBeVisible();
  await expect(page.getByText("Atlas King vs Jax Steel")).toBeVisible();
});
test("match tracker, stats and honest watch state", async ({ page }) => {
  await page.goto("/match/north-london");
  await page.getByRole("tab", { name: "Statistics", exact: true }).click();
  await expect(page.getByText("Expected goals", { exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Tracker", exact: true }).click();
  await page.getByRole("button", { name: "Previous event" }).click();
  await expect(page.locator(".tracker-event")).toContainText("58");
  await page.getByRole("button", { name: "Play event replay" }).click();
  await expect(
    page.getByRole("button", { name: "Pause replay" }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Watch", exact: true }).click();
  await expect(
    page.getByText("No broadcast configured for this event."),
  ).toBeVisible();
});
test("theme persists; system mode responds to preference", async ({ page }) => {
  await page.goto("/settings");
  await page.getByRole("button", { name: "dark", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(
    page.locator("header").getByRole("button", { name: /theme/i }),
  ).toHaveCount(0);
  await expect(
    page.locator("footer").getByRole("button", { name: "dark", exact: true }),
  ).toHaveCount(1);
  await page.getByRole("button", { name: "system", exact: true }).click();
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});
test("core pages pass serious/critical accessibility checks in both themes", async ({
  page,
}) => {
  for (const theme of ["light", "dark"]) {
    await page.goto("/settings");
    await page.getByRole("button", { name: theme, exact: true }).click();
    for (const path of ["/", "/match/north-london", "/watch", "/settings"]) {
      await page.goto(path);
      const result = await new AxeBuilder({ page }).analyze();
      expect(
        result.violations
          .filter((v) => v.impact === "serious" || v.impact === "critical")
          .map((v) => ({
            id: v.id,
            nodes: v.nodes.map((n) => ({
              target: n.target,
              summary: n.failureSummary,
            })),
          })),
        `${theme} ${path}`,
      ).toEqual([]);
    }
    await page.screenshot({
      path: `artifacts/settings-${theme}.png`,
      fullPage: true,
      animations: "disabled",
    });
  }
});
test("API validates inputs and web uses backend", async ({ request }) => {
  const health = await request.get(
    `http://127.0.0.1:${process.env.E2E_API_PORT || 4100}/health`,
  );
  expect(health.status()).toBe(200);
  expect((await health.json()).provider).toBe("demo");
  expect(
    (
      await request.get(
        `http://127.0.0.1:${process.env.E2E_API_PORT || 4100}/events?sport=INVALID`,
      )
    ).status(),
  ).toBe(400);
  expect(
    (
      await request.get(
        `http://127.0.0.1:${process.env.E2E_API_PORT || 4100}/events/missing`,
      )
    ).status(),
  ).toBe(404);
  const feed = await request.get("/api/events");
  expect((await feed.json()).source).toBe("Demo API connected");
});
test("unavailable video reports failure and can retry", async ({ page }) => {
  await page.route("https://test-streams.mux.dev/**", (r) => r.abort());
  await page.goto("/playback");
  await page.getByRole("button", { name: "Load test player" }).click();
  await expect(page.getByRole("status")).toContainText("Playback unavailable", {
    timeout: 30000,
  });
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(page.locator("video")).toBeVisible();
});
test("unknown routes return 404 and all defined routes render", async ({
  page,
}) => {
  expect((await page.goto("/not-a-page"))?.status()).toBe(404);
  for (const path of [
    "/live",
    "/fixtures",
    "/news",
    "/profile",
    "/admin",
    "/competitions",
    "/teams",
    "/athletes",
    "/sport/rugby",
    "/match/grand-prix",
  ]) {
    expect((await page.goto(path))?.status()).toBe(200);
    await expect(page.locator("main")).toBeVisible();
  }
});

test("mobile accessibility and keyboard match navigation", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const path of ["/", "/match/north-london"]) {
    await page.goto(path);
    const result = await new AxeBuilder({ page }).analyze();
    expect(
      result.violations
        .filter((v) => v.impact === "serious" || v.impact === "critical")
        .map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
    ).toEqual([]);
  }
  await page.getByRole("tab", { name: "Overview", exact: true }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(
    page.getByRole("tab", { name: "Tracker", exact: true }),
  ).toBeFocused();
  await expect(
    page.getByRole("tab", { name: "Tracker", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
});
