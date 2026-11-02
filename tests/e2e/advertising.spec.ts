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
    if (!route.request().url().includes("/21/"))
      return route.fulfill({ contentType: "text/javascript", body: "" });
    requests.push(route.request().url());
    return route.fulfill({
      contentType: "text/javascript",
      body: `document.documentElement.dataset.nativeAdFixture="loaded";const host = document.getElementById("container-${key}"); const ad = document.createElement("a"); ad.href = "https://advertiser.example"; ad.textContent = "Native advertising fixture"; host?.append(ad);`,
    });
  });
  await page.goto("/news");
  await expect(
    page.getByRole("region", { name: "Cookie preferences" }),
  ).toBeVisible();
  expect(requests).toHaveLength(0);
  const sponsor = page.getByRole("link", { name: "Sponsored offers" });
  await expect(sponsor).toHaveAttribute(
    "href",
    "https://asiafilm.org/4/03e480f030ce8a18c8c3de500ca10b7d",
  );
  await expect(sponsor).toHaveAttribute("rel", /sponsored/);
  await page
    .getByRole("button", { name: "Essential only", exact: true })
    .click();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Cookie settings", exact: true }),
  ).toBeVisible();
  expect(requests).toHaveLength(0);
  await expect(sponsor).toBeVisible();
  await page
    .getByRole("button", { name: "Cookie settings", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Accept cookies", exact: true })
    .click();
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
  await expect(sponsor).toHaveAttribute("rel", /sponsored/);
  await expect(sponsor).toHaveAttribute("target", "_blank");
  await page.setViewportSize({ width: 303, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page
    .getByRole("button", { name: "Cookie settings", exact: true })
    .click();
  await expect(page.locator(`#container-${key}`)).toHaveCount(0);
  await expect(page.locator("html")).not.toHaveAttribute(
    "data-native-ad-fixture",
    "loaded",
  );
  await page
    .getByRole("button", { name: "Essential only", exact: true })
    .click();
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
  await page
    .getByRole("button", { name: "Accept cookies", exact: true })
    .click();
  await page.locator(".ad-slot-banner").scrollIntoViewIfNeeded();
  await expect(page.locator(`#container-${key}`)).toHaveCount(1);
  await expect(page.locator(`#container-${key}`)).toHaveCount(0, {
    timeout: 15000,
  });
  await expect(page.getByText("Advertisement", { exact: true })).toHaveCount(0);
  await page.goto("/profile");
  await expect(page.locator(".ad-native")).toHaveCount(0);
});

test("Home and popular pages have fitting display ads, with no duplicate tag or config collision", async ({
  page,
  baseURL,
}) => {
  await page
    .context()
    .addCookies([{ name: "backinit-edition", value: "real", url: baseURL! }]);
  const requests: string[] = [];
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("https://capitalhospitals.org/**", (route) =>
    route.fulfill({ contentType: "text/javascript", body: "" }),
  );
  await page.route("https://czernik.org/**", (route) => {
    const url = route.request().url();
    requests.push(url);
    if (!url.includes("/22/"))
      return route.fulfill({ contentType: "text/javascript", body: "" });
    const key = url.split("/").at(-1);
    return route.fulfill({
      contentType: "text/javascript",
      body: `(()=>{const options=window.atOptions;if(options.key!==${JSON.stringify(key)})throw new Error('Banner configuration collision');const frame=document.createElement('iframe');frame.title='Display ad fixture';frame.width=options.width;frame.height=options.height;document.currentScript.parentElement.append(frame);})()`,
    });
  });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");
  expect(requests).toHaveLength(0);
  await page
    .getByRole("button", { name: "Accept cookies", exact: true })
    .click();
  const top = page.locator(".display-ad-leaderboard").first();
  await top.scrollIntoViewIfNeeded();
  await expect(top.getByTitle("Display ad fixture")).toBeVisible();
  await expect(top.getByTitle("Display ad fixture")).toHaveAttribute(
    "width",
    "728",
  );
  expect(
    requests.filter((url) => url.endsWith("208c83c78501d240404891d74ed085e2")),
  ).toHaveLength(1);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(top.getByTitle("Display ad fixture")).toHaveAttribute(
    "width",
    "320",
  );
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(top.getByTitle("Display ad fixture")).toHaveAttribute(
    "width",
    "320",
  );
  expect(
    requests.filter((url) => url.endsWith("208c83c78501d240404891d74ed085e2")),
  ).toHaveLength(1);
  for (const path of [
    "/fixtures",
    "/live",
    "/scores",
    "/watch",
    "/news",
    "/videos",
  ]) {
    await page.goto(path);
    await expect(
      page
        .locator(".display-ad-leaderboard")
        .first()
        .getByTitle("Display ad fixture"),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page
    .locator(".display-ad-leaderboard")
    .first()
    .scrollIntoViewIfNeeded();
  await expect(
    page
      .locator(".display-ad-leaderboard")
      .first()
      .getByTitle("Display ad fixture"),
  ).toHaveAttribute("width", "320");
  await page
    .locator(".display-ad-leaderboard")
    .first()
    .screenshot({ path: "artifacts/ads-home-mobile.png" });
  await page.goto("/profile");
  await expect(
    page.locator(".ad-display,.ad-native,script[data-backinit-ad-format]"),
  ).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("interactive ad tags are delayed, consent-gated, capped across reloads and excluded from player/account pages", async ({
  page,
  baseURL,
}) => {
  await page
    .context()
    .addCookies([{ name: "backinit-edition", value: "real", url: baseURL! }]);
  await page.clock.install({ time: new Date("2026-11-02T12:00:00Z") });
  const tags: string[] = [];
  await page.route("https://czernik.org/**", (route) => {
    if (route.request().url().includes("/14/")) tags.push("social");
    return route.fulfill({
      contentType: "text/javascript",
      body: "document.documentElement.dataset.interactiveAdFixture = 'loaded';",
    });
  });
  await page.route("https://capitalhospitals.org/**", (route) => {
    tags.push("popunder");
    return route.fulfill({ contentType: "text/javascript", body: "" });
  });
  await page.goto("/watch");
  await page.clock.fastForward(31000);
  expect(tags).toEqual([]);
  await page
    .getByRole("button", { name: "Accept cookies", exact: true })
    .click();
  await page.clock.fastForward(16000);
  expect(tags).toEqual([]);
  await page.clock.fastForward(15000);
  await expect.poll(() => tags).toEqual(["popunder"]);
  await page.reload();
  await page.clock.fastForward(31000);
  expect(tags).toEqual(["popunder"]);
  await page.goto("/news");
  await expect(
    page.getByRole("button", { name: "Cookie settings", exact: true }),
  ).toBeVisible();
  await page.clock.fastForward(16000);
  await expect.poll(() => tags).toEqual(["popunder", "social"]);
  await expect(page.locator("html")).toHaveAttribute(
    "data-interactive-ad-fixture",
    "loaded",
  );
  await page.getByRole("link", { name: "Guest profile", exact: true }).click();
  await expect(page).toHaveURL(/\/profile$/);
  await expect(page.locator("html")).not.toHaveAttribute(
    "data-interactive-ad-fixture",
    "loaded",
  );
  await page.goto("/news");
  await expect(
    page.getByRole("button", { name: "Cookie settings", exact: true }),
  ).toBeVisible();
  await page.clock.fastForward(16000);
  expect(tags).toEqual(["popunder", "social"]);
  await page.goto("/profile");
  await page.clock.fastForward(31000);
  expect(tags).toEqual(["popunder", "social"]);
  await expect(page.locator("script[data-backinit-ad-format]")).toHaveCount(0);
});

test("resizing during an in-flight banner keeps the original configuration until the script settles", async ({
  page,
  baseURL,
}) => {
  await page
    .context()
    .addCookies([{ name: "backinit-edition", value: "real", url: baseURL! }]);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  const requests: string[] = [];
  await page.route("https://czernik.org/**", async (route) => {
    const url = route.request().url();
    if (!url.includes("/22/"))
      return route.fulfill({ contentType: "text/javascript", body: "" });
    const requested = url.split("/").at(-1)!;
    requests.push(requested);
    if (requested === "208c83c78501d240404891d74ed085e2") await pending;
    await route.fulfill({
      contentType: "text/javascript",
      body: `(()=>{const o=window.atOptions;if(o.key!==${JSON.stringify(requested)})throw Error('Late banner configuration collision');const frame=document.createElement('iframe');frame.title='Delayed banner fixture';frame.width=o.width;frame.height=o.height;document.currentScript.parentElement.append(frame)})()`,
    });
  });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Accept cookies", exact: true })
    .click();
  await page
    .locator(".display-ad-leaderboard")
    .first()
    .scrollIntoViewIfNeeded();
  await expect
    .poll(() => requests.includes("208c83c78501d240404891d74ed085e2"))
    .toBe(true);
  // The footer choice can bring the sidebar into view before the header.
  const requestsBeforeResize = requests.length;
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.locator(".display-ad-leaderboard .ad-display > div").first(),
  ).toHaveCSS("width", "320px");
  expect(requests).toHaveLength(requestsBeforeResize);
  release();
  await expect(
    page
      .locator(".display-ad-leaderboard")
      .getByTitle("Delayed banner fixture"),
  ).toHaveAttribute("width", "320");
  expect(errors).toEqual([]);
});
