import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { execFileSync } from "node:child_process";
import { verifiedCupFixtures } from "../../apps/api/src/providers/efl";
const priority = "efl-20261028-liverpool-chelsea";
async function real(page: Page, baseURL: string) {
  await page
    .context()
    .addCookies([{ name: "backinit-edition", value: "real", url: baseURL }]);
}
test("official cup discovery gives Kampala kickoffs, no false live player and fast event switching", async ({
  page,
  baseURL,
}) => {
  await real(page, baseURL!);
  await page.clock.setFixedTime(new Date("2026-10-28T06:00:00Z"));
  await page.goto("/watch?date=2026-10-28");
  await page
    .getByLabel("Viewing timezone", { exact: true })
    .selectOption("Africa/Kampala");
  await expect(page.locator(".live-spotlight")).toContainText("23:00");
  for (const [home, time] of [
    ["Manchester City", "22:30"],
    ["AFC Bournemouth", "22:45"],
    ["Fulham", "22:45"],
    ["Sunderland", "22:45"],
  ])
    await expect(
      page.locator(".live-event-row").filter({ hasText: home }),
    ).toContainText(time!);
  await expect(
    page.getByRole("button", { name: /Load test player/ }),
  ).toHaveCount(0);
  await expect(page.locator("iframe,video")).toHaveCount(0);
  await page
    .getByRole("link", { name: "Open match & viewing options", exact: true })
    .click();
  await expect(page).toHaveURL(new RegExp(`/watch/${priority}$`));
  await expect(
    page.getByRole("heading", {
      name: "No in-page broadcast available",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.locator(".event-viewing-header")).toContainText("23:00");
  await expect(page.locator(".viewing-options")).toContainText(
    "UK coverage confirmed",
  );
  await expect(page.locator(".viewing-options")).toContainText(
    "partner directory, not confirmation",
  );
  await expect(page.locator("iframe,video")).toHaveCount(0);
  const calendar = await (
    await page.request.get(`/api/calendar/${priority}`)
  ).text();
  expect(calendar).toContain("DTSTART:20261028T200000Z");
  await page
    .locator(".event-switcher")
    .getByRole("link", { name: /Manchester City/ })
    .click();
  await expect(
    page.getByRole("heading", { name: /Manchester City.*Brighton/ }),
  ).toBeVisible();
  await expect(page.locator(".event-viewing-header")).toContainText("22:30");
});
for (const theme of ["light", "dark"]) {
  test(`live discovery and viewing are accessible and responsive in ${theme}`, async ({
    page,
    baseURL,
  }) => {
    await real(page, baseURL!);
    await page.clock.setFixedTime(new Date("2026-10-28T06:00:00Z"));
    for (const path of ["/watch?date=2026-10-28", `/watch/${priority}`]) {
      await page.goto(path);
      await page
        .locator("footer")
        .getByRole("button", { name: theme, exact: true })
        .click();
      for (const width of [360, 390, 768, 1440]) {
        await page.setViewportSize({ width, height: 1000 });
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
        const result = await new AxeBuilder({ page }).analyze();
        expect(
          result.violations
            .filter((v) => ["serious", "critical"].includes(v.impact || ""))
            .map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
        ).toEqual([]);
        if ([390, 1440].includes(width))
          await page.screenshot({
            path: `artifacts/live-${process.env.E2E_BROWSER || "chromium"}-${path.startsWith("/watch?") ? "discovery" : "event"}-${theme}-${width}.png`,
            fullPage: false,
          });
      }
    }
  });
}
test("admin sources require verification, match only their fixture, expose retry/fallback and honor revocation", async ({
  page,
  baseURL,
}) => {
  await real(page, baseURL!);
  const origin = baseURL!;
  const email = `live-operator-${Date.now()}@example.test`;
  const password = "backinit-live-operator-password";
  const registration = await page.request.post("/api/account/register", {
    headers: { Origin: origin },
    data: { email, password },
  });
  expect(registration.status()).toBe(201);
  const { user } = await registration.json();
  execFileSync(
    process.execPath,
    ["scripts/account-role.mjs", user.id, "admin"],
    { env: { ...process.env, DATABASE_PATH: process.env.E2E_DATABASE_PATH } },
  );
  await page.goto("/profile");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByText(`Signed in as ${email}`)).toBeVisible();
  await page.goto("/admin");
  await page.getByRole("button", { name: "Add source", exact: true }).click();
  for (const [label, value] of Object.entries({
    "Source ID": "event-browser-a",
    "Display name": "CI source A",
    "Player URL": "https://media.backinit.test/a.m3u8",
    "Rights owner": "CI test operator",
    "Rights evidence URL": "https://rights.example.test/ci-fixture",
  }))
    await page.getByLabel(label, { exact: true }).fill(value);
  await page
    .getByLabel("Event fixture", { exact: true })
    .selectOption(priority);
  await page.getByRole("button", { name: "Save source", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText(
    "Source saved. Change recorded in audit log.",
  );
  const records = await (await page.request.get("/api/admin/sources")).json();
  const source = records.data.find(
    (s: { id: string }) => s.id === "event-browser-a",
  );
  expect(source.fixtureRef.externalId).toBe(priority);
  const post = (path: string, data: unknown) =>
    page.request.post(path, { headers: { Origin: origin }, data });
  expect(
    (await post("/api/admin/sources", { ...source, revoked: false })).status(),
  ).toBe(400);
  // Simulated administrator evidence tests the authorization/state pipeline only.
  // Real decoded playback is checked separately against permitted public test feeds.
  expect(
    (
      await post("/api/admin/source-check", {
        id: source.id,
        version: source.version,
        result: "passed",
        method: "native-decoded",
        currentTime: 2,
        width: 640,
        height: 360,
        live: true,
        browser: "CI simulated evidence",
      })
    ).status(),
  ).toBe(201);
  await page.reload();
  await page
    .getByRole("button", { name: `Edit ${source.id}`, exact: true })
    .click();
  await page
    .getByLabel("Revoked (unavailable to viewers)", { exact: true })
    .uncheck();
  await page.getByRole("button", { name: "Save source", exact: true }).click();
  let active = await (
    await page.request.get(`/api/streams?event=${priority}`)
  ).json();
  expect(active.data.map((s: { id: string }) => s.id)).toEqual([source.id]);
  const fallback = {
    ...source,
    id: "event-browser-b",
    name: "CI source B",
    url: "https://media.backinit.test/b.m3u8",
    revoked: true,
  };
  expect((await post("/api/admin/sources", fallback)).status()).toBe(201);
  expect(
    (
      await post("/api/admin/source-check", {
        id: fallback.id,
        version: 1,
        result: "passed",
        method: "native-decoded",
        currentTime: 2,
        width: 640,
        height: 360,
        live: true,
        browser: "CI simulated evidence",
      })
    ).status(),
  ).toBe(201);
  expect(
    (
      await post("/api/admin/sources", { ...fallback, revoked: false })
    ).status(),
  ).toBe(201);
  expect(
    (
      await (
        await page.request.get(
          `/api/streams?event=${verifiedCupFixtures[0]!.id}`,
        )
      ).json()
    ).data,
  ).toEqual([]);
  await page.route("https://media.backinit.test/**", (route) => route.abort());
  await page.goto(`/watch/${priority}`);
  await expect(page.getByRole("status")).toContainText("Playback unavailable", {
    timeout: 30000,
  });
  await page
    .getByRole("button", { name: "Try next source", exact: true })
    .click();
  await expect(page.getByLabel("Stream source", { exact: true })).toHaveValue(
    fallback.id,
  );
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  active = await (
    await page.request.get(`/api/streams?event=${priority}`)
  ).json();
  const current = active.data.find((s: { id: string }) => s.id === fallback.id);
  expect(
    (await post("/api/admin/sources", { ...current, revoked: true })).status(),
  ).toBe(201);
  await page.reload();
  await expect(page.getByLabel("Stream source", { exact: true })).toHaveValue(
    source.id,
  );
  expect(
    (
      await (await page.request.get(`/api/streams?event=${priority}`)).json()
    ).data.some((s: { id: string }) => s.id === fallback.id),
  ).toBe(false);
});
