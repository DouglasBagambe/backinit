import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import AxeBuilder from "@axe-core/playwright";
test("account favorites survive sign-out and a fresh session; member cannot administer", async ({
  page,
  request,
}) => {
  const email = `fan-${Date.now()}@example.test`;
  await page.goto("/profile");
  await page
    .getByRole("button", { name: "Create an account", exact: true })
    .click();
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page
    .getByLabel("Password", { exact: true })
    .fill("backinit-long-test-password");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page.getByText(`Signed in as ${email}`)).toBeVisible();
  await page.goto("/scores");
  await page
    .getByRole("button", { name: "Save Arsenal vs Liverpool", exact: true })
    .click();
  await page.goto("/profile");
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page
    .getByLabel("Password", { exact: true })
    .fill("backinit-long-test-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByText(`Signed in as ${email}`)).toBeVisible();
  await page.goto("/favorites");
  await expect(
    page.locator(".match-teams").filter({ hasText: "Arsenal" }),
  ).toBeVisible();
  await page.goto("/settings");
  await page
    .getByRole("button", { name: "Clear saved events", exact: true })
    .click();
  await expect(page.getByRole("status")).toHaveText("Saved events cleared.");
  await page.reload();
  const saved = await page.request.get("/api/account/favorites");
  expect((await saved.json()).data).toEqual([]);
  await page.goto("/admin");
  await expect(
    page.getByRole("heading", { name: "Administrator access required." }),
  ).toBeVisible();
  expect((await page.request.get("/api/admin/sources")).status()).toBe(403);
  expect((await request.get("/api/admin/sources")).status()).toBe(401);
  expect(
    (
      await request.post("/api/account/login", {
        data: { email, password: "backinit-long-test-password" },
        headers: { Origin: "https://evil.test" },
      })
    ).status(),
  ).toBe(403);
});
test("guest team follows shape the home feed and persist", async ({ page }) => {
  await page.goto("/search");
  await page
    .getByRole("navigation", { name: "Explore directories" })
    .getByRole("link", { name: "Teams", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Follow Arsenal", exact: true })
    .click();
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Your matchday", exact: true }),
  ).toBeVisible();
  await page.goto("/teams");
  await expect(
    page.getByRole("button", { name: "Unfollow Arsenal", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
});
test("DASH source selection initializes an in-page video and source failures are retryable", async ({
  page,
}) => {
  await page.route("https://dash.akamaized.net/**", (r) => r.abort());
  await page.goto("/playback");
  await page
    .getByLabel("Stream source", { exact: true })
    .selectOption("bbb-dash");
  // Selecting a source starts playback immediately; there is no second start step.
  await expect(page.locator("video")).toBeVisible();
  await expect(page.getByRole("status")).toContainText("Playback unavailable", {
    timeout: 30000,
  });
  // Media teardown can deliver late progress events after an error. They must
  // not turn a failed source back into a blank "ready" or buffering player.
  await page.locator("video").evaluate((video) => {
    for (const type of ["error", "pause", "waiting", "canplay"])
      video.dispatchEvent(new Event(type));
  });
  await expect(page.getByRole("status")).toContainText("Playback unavailable");
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(page.locator("video")).toBeVisible();
});
const pages = [
  "/",
  "/live",
  "/scores",
  "/fixtures",
  "/news",
  "/watch",
  "/videos",
  "/playback",
  "/favorites",
  "/search",
  "/settings",
  "/profile",
  "/admin",
  "/competitions",
  "/teams",
  "/athletes",
  "/privacy",
  "/sport/football",
  "/sport/wwe",
  "/sport/formula-1",
  "/sport/tennis",
  "/match/north-london",
  "/match/wwe-showcase",
  "/match/grand-prix",
];
for (const theme of ["light", "dark"] as const) {
  test(`all pages fit mobile and desktop in ${theme}`, async ({ page }) => {
    test.setTimeout(180000);
    await page.goto("/settings");
    await page
      .locator("footer")
      .getByRole("button", { name: theme, exact: true })
      .click();
    for (const width of [360, 390, 430, 768, 1024, 1440, 1920]) {
      await page.setViewportSize({ width, height: 1000 });
      for (const path of pages) {
        await page.goto(path);
        await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
        await expect(page.locator("main")).toBeVisible();
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
          `${path} ${theme} ${width}`,
        ).toBe(true);
        await expect(
          page.locator("header").getByRole("button", { name: /theme/i }),
        ).toHaveCount(0);
        if (
          [360, 1440].includes(width) &&
          ["/", "/profile", "/match/north-london", "/watch"].includes(path)
        )
          await page.screenshot({
            path: `artifacts/review-${theme}-${width}-${path.replaceAll("/", "_") || "home"}.png`,
            fullPage: true,
            animations: "disabled",
          });
      }
    }
  });
  test(`account, directories and admin accessibility in ${theme}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/settings");
    await page
      .locator("footer")
      .getByRole("button", { name: theme, exact: true })
      .click();
    for (const path of ["/profile", "/admin", "/teams", "/athletes"]) {
      await page.goto(path);
      const result = await new AxeBuilder({ page }).analyze();
      expect(
        result.violations
          .filter((v) => ["serious", "critical"].includes(v.impact || ""))
          .map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
        path,
      ).toEqual([]);
    }
  });
}

test("administrator edits, audits and revokes a source through the protected UI", async ({
  page,
}) => {
  const email = `operator-${Date.now()}@example.test`;
  const password = "backinit-operator-test-password";
  const registration = await page.request.post("/api/account/register", {
    headers: { Origin: String(test.info().project.use.baseURL) },
    data: { email, password },
  });
  expect(registration.status()).toBe(201);
  const { user } = await registration.json();
  execFileSync(
    process.execPath,
    ["scripts/account-role.mjs", user.id, "admin"],
    { env: { ...process.env, DATABASE_PATH: process.env.E2E_DATABASE_PATH } },
  );
  expect((await page.request.get("/api/account/me")).status()).toBe(401);
  await page.goto("/profile");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByText(`Signed in as ${email}`)).toBeVisible();
  await page.goto("/admin");
  await page.getByRole("button", { name: "Add source", exact: true }).click();
  const values = {
    "Source ID": "browser-test-source",
    "Display name": "Browser test film",
    "Player URL": "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
    "Rights owner": "Blender Foundation",
    "Rights evidence URL": "https://peach.blender.org/",
  };
  for (const [label, value] of Object.entries(values))
    await page.getByLabel(label, { exact: true }).fill(value);
  await page.getByRole("combobox", { name: /^Content/ }).selectOption("test");
  await page
    .getByLabel("Revoked (unavailable to viewers)", { exact: true })
    .uncheck();
  await page.getByRole("button", { name: "Save source", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText(
    "Source saved. Change recorded in audit log.",
  );
  expect(
    (await (await page.request.get("/api/streams")).json()).data.some(
      (s: { id: string }) => s.id === "browser-test-source",
    ),
  ).toBe(true);
  await page
    .getByRole("button", { name: "Edit browser-test-source", exact: true })
    .click();
  await page
    .getByLabel("Revoked (unavailable to viewers)", { exact: true })
    .check();
  await page.getByRole("button", { name: "Save source", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText(
    "Source saved. Change recorded in audit log.",
  );
  expect(
    (await (await page.request.get("/api/streams")).json()).data.some(
      (s: { id: string }) => s.id === "browser-test-source",
    ),
  ).toBe(false);
  await expect(
    page
      .getByRole("row")
      .filter({ hasText: "browser-test-source" })
      .filter({
        has: page.getByRole("cell", { name: "source.revoke", exact: true }),
      })
      .first(),
  ).toBeVisible();
});

test("account outages preserve guest storage and prevent unsynchronized edits", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      "backinit-favorites",
      JSON.stringify(["north-london"]),
    ),
  );
  await page.route("**/api/account/me", (r) =>
    r.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ message: "Account service unavailable" }),
    }),
  );
  await page.goto("/watch");
  await expect(page.locator(".account-notice")).toHaveCount(0);
  await page.goto("/profile");
  await expect(
    page.getByRole("heading", { name: "Accounts are temporarily unavailable" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Sign in", exact: true }),
  ).toHaveCount(0);
  await page.goto("/favorites");
  await expect(
    page.getByText(
      "Saved items are temporarily unavailable. Please try again. Your saved preferences are unchanged.",
    ),
  ).toBeVisible();
  expect(
    await page.evaluate(() => localStorage.getItem("backinit-favorites")),
  ).toBe('["north-london"]');
});

test("calendar export labels demo events and rejects missing events", async ({
  request,
}) => {
  const response = await request.get("/api/calendar/north-london");
  expect(response.status()).toBe(200);
  const body = await response.text();
  expect(body).toContain("SUMMARY:DEMO: Arsenal vs Liverpool");
  expect(body).toContain("BEGIN:VEVENT");
  expect((await request.get("/api/calendar/missing-event")).status()).toBe(404);
});
