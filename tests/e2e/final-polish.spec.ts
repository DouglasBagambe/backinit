import { test, expect } from "@playwright/test";

test("domain and brand open Home, and Watch has its distinct navigation", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/$/);
  await page.locator("header .nav-watch").click();
  await expect(page).toHaveURL(/\/watch$/);
  await expect(page.locator("header .nav-watch")).toContainText("Watch");
  await page.locator("header .brand").click();
  await expect(page).toHaveURL(/\/$/);
});

test("Settings controls change appearance and persist match timezone without unavailable placeholders", async ({
  page,
}) => {
  await page.goto("/settings");
  await page
    .getByRole("group", { name: "Choose appearance" })
    .getByRole("button", { name: "Dark", exact: true })
    .click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page
    .getByLabel("Timezone", { exact: true })
    .selectOption("Europe/London");
  await page.reload();
  await expect(page.getByLabel("Timezone", { exact: true })).toHaveValue(
    "Europe/London",
  );
  await expect(
    page.getByText(/temporarily unavailable|not connected|planned for/),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Clear saved events", exact: true }),
  ).toHaveCount(0);
});

test("new visitor makes an explicit cookie choice; essentials never enables tracking", async ({
  page,
  baseURL,
}) => {
  await page
    .context()
    .addCookies([{ name: "backinit-edition", value: "real", url: baseURL! }]);
  await page.goto("/privacy");
  await page.evaluate(() =>
    localStorage.removeItem("backinit-ad-preference-v3"),
  );
  const ads: string[] = [];
  await page.route(
    /https:\/\/(czernik\.org|capitalhospitals\.org|juvenilechoice\.com)\//,
    (r) => {
      ads.push(r.request().url());
      return r.fulfill({ contentType: "text/javascript", body: "" });
    },
  );
  await page.goto("/watch");
  const dialog = page.getByRole("dialog", { name: "Cookie preferences" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button")).toHaveCount(2);
  await page.keyboard.press("Escape");
  await expect(dialog).toBeVisible();
  expect(ads).toEqual([]);
  await dialog
    .getByRole("button", { name: "Essential only", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  expect(
    await page.evaluate(() =>
      localStorage.getItem("backinit-ad-preference-v3"),
    ),
  ).toBe("declined");
  await page.reload();
  await expect(dialog).toHaveCount(0);
  expect(ads).toEqual([]);
});
