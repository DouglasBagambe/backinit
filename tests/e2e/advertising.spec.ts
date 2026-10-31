import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const key = "b9e9a122a56fe6638c4236bbf4696b47";
test("native advertising uses the original direct tag once, only after consent, and withdraws", async ({
  page,
  baseURL,
}) => {
  await page
    .context()
    .addCookies([{ name: "backinit-edition", value: "real", url: baseURL! }]);
  const requests: string[] = [];
  // Intercept all ad traffic: no real impressions, clicks or advertiser visits.
  await page.route("https://czernik.org/**", (route) => {
    requests.push(route.request().url());
    return route.fulfill({
      contentType: "text/javascript",
      body: `const host = document.getElementById("container-${key}"); const ad = document.createElement("a"); ad.href = "https://advertiser.example"; ad.textContent = "Native advertising fixture"; host?.append(ad);`,
    });
  });
  await page.goto("/news");
  await expect(
    page.getByRole("region", { name: "Advertising preferences" }),
  ).toBeVisible();
  expect(requests).toHaveLength(0);
  await page.getByRole("button", { name: "Decline ads", exact: true }).click();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Ad preferences", exact: true }),
  ).toBeVisible();
  expect(requests).toHaveLength(0);
  await page
    .getByRole("button", { name: "Ad preferences", exact: true })
    .click();
  await page.getByRole("button", { name: "Allow ads", exact: true }).click();
  const slot = page.locator(".ad-slot-banner");
  await slot.scrollIntoViewIfNeeded();
  await expect(
    page.getByRole("link", { name: "Native advertising fixture" }),
  ).toBeVisible();
  expect(requests).toEqual([`https://czernik.org/21/${key}`]);
  await expect(page.locator(`#container-${key}`)).toHaveCount(1);
  await expect(page.locator("iframe[title='Advertisement']")).toHaveCount(0);
  await expect(
    page.locator(`script[src='https://czernik.org/21/${key}']`),
  ).toHaveAttribute("data-cfasync", "false");
  const sponsor = page.getByRole("link", { name: "Sponsored offers" });
  await expect(sponsor).toHaveAttribute("rel", /sponsored/);
  await expect(sponsor).toHaveAttribute("target", "_blank");
  await page.setViewportSize({ width: 303, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page
    .getByRole("button", { name: "Ad preferences", exact: true })
    .click();
  await expect(page.locator(`#container-${key}`)).toHaveCount(0);
  await page.getByRole("button", { name: "Decline ads", exact: true }).click();
  await page.reload();
  await expect(page.locator(`#container-${key}`)).toHaveCount(0);
  expect(requests).toHaveLength(1);
  const audit = await new AxeBuilder({ page }).analyze();
  expect(
    audit.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    ),
  ).toEqual([]);
});

test("empty native responses leave no blank ad space or account-page ad", async ({
  page,
  baseURL,
}) => {
  await page
    .context()
    .addCookies([{ name: "backinit-edition", value: "real", url: baseURL! }]);
  await page.route("https://czernik.org/**", (route) =>
    route.fulfill({ contentType: "text/javascript", body: "" }),
  );
  await page.goto("/news");
  await page.getByRole("button", { name: "Allow ads", exact: true }).click();
  await page.locator(".ad-slot-banner").scrollIntoViewIfNeeded();
  await expect(page.locator(`#container-${key}`)).toHaveCount(1);
  await expect(page.locator(`#container-${key}`)).toHaveCount(0, {
    timeout: 15000,
  });
  await expect(page.getByText("Advertisement", { exact: true })).toHaveCount(0);
  await page.goto("/profile");
  await expect(page.locator(".ad-native")).toHaveCount(0);
});
