import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { execFileSync } from "node:child_process";
import { sports } from "../../packages/domain/src/index";
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
  await page.locator(".watch-options summary").click();
  await page
    .getByLabel("Viewing timezone", { exact: true })
    .selectOption("Africa/Kampala");
  await expect(
    page.getByRole("heading", { name: "No streams available" }),
  ).toBeVisible();
  await expect(page.locator(".live-event-row")).toHaveCount(0);
  await expect(page.locator("iframe,video")).toHaveCount(0);
  await page.goto(`/watch/${priority}`);
  await expect(page).toHaveURL(new RegExp(`/watch/${priority}$`));
  await expect(
    page.locator(".player-tracker-fallback .event-tracker"),
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
  await expect(page.locator(".event-switcher")).not.toContainText(
    "Manchester City",
  );
  const city = verifiedCupFixtures.find(
    (e) => e.kind === "score" && e.home === "Manchester City",
  )!;
  await page.goto(`/watch/${city.id}`);
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
test("compact discovery shows matches immediately and every sport stays reachable on narrow screens", async ({
  page,
  baseURL,
}) => {
  await real(page, baseURL!);
  await page.clock.setFixedTime(new Date("2026-10-28T06:00:00Z"));
  await page.route("**/api/watch*", (route) =>
    route.fulfill({
      json: {
        data: verifiedCupFixtures.map((event) => ({
          event,
          availability: "in-page",
          sources: [
            {
              id: `ci-${event.id}`,
              name: "CI playback contract",
              type: "embed",
              content: "official",
              url: "https://example.test/embed",
              eventId: event.id,
              presentation: "live",
              rightsOwner: "CI fixture only",
              rightsEvidence: "https://example.test/terms",
              validFrom: "2026-10-28T00:00:00Z",
              validUntil: "2026-10-29T00:00:00Z",
              territory: "WORLD",
              revoked: false,
              version: 1,
            },
          ],
        })),
        coverage: [],
        generatedAt: "2026-10-28T06:00:00Z",
      },
    }),
  );
  for (const width of [360, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 740 });
    await page.goto("/watch?date=2026-10-28");
    await expect(page.locator(".live-event-row").first()).toBeVisible();
    const visibleRows = await page
      .locator(".live-event-row")
      .evaluateAll(
        (rows) =>
          rows.filter(
            (row) => row.getBoundingClientRect().bottom < innerHeight - 60,
          ).length,
      );
    expect(visibleRows).toBeGreaterThanOrEqual(3);
    await expect(page.locator(".sidebar")).toHaveCount(0);
    const images = page.locator(".sports-nav img");
    await expect(images).toHaveCount(sports.length + 3);
    await expect
      .poll(() =>
        images.evaluateAll((nodes) =>
          nodes.every(
            (n) =>
              (n as HTMLImageElement).complete &&
              (n as HTMLImageElement).naturalWidth > 0,
          ),
        ),
      )
      .toBe(true);
    await page.locator(".sports-picker > summary").click();
    const picker = page.getByRole("navigation", { name: "Choose sport" });
    for (const sport of sports)
      await expect(
        picker.getByRole("link", { name: sport, exact: true }),
      ).toBeVisible();
    await picker.getByRole("link", { name: "Baseball", exact: true }).click();
    await expect(page).toHaveURL(/sport=Baseball.*range=upcoming/);
    await expect(
      page.getByRole("heading", { name: "No streams available" }),
    ).toBeVisible();
    await expect(page.locator(".sports-picker")).not.toHaveAttribute(
      "open",
      "",
    );
  }
  await page.setViewportSize({ width: 360, height: 740 });
  await page
    .getByRole("button", { name: "Toggle navigation", exact: true })
    .click();
  await page
    .getByRole("navigation", { name: "More navigation" })
    .getByRole("link", { name: "fixtures", exact: true })
    .click();
  await expect(page).toHaveURL(/\/fixtures$/);
  await page.goto("/watch?sport=MMA");
  await page
    .getByRole("button", { name: "Upcoming events", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "No streams available" }),
  ).toBeVisible();
  await page.goto(`/watch/${priority}`);
  const unavailablePlayer = page.locator(".player-unavailable");
  await expect(unavailablePlayer).toBeVisible();
  const player = await unavailablePlayer.boundingBox();
  expect(player!.height).toBeLessThan(440);
  await expect(
    unavailablePlayer.getByLabel("Match tracker", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".viewing-options")).toBeVisible();
});
test("admin sources require verification, match only their fixture, expose retry/fallback and honor revocation", async ({
  page,
  baseURL,
}) => {
  await real(page, baseURL!);
  await page.clock.install();
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
  // Isolated discovery candidate: exercises review without publishing or claiming live playback.
  const candidate = {
    id: "discovered-ci-court",
    name: "Discovered CI court",
    type: "embed",
    url: "https://www.youtube-nocookie.com/embed/epxkdYuTSqU",
    content: "sports",
    eventId: priority,
    presentation: "live",
    rightsOwner: "CI publisher",
    rightsEvidence: "https://example.test/rights",
    validFrom: new Date(Date.now() - 1000).toISOString(),
    validUntil: new Date(Date.now() + 3600000).toISOString(),
    territory: "PROVIDER",
    revoked: true,
    version: 1,
  };
  await page.route("**/api/admin/fixtures", (route) =>
    route.fulfill({
      json: { data: verifiedCupFixtures, candidates: [candidate] },
    }),
  );
  await page.goto("/admin");
  await page
    .getByRole("button", { name: "Review Discovered CI court", exact: true })
    .click();
  await expect(page.getByLabel("Player URL", { exact: true })).toHaveValue(
    candidate.url,
  );
  await expect(page.getByLabel("Event fixture", { exact: true })).toHaveValue(
    priority,
  );
  const unsaved = await (await page.request.get("/api/admin/sources")).json();
  expect(
    unsaved.data.some((source: { id: string }) => source.id === candidate.id),
  ).toBe(false);
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
  await page.clock.fastForward(61000);
  await expect(page.getByLabel("Stream source", { exact: true })).toHaveCount(
    0,
  );
  // Both media requests are deliberately aborted. After revocation, retain the
  // main tracker and retry control rather than leaving a failed video surface.
  await expect(
    page.locator(".player-tracker-fallback .event-tracker"),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Retry", exact: true }),
  ).toBeVisible();
  expect(
    (
      await (await page.request.get(`/api/streams?event=${priority}`)).json()
    ).data.some((s: { id: string }) => s.id === fallback.id),
  ).toBe(false);
});

test("Watch excludes unavailable events and replays while keeping live broadcasts across midnight", async ({
  page,
  baseURL,
}) => {
  await real(page, baseURL!);
  await page.clock.setFixedTime(new Date("2026-10-28T12:00:00Z"));
  const event = {
    id: "live-long-court",
    externalId: "court",
    kind: "card",
    sport: "Badminton",
    competition: "Test contract only",
    title: "Long-running court session",
    start: "2026-10-27T21:00:00Z",
    status: "live",
    provenance: "provider",
    bouts: [],
    source: {
      provider: "Browser test fixture",
      url: "https://example.test/court",
      license: "CI fixture only",
      fetchedAt: "2026-10-28T12:00:00Z",
      stale: false,
    },
  };
  const source = {
    id: "browser-test-live",
    name: "CI source contract",
    type: "embed",
    content: "official",
    eventId: event.id,
    presentation: "live",
    url: "https://example.test/embed",
    rightsOwner: "CI fixture only",
    rightsEvidence: "https://example.test/terms",
    validFrom: "2026-10-27T20:00:00Z",
    validUntil: "2026-10-29T20:00:00Z",
    territory: "WORLD",
    revoked: false,
    version: 1,
  };
  await page.route("**/api/watch*", (route) =>
    route.fulfill({
      json: {
        data: [
          { event, sources: [source], availability: "in-page" },
          {
            event: { ...event, id: "no-stream", title: "Unstreamed event" },
            sources: [],
            availability: "unavailable",
          },
          {
            event: { ...event, id: "replay-only", title: "Replay only event" },
            sources: [{ ...source, presentation: "replay" }],
            availability: "unavailable",
          },
        ],
        coverage: [],
        generatedAt: "2026-10-28T12:00:00Z",
      },
    }),
  );
  await page.goto("/watch");
  await expect(page.locator(".live-event-list")).toContainText(event.title);
  await page.getByRole("button", { name: "Live", exact: true }).click();
  await expect(page.locator(".live-event-list")).toContainText(event.title);
  await expect(page.locator(".live-event-row")).toHaveCount(1);
  await expect(page.locator(".live-event-list")).toContainText("Watch live");
  await expect(page.locator(".live-event-list")).not.toContainText(
    "Unstreamed event",
  );
  await expect(page.locator(".live-event-list")).not.toContainText(
    "Replay only event",
  );
});

test("bottle-green dark mode persists without exposing preview controls", async ({
  page,
}) => {
  await page.goto("/watch");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("button", { name: /Green [123]/ })).toHaveCount(
    0,
  );
  const dark = page
    .locator("footer")
    .getByRole("button", { name: "dark", exact: true });
  await dark.click();
  await expect(dark).toHaveAttribute("aria-pressed", "true");
  expect(
    await page.evaluate(() =>
      getComputedStyle(document.documentElement)
        .getPropertyValue("--bg")
        .trim(),
    ),
  ).toBe("#071713");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.reload();
  await expect(dark).toHaveAttribute("aria-pressed", "true");
});
