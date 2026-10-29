import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import type { StreamSource } from "../../packages/domain/src/index";
// Isolated browser fixtures; production catalog always uses real provider responses.
const examples: StreamSource[] = [
  {
    id: "yt-wwe-fixture",
    name: "Best of The Undertaker: Full Match Marathon",
    type: "embed",
    url: "https://www.youtube-nocookie.com/embed/PM5UPYoDvf0",
    content: "official",
    eventId: null,
    rightsOwner: "WWE",
    rightsEvidence: "https://www.youtube.com/watch?v=PM5UPYoDvf0",
    validFrom: "2026-01-01T00:00:00Z",
    validUntil: "2099-01-01T00:00:00Z",
    territory: "PROVIDER",
    version: 1,
    revoked: false,
    catalog: {
      sport: "WWE",
      publisher: "WWE",
      channelId: "UCJ5v_MCY6GNUBTO8-D3XoAg",
      publishedAt: null,
      thumbnail: "https://i.ytimg.com/vi/PM5UPYoDvf0/hqdefault.jpg",
      watchUrl: "https://www.youtube.com/watch?v=PM5UPYoDvf0",
      category: "Full match",
      checkedAt: "2026-10-28T00:00:00Z",
    },
  },
  {
    id: "yt-ufc-fixture",
    name: "Demetrious Johnson vs Joseph Benavidez | FULL FIGHT",
    type: "embed",
    url: "https://www.youtube-nocookie.com/embed/ah4Wiz2HqCI",
    content: "official",
    eventId: null,
    rightsOwner: "UFC",
    rightsEvidence: "https://www.youtube.com/watch?v=ah4Wiz2HqCI",
    validFrom: "2026-01-01T00:00:00Z",
    validUntil: "2099-01-01T00:00:00Z",
    territory: "PROVIDER",
    version: 1,
    revoked: false,
    catalog: {
      sport: "MMA",
      publisher: "UFC",
      channelId: "UCvgfXK4nTYKudb0rFR6noLA",
      publishedAt: null,
      thumbnail: "https://i.ytimg.com/vi/ah4Wiz2HqCI/hqdefault.jpg",
      watchUrl: "https://www.youtube.com/watch?v=ah4Wiz2HqCI",
      category: "Full fight",
      checkedAt: "2026-10-28T00:00:00Z",
    },
  },
];
async function catalog(page: import("@playwright/test").Page, baseURL: string) {
  await page
    .context()
    .addCookies([{ name: "backinit-edition", value: "real", url: baseURL }]);
  await page.route("**/api/videos", (route) =>
    route.fulfill({ json: { data: examples, coverage: [] } }),
  );
  await page.route("**/api/streams?library=1", (route) =>
    route.fulfill({ json: { data: examples } }),
  );
  await page.route("**/api/streams/*/health", (route) =>
    route.fulfill({
      json: {
        status: "metadata-available",
        message: "Embed playback depends on provider restrictions.",
      },
    }),
  );
}
test("Watch leads with official sport, filters videos and handles player failure after consent", async ({
  page,
  baseURL,
}) => {
  await catalog(page, baseURL!);
  let requests = 0;
  await page.route("https://www.youtube.com/iframe_api", (route) => {
    requests++;
    return route.abort();
  });
  await page.goto("/videos");
  await expect(
    page.getByRole("heading", { name: "Replays & highlights", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Load official player", exact: true }),
  ).toBeVisible();
  expect(requests).toBe(0);
  await expect(page.locator("iframe")).toHaveCount(0);
  await page
    .getByLabel("Filter videos by sport", { exact: true })
    .selectOption("MMA");
  await expect(
    page.locator(".watch-feature > .section-heading h2"),
  ).toContainText("Demetrious Johnson");
  await expect(page.locator(".watch-card")).toHaveCount(1);
  await page
    .getByRole("button", { name: "Load official player", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "official player could not load",
  );
  expect(requests).toBe(1);
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await expect.poll(() => requests).toBe(2);
  await expect(
    page.getByRole("link", { name: "Open official source ↗", exact: true }),
  ).toHaveAttribute("href", examples[1]!.rightsEvidence);
  await expect(
    page.getByRole("button", { name: "Load test player", exact: true }),
  ).toBeHidden();
});
for (const theme of ["light", "dark"]) {
  test(`official viewing fits mobile and desktop and remains accessible in ${theme}`, async ({
    page,
    baseURL,
  }) => {
    await catalog(page, baseURL!);
    await page.goto("/videos");
    await page
      .locator("footer")
      .getByRole("button", { name: theme, exact: true })
      .click();
    for (const width of [360, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await expect(
        page.getByRole("button", { name: "Load official player", exact: true }),
      ).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      const results = await new AxeBuilder({ page }).analyze();
      expect(
        results.violations
          .filter((v) => ["serious", "critical"].includes(v.impact || ""))
          .map((v) => ({ id: v.id, targets: v.nodes.map((n) => n.target) })),
      ).toEqual([]);
      if ([360, 1440].includes(width))
        await page.screenshot({
          path: `artifacts/viewing-${process.env.E2E_BROWSER || "chromium"}-${theme}-${width}.png`,
          fullPage: true,
        });
    }
  });
}
test("recovery codes reset access, privacy export excludes secrets, and account deletion revokes sessions", async ({
  page,
}) => {
  const email = `recovery-${Date.now()}@example.test`;
  let password = "Eight!42";
  await page.goto("/profile");
  await page
    .getByRole("button", { name: "Create an account", exact: true })
    .click();
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page.getByText(`Signed in as ${email}`)).toBeVisible();
  await page.getByText("Change password", { exact: true }).click();
  await page.getByLabel("Current password", { exact: true }).fill(password);
  await page.getByLabel("New password", { exact: true }).fill("Change42");
  await page
    .getByRole("button", { name: "Change password and sign out", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Sign in", exact: true }),
  ).toBeVisible();
  password = "Change42";
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByText(`Signed in as ${email}`)).toBeVisible();
  await page.getByText("Recovery codes", { exact: true }).click();
  await page
    .getByLabel("Current password for recovery codes", { exact: true })
    .fill(password);
  await page
    .getByRole("button", { name: "Generate recovery codes", exact: true })
    .click();
  const codes = page.locator(".recovery-codes code");
  await expect(codes).toHaveCount(5);
  const code = (await codes.first().textContent())!;
  await page
    .getByRole("checkbox", {
      name: "Notify me in BackInIt about my saved sport",
      exact: true,
    })
    .check();
  await expect(
    page.locator(".notification-panel").getByRole("status"),
  ).toContainText("Match updates enabled.");
  const exported = await (await page.request.get("/api/account/export")).json();
  expect(exported.account.email).toBe(email);
  expect(JSON.stringify(exported)).not.toContain(code);
  expect(exported.notificationPreferences.enabled).toBe(1);
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await page
    .getByRole("button", {
      name: "Forgot password? Use a recovery code",
      exact: true,
    })
    .click();
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Recovery code", { exact: true }).fill(code);
  const next = "Reset!42";
  await page.getByLabel("New password", { exact: true }).fill(next);
  await page
    .getByRole("button", { name: "Reset password", exact: true })
    .click();
  await expect(
    page.getByText(
      "Password reset. All sessions were signed out. Use your new password to sign in.",
      { exact: true },
    ),
  ).toBeVisible();
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(next);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByText(`Signed in as ${email}`)).toBeVisible();
  await page.getByText("Delete account", { exact: true }).click();
  await page
    .getByLabel("Password to delete account", { exact: true })
    .fill(next);
  await page
    .getByLabel("Type DELETE to confirm", { exact: true })
    .fill("DELETE");
  await page
    .getByRole("button", { name: "Permanently delete my account", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Sign in", exact: true }),
  ).toBeVisible();
  expect((await page.request.get("/api/account/me")).status()).toBe(401);
});
