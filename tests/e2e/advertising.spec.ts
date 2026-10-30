import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("advertising respects consent, adapts to available space, and withdraws immediately", async ({
  page,
  baseURL,
}) => {
  await page
    .context()
    .addCookies([{ name: "backinit-edition", value: "real", url: baseURL! }]);
  const requests: string[] = [];
  // Never generate real ad impressions or click revenue during automated tests.
  await page.route("https://czernik.org/**", (route) => {
    requests.push(route.request().url());
    return route.fulfill({
      contentType: "text/javascript",
      body: `const ad = document.createElement("a"); ad.href = "https://advertiser.example"; ad.textContent = "Isolated advertising fixture"; document.body.append(ad);`,
    });
  });
  await page.goto("/news");
  await expect(
    page.getByRole("region", { name: "Advertising preferences" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Sponsored offers" }),
  ).toHaveCount(0);
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
  const sponsor = page.getByRole("link", { name: "Sponsored offers" });
  await expect(sponsor).toHaveAttribute(
    "href",
    "https://asiafilm.org/4/03e480f030ce8a18c8c3de500ca10b7d",
  );
  await expect(sponsor).toHaveAttribute("target", "_blank");
  await expect(sponsor).toHaveAttribute("rel", /sponsored/);
  const slot = page.locator(".ad-slot-banner");
  await slot.scrollIntoViewIfNeeded();
  const frame = page.getByTitle("Advertisement", { exact: true });
  await expect(frame).toBeVisible();
  await expect.poll(() => requests.length).toBeGreaterThan(0);
  expect(await frame.getAttribute("sandbox")).not.toContain(
    "allow-same-origin",
  );
  expect(await frame.getAttribute("sandbox")).not.toContain(
    "allow-top-navigation",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await slot.scrollIntoViewIfNeeded();
  await expect(frame).toHaveAttribute("width", "320");
  await page.setViewportSize({ width: 303, height: 844 });
  await expect(frame).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page
    .getByRole("button", { name: "Ad preferences", exact: true })
    .click();
  await page.getByRole("button", { name: "Decline ads", exact: true }).click();
  const count = requests.length;
  await page.reload();
  await expect(frame).toHaveCount(0);
  expect(requests).toHaveLength(count);
  const audit = await new AxeBuilder({ page }).analyze();
  expect(
    audit.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    ),
  ).toEqual([]);
});

test("empty provider responses collapse without leaving blank advertising space", async ({
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
  await expect(page.locator(".ad-loading iframe")).toHaveCount(1);
  await expect(page.getByTitle("Advertisement", { exact: true })).toHaveCount(
    0,
    { timeout: 15000 },
  );
  await expect(page.getByText("Advertisement", { exact: true })).toHaveCount(0);
  await page.goto("/profile");
  await expect(page.getByTitle("Advertisement", { exact: true })).toHaveCount(
    0,
  );
});
