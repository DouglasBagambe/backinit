import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { verifiedCupFixtures } from "../../apps/api/src/providers/efl";
const fixture = verifiedCupFixtures.find((e) =>
  e.id.includes("liverpool-chelsea"),
)!;
const source = {
  provider: "Browser contract fixture",
  url: "https://example.test",
  license: "Isolated test only",
  fetchedAt: "2026-10-28T20:05:00Z",
  stale: false,
};
const event = {
  ...fixture,
  status: "live",
  scheduleOnly: false,
  clock: "5′",
  homeScore: 1,
  awayScore: 0,
  source,
  detail: {
    timeline: [
      { id: "goal-1", clock: "5′", text: "Goal reported by the test provider" },
    ],
  },
};
test("Watch offers Track for real match updates and updates the main tracker without creating a broadcast", async ({
  page,
  baseURL,
}) => {
  await page
    .context()
    .addCookies([{ name: "backinit-edition", value: "real", url: baseURL! }]);
  await page.clock.setFixedTime(new Date("2026-10-28T20:05:00Z"));
  await page.route("**/api/trackers/*", (route) =>
    route.fulfill({ json: { data: null } }),
  );
  await page.route("**/api/watch*", (route) =>
    route.fulfill({
      json: {
        data: [{ event, sources: [], availability: "unavailable" }],
        coverage: [],
        generatedAt: source.fetchedAt,
      },
    }),
  );
  await page.route(`**/api/events/${fixture.id}`, (route) =>
    route.fulfill({ json: { data: event } }),
  );
  await page.goto("/watch");
  const row = page.locator(".live-event-row");
  await expect(row).toHaveCount(1);
  await expect(row).toContainText("Track");
  await expect(row).not.toContainText("Watch live");
  await row.click();
  await expect(
    page.locator(".player-tracker-fallback .event-tracker"),
  ).toBeVisible();
  await page.clock.fastForward(31000);
  await expect(
    page.locator(".player-tracker-fallback .tracker-score"),
  ).toHaveText("1:0");
  await expect(page.locator(".tracker-report")).toContainText(
    "Goal reported by the test provider",
  );
  await expect(page.locator("iframe,video")).toHaveCount(0);
  await page.route(`**/api/events/${fixture.id}`, (route) =>
    route.fulfill({
      json: {
        data: {
          ...event,
          homeScore: 2,
          clock: "8′",
          detail: {
            timeline: [
              { id: "goal-2", clock: "8′", text: "Second goal confirmed" },
            ],
          },
        },
      },
    }),
  );
  await page.clock.fastForward(31000);
  await expect(page.locator(".tracker-score")).toHaveText("2:0");
  await expect(page.locator(".tracker-report")).toContainText(
    "Second goal confirmed",
  );
  for (const width of [303, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.route(`**/api/events/${fixture.id}`, (route) =>
    route.fulfill({
      json: {
        data: {
          ...event,
          sport: "Tennis",
          homeScore: null,
          awayScore: null,
          detail: { periods: [{ label: "Set 1", home: "0", away: "2" }] },
        },
      },
    }),
  );
  await page.clock.fastForward(31000);
  await expect(page.locator(".tracker-score")).toHaveText("0:2");
  await expect(
    page.getByRole("region", { name: "Set scores", exact: true }),
  ).toContainText("Set 1");
  await expect(page.locator(".tracker-arena")).toHaveCSS("height", "280px");
  await page.route(`**/api/events/${fixture.id}`, (route) =>
    route.fulfill({ status: 503, json: { message: "Temporary outage" } }),
  );
  await page.clock.fastForward(31000);
  await expect(page.locator(".tracker-clock")).toHaveText("Last update");
  await expect(page.locator(".tracker-score")).toHaveText("0:2");
  const axe = await new AxeBuilder({ page }).analyze();
  expect(
    axe.violations
      .filter((v) => ["serious", "critical"].includes(v.impact || ""))
      .map((v) => v.id),
  ).toEqual([]);
  await page.screenshot({ path: "artifacts/tracker-no-broadcast.png" });
});
test("a broadcast keeps its tracker beside desktop video and below mobile video, with a white icon-only Play control", async ({
  page,
  baseURL,
}) => {
  await page
    .context()
    .addCookies([{ name: "backinit-edition", value: "real", url: baseURL! }]);
  await page.route("**/api/trackers/*", (route) =>
    route.fulfill({ json: { data: null } }),
  );
  await page.route(`**/api/streams?event=${fixture.id}`, (route) =>
    route.fulfill({
      json: {
        data: [
          {
            id: "official-ci-tracker",
            name: "Test publisher",
            type: "embed",
            url: "https://www.youtube-nocookie.com/embed/PM5UPYoDvf0",
            content: "sports",
            eventId: fixture.id,
            presentation: "live",
            rightsOwner: "Test only",
            rightsEvidence: "https://example.test",
            territory: "PROVIDER",
            validFrom: "2026-01-01T00:00:00Z",
            validUntil: "2099-01-01T00:00:00Z",
            version: 1,
            revoked: false,
          },
        ],
      },
    }),
  );
  await page.route("**/api/streams/official-ci-tracker/health", (route) =>
    route.fulfill({
      json: { status: "metadata-available", message: "Test metadata" },
    }),
  );
  await page.route("https://www.youtube.com/iframe_api", (route) =>
    route.abort(),
  );
  await page.route("https://czernik.org/**", (route) =>
    route.fulfill({ body: "", contentType: "application/javascript" }),
  );
  await page.addInitScript(() =>
    localStorage.setItem("backinit-ad-preference-v1", "accepted"),
  );
  await page.goto(`/watch/${fixture.id}`);
  const play = page.getByRole("button", { name: "Play video", exact: true });
  await expect(play).toBeVisible();
  await expect(play).toHaveText("");
  expect(
    await play.evaluate((n) => ({
      color: getComputedStyle(n).color,
      background: getComputedStyle(n).backgroundColor,
    })),
  ).toEqual({ color: "rgb(255, 255, 255)", background: "rgba(0, 0, 0, 0)" });
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(
    page.locator(".event-desktop-tracker .event-tracker"),
  ).toBeVisible();
  await expect(
    page.locator(".event-mobile-tracker .event-tracker"),
  ).toBeHidden();
  await expect(page.locator(".event-side .sponsored-card")).toBeVisible();
  await expect(page.locator(".official-embed iframe, video")).toHaveCount(0);
  await page.screenshot({ path: "artifacts/tracker-broadcast-desktop.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.locator(".event-mobile-tracker .event-tracker"),
  ).toBeVisible();
  await expect(
    page.locator(".event-desktop-tracker .event-tracker"),
  ).toBeHidden();
  await page.screenshot({
    path: "artifacts/tracker-broadcast-mobile.png",
    fullPage: true,
  });
});

test("publisher tracker uses only a matched frame, preserves it across lease refresh and falls back on expiry", async ({
  page,
  baseURL,
}) => {
  await page
    .context()
    .addCookies([{ name: "backinit-edition", value: "real", url: baseURL! }]);
  await page.clock.setFixedTime(new Date("2026-10-28T20:05:00Z"));
  await page.route(`**/api/events/${fixture.id}`, (route) =>
    route.fulfill({ json: { data: event } }),
  );
  let refreshes = 0,
    frames = 0;
  await page.route("**/api/trackers/*", (route) => {
    refreshes++;
    return route.fulfill({
      json: {
        data: {
          provider: "SportScore",
          kind: "publisher-tracker",
          eventId: fixture.id,
          url: "https://sportscore.com/embed/tracker/football/liverpool-vs-chelsea/",
          sourceUrl: "https://sportscore.com/",
          checkedAt: "2026-10-28T20:05:00Z",
          validUntil: new Date(
            Date.parse("2026-10-28T20:05:00Z") +
              120000 +
              (refreshes - 1) * 60000,
          ).toISOString(),
        },
      },
    });
  });
  await page.route("https://sportscore.com/embed/tracker/**", (route) => {
    frames++;
    return route.fulfill({
      contentType: "text/html",
      body: "<html><body>Isolated publisher tracker test</body></html>",
    });
  });
  await page.goto(`/watch/${fixture.id}`);
  await expect(
    page.locator(".player-tracker-fallback .event-tracker"),
  ).toBeVisible();
  await page.clock.fastForward(31000);
  await expect(
    page.getByRole("region", { name: "Live match tracker", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".publisher-tracker iframe")).toHaveAttribute(
    "sandbox",
    "allow-scripts allow-same-origin allow-popups",
  );
  await expect(page.locator(".publisher-tracker-footer")).toHaveCount(0);
  for (const width of [303, 390, 650, 700, 980, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    const height = await page
      .locator(".publisher-tracker iframe")
      .evaluate((n) => n.getBoundingClientRect().height);
    expect(height).toBeGreaterThanOrEqual(420);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.clock.fastForward(61000);
  await expect.poll(() => refreshes).toBeGreaterThan(1);
  expect(frames).toBe(1);
  await page.route(`**/api/events/${fixture.id}`, (route) =>
    route.fulfill({ status: 503, json: { data: null } }),
  );
  await page.clock.fastForward(31000);
  await expect(page.locator(".publisher-tracker iframe")).toHaveCount(1);
  expect(frames).toBe(1);
  await page.route(`**/api/events/${fixture.id}`, (route) =>
    route.fulfill({ json: { data: event } }),
  );
  await page.clock.fastForward(31000);
  await expect(page.locator(".publisher-tracker iframe")).toHaveCount(1);
  await page.route("**/api/trackers/*", (route) =>
    route.fulfill({ json: { data: null } }),
  );
  await page.clock.fastForward(61000);
  await expect(page.locator(".publisher-tracker iframe")).toHaveCount(0);
  await expect(
    page.locator(".player-tracker-fallback .event-tracker"),
  ).toBeVisible();
});

test("a slow publisher navigation stays mounted and recovers without another request", async ({
  page,
  baseURL,
}) => {
  await page
    .context()
    .addCookies([{ name: "backinit-edition", value: "real", url: baseURL! }]);
  await page.clock.setFixedTime(new Date("2026-10-28T20:05:00Z"));
  await page.route(`**/api/events/${fixture.id}`, (route) =>
    route.fulfill({ json: { data: event } }),
  );
  await page.route("**/api/trackers/*", (route) =>
    route.fulfill({
      json: {
        data: {
          provider: "SportScore",
          kind: "publisher-tracker",
          eventId: fixture.id,
          url: "https://sportscore.com/embed/tracker/football/liverpool-vs-chelsea/",
          sourceUrl: "https://sportscore.com/",
          checkedAt: "2026-10-28T20:05:00Z",
          validUntil: "2026-10-28T20:07:00Z",
        },
      },
    }),
  );
  let finishLoad: () => void = () => {};
  const delayed = new Promise<void>((resolve) => {
    finishLoad = resolve;
  });
  let requests = 0;
  await page.route("https://sportscore.com/embed/tracker/**", async (route) => {
    requests++;
    await delayed;
    await route.fulfill({
      contentType: "text/html",
      body: `<html><body>Delayed publisher view<button onclick="parent.postMessage({type:'sportscore:resize',height:740}, '*')">Resize tracker</button></body></html>`,
    });
  });
  await page.goto(`/watch/${fixture.id}`, { waitUntil: "domcontentloaded" });
  await expect(
    page.locator(".player-tracker-fallback .event-tracker"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Statistics", exact: true }).click();
  await page.getByRole("button", { name: "Overview", exact: true }).click();
  await page.clock.fastForward(31000);
  const frame = page.locator(".publisher-tracker iframe");
  await expect(frame).toHaveCount(1);
  await expect.poll(() => requests).toBe(1);
  await expect(page.locator(".tracker-recovery .tracker-score")).toHaveText(
    "1:0",
  );
  await expect(
    page.getByText("Loading live animation…", { exact: true }),
  ).toBeVisible();
  await frame.evaluate((n) => {
    n.setAttribute("data-test-instance", "original");
  });
  await page.clock.fastForward(21000);
  await expect(
    page.getByText(
      "Live animation is taking longer to load. Scores keep updating.",
    ),
  ).toBeVisible();
  await expect(frame).toHaveCount(1);
  finishLoad();
  const publisher = page.frameLocator(".publisher-tracker iframe");
  await expect(
    publisher.getByText("Delayed publisher view", { exact: false }),
  ).toBeVisible();
  await expect(page.locator(".tracker-recovery")).toHaveCount(0);
  await expect(frame).toHaveAttribute("data-test-instance", "original");
  expect(requests).toBe(1);
  await publisher.getByRole("button", { name: "Resize tracker" }).click();
  await expect(frame).toHaveCSS("height", "740px");
  await page.evaluate(() =>
    window.postMessage({ type: "sportscore:resize", height: 1100 }, "*"),
  );
  await expect(frame).toHaveCSS("height", "740px");
  await page
    .getByRole("button", { name: "Match summary", exact: true })
    .click();
  await expect(page.locator(".tracker-recovery .tracker-score")).toHaveText(
    "1:0",
  );
  await expect(frame).toHaveAttribute("aria-hidden", "true");
  await page
    .getByRole("button", { name: "Live animation", exact: true })
    .click();
  await expect(page.locator(".tracker-recovery")).toHaveCount(0);
  await expect(frame).toHaveAttribute("data-test-instance", "original");
  await page
    .getByRole("button", { name: "Match summary", exact: true })
    .click();
  await page.evaluate(() => {
    document.documentElement.dataset.theme =
      document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  });
  await expect.poll(() => requests).toBe(2);
  await expect(
    page.getByRole("button", { name: "Live animation", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".tracker-recovery .tracker-score")).toHaveText(
    "1:0",
  );
});
