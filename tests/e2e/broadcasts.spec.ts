import { verifiedCupFixtures } from "../../apps/api/src/providers/efl";
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
const now = Date.now();
const items = Array.from({ length: 6 }, (_, i) => ({
  id: `ppv-${i + 1}`,
  title: `Match ${i + 1}`,
  category: i === 5 ? "Basketball" : "Football",
  competition: "Weekend league",
  poster: null,
  start: now + 3600000,
  end: now + 10800000,
  channel: i === 4,
  viewers: 20 + i,
  pageUrl: `https://ppv.st/live/match-${i + 1}`,
  sources: [
    {
      id: `main-${i}`,
      label: "HD",
      url: `https://taifood-blog.asia/embed/match-${i + 1}`,
    },
    {
      id: `sd-${i}`,
      label: "SD",
      url: `https://taifood-blog.asia/embed/match-${i + 1}-sd`,
    },
  ],
  replay: false,
}));
test.beforeEach(async ({ page, baseURL }) => {
  await page
    .context()
    .addCookies([{ name: "backinit-edition", value: "real", url: baseURL! }]);
  await page.route("**/api/broadcasts", (r) =>
    r.fulfill({
      json: { data: items, updatedAt: new Date().toISOString(), stale: false },
    }),
  );
  await page.route("https://taifood-blog.asia/**", (r) =>
    r.fulfill({
      contentType: "text/html",
      body: '<body style="background:#10231f;color:white">Embedded broadcast fixture</body>',
    }),
  );
});
test("all upcoming broadcasts are searchable, open source choices and preserve provider iframe behavior", async ({
  page,
}) => {
  await page.goto("/broadcasts");
  await expect(
    page.getByRole("heading", { name: "Broadcasts", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".broadcast-card")).toHaveCount(5);
  await page
    .getByRole("textbox", { name: "Search broadcasts" })
    .fill("Match 2");
  await expect(page.locator(".broadcast-card")).toHaveCount(1);
  await page.locator(".broadcast-card").click();
  await expect(page).toHaveURL(/watch\/ppv-2/);
  await expect(
    page.getByRole("heading", { name: "Match 2", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".broadcast-screen iframe")).toHaveCount(0);
  await page.getByRole("button", { name: "Play Match 2", exact: true }).click();
  await expect(page.locator(".broadcast-screen iframe")).toHaveAttribute(
    "src",
    items[1]!.sources[0]!.url,
  );
  await expect(page.locator(".broadcast-screen iframe")).not.toHaveAttribute(
    "sandbox",
    /.*/,
  );
  await expect(page.locator(".broadcast-player .player-brand")).toBeVisible();
  await page
    .getByLabel("Stream for Match 2", { exact: true })
    .selectOption("sd-1");
  await expect(page.locator(".broadcast-screen iframe")).toHaveCount(0);
  await page.getByRole("button", { name: "Play Match 2", exact: true }).click();
  await expect(page.locator(".broadcast-screen iframe")).toHaveAttribute(
    "src",
    items[1]!.sources[1]!.url,
  );
  await page.getByRole("button", { name: "Stop Match 2", exact: true }).click();
  await expect(page.locator(".broadcast-screen iframe")).toHaveCount(0);
  await expect(
    page.getByText("21 watching across PPV", { exact: false }),
  ).toBeVisible();
});
test("multiview adds, focuses, removes and restores independent streams on mobile without overflow", async ({
  page,
}) => {
  await page.goto("/multiview");
  await page.getByRole("button", { name: "3 streams", exact: true }).click();
  await expect(page.locator(".multiview-tile")).toHaveCount(3);
  await page
    .getByRole("button", { name: "Add stream", exact: true })
    .first()
    .click();
  await page
    .getByRole("textbox", { name: "Search", exact: true })
    .fill("Match 1");
  await page.locator(".stream-chooser-list button").click();
  await page
    .getByRole("button", { name: "Add stream", exact: true })
    .first()
    .click();
  await page
    .getByRole("textbox", { name: "Search", exact: true })
    .fill("Match 2");
  await page.locator(".stream-chooser-list button").click();
  await page.getByRole("button", { name: "Focus", exact: true }).click();
  await page.getByRole("button", { name: "Make main", exact: true }).click();
  await expect(
    page.locator(".multiview-tile").first().getByRole("heading"),
  ).toHaveText("Match 2");
  await page.getByRole("button", { name: "Play Match 2", exact: true }).click();
  await page.getByRole("button", { name: "Play Match 1", exact: true }).click();
  await expect(page.locator(".broadcast-screen iframe")).toHaveCount(2);
  await page
    .getByRole("button", { name: "Remove stream 2", exact: true })
    .click();
  await expect(page.locator(".broadcast-screen iframe")).toHaveCount(1);
  await page.reload();
  await expect(
    page.locator(".multiview-tile").first().getByRole("heading"),
  ).toHaveText("Match 2");
  await expect(page.locator(".broadcast-screen iframe")).toHaveCount(0);
  await page.setViewportSize({ width: 360, height: 800 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: "artifacts/ppv-multiview-mobile.png" });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: "artifacts/ppv-multiview-desktop.png" });
  const audit = await new AxeBuilder({ page }).analyze();
  expect(
    audit.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    ),
  ).toEqual([]);
  await page.goto("/multiview?n=3&streams=ppv-1,,ppv-3");
  await expect(
    page.locator(".multiview-tile").nth(2).getByRole("heading"),
  ).toHaveText("Match 3");
  await expect(
    page
      .locator(".multiview-tile")
      .nth(1)
      .getByRole("button", { name: "Add stream", exact: true }),
  ).toBeVisible();
  await page
    .locator(".multiview-tile")
    .nth(1)
    .getByRole("button", { name: "Add stream", exact: true })
    .click();
  const chooserAudit = await new AxeBuilder({ page }).analyze();
  expect(
    chooserAudit.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    ),
  ).toEqual([]);
});
test("failed catalogue shows recovery, and archives are sports replays rather than invented highlights", async ({
  page,
}) => {
  await page.route("**/api/broadcasts", (r) =>
    r.fulfill({
      status: 503,
      json: {
        data: [],
        updatedAt: null,
        stale: true,
        message: "Broadcast catalogue unavailable",
      },
    }),
  );
  await page.goto("/broadcasts");
  await expect(page.getByRole("status")).toContainText(
    "Broadcast catalogue unavailable",
  );
  await expect(
    page.getByRole("button", { name: "Retry", exact: true }),
  ).toBeVisible();
  await page.goto("/videos");
  await expect(
    page.getByRole("heading", { name: "More sports replays" }),
  ).toBeVisible();
  await expect(page.locator(".broadcast-archive-card")).toHaveCount(4);
  await expect(page.locator(".broadcast-archive-card").first()).toHaveAttribute(
    "target",
    "_blank",
  );
});

test("Watch presents imported upcoming games first instead of a contradictory empty stream list", async ({
  page,
}) => {
  await page.route("**/api/watch*", (r) =>
    r.fulfill({
      json: { data: [], coverage: [], fetchedAt: new Date().toISOString() },
    }),
  );
  await page.goto("/watch?sport=Football&range=upcoming");
  await expect(page.locator(".broadcast-card")).toHaveCount(4);
  await expect(
    page.getByRole("heading", { name: "No streams available", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Watch", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: "Search broadcasts" })
    .fill("Match 2");
  await expect(page.locator(".broadcast-card")).toHaveCount(1);
});

test("Watch separates sports channels, recognizes marquee games and keeps discovery paginated", async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date(now));
  const regular = Array.from({ length: 15 }, (_, i) => ({
    ...items[0]!,
    id: `ppv-${100 + i}`,
    title: `Ordinary match ${i + 1}`,
    channel: false,
  }));
  const marquee = {
    ...items[0]!,
    id: "ppv-200",
    title: "Chelsea vs Manchester United",
    competition: "Premier League",
    start: now + 24 * 3600000,
    end: now + 26 * 3600000,
  };
  const live = {
    ...items[0]!,
    id: "ppv-201",
    title: "Ordinary live game",
    start: now - 3600000,
    end: now + 3600000,
  };
  const channel = {
    ...items[0]!,
    id: "ppv-202",
    title: "NFL Network",
    category: "American Football",
    channel: true,
    start: 0,
    end: 0,
  };
  await page.route("**/api/broadcasts", (r) =>
    r.fulfill({
      json: {
        data: [...regular, live, marquee, channel],
        updatedAt: new Date(now).toISOString(),
        stale: false,
      },
    }),
  );
  await page.goto("/watch");
  await expect(
    page.getByRole("button", { name: "Today", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page
    .getByRole("button", { name: "Next 48 hours", exact: true })
    .click();
  await expect(page.locator(".broadcast-card")).toHaveCount(12);
  await expect(page.locator(".broadcast-card h3").first()).toHaveText(
    "Chelsea vs Manchester United",
  );
  await expect(
    page
      .locator(".broadcast-card")
      .first()
      .getByText("Big match", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "NFL Network", exact: true }),
  ).toHaveCount(0);
  const pages = page.getByRole("navigation", { name: "Broadcast pages" });
  await pages.getByRole("button", { name: "Next", exact: true }).click();
  await expect(pages).toContainText("Page 2 of 2");
  await expect(page.locator(".broadcast-card")).toHaveCount(5);
  await page.locator(".broadcast-more-filters > summary").click();
  await page
    .getByRole("combobox", { name: "Order", exact: true })
    .selectOption("Kickoff time");
  await page.locator(".broadcast-more-filters > summary").click();
  await page.getByRole("button", { name: "Tomorrow", exact: true }).click();
  await expect(page.locator(".broadcast-card")).toHaveCount(1);
  await expect(page.locator(".broadcast-card h3")).toHaveText(
    "Chelsea vs Manchester United",
  );
  await page
    .getByRole("navigation", { name: "Watch sections" })
    .getByRole("link", { name: "Sports channels", exact: true })
    .click();
  await expect(page.locator(".broadcast-card")).toHaveCount(1);
  await expect(page.locator(".broadcast-card h3")).toHaveText("NFL Network");
  await expect(page.getByRole("group", { name: "Match dates" })).toHaveCount(0);
  await page.setViewportSize({ width: 360, height: 800 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("Watch date order is exact, Today excludes yesterday and replays stay inside Watch", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem("backinit-timezone", "UTC"),
  );
  await page.clock.setFixedTime(new Date("2026-11-02T12:00:00Z"));
  const base = items[0]!;
  const data = [
    {
      ...base,
      id: "ppv-300",
      title: "Today's live",
      start: Date.parse("2026-11-02T11:00:00Z"),
      end: Date.parse("2026-11-02T14:00:00Z"),
    },
    {
      ...base,
      id: "ppv-301",
      title: "Today's upcoming",
      start: Date.parse("2026-11-02T18:00:00Z"),
      end: Date.parse("2026-11-02T20:00:00Z"),
    },
    {
      ...base,
      id: "ppv-302",
      title: "Yesterday's ongoing",
      start: Date.parse("2026-11-01T23:00:00Z"),
      end: Date.parse("2026-11-02T14:00:00Z"),
    },
  ];
  await page.route("**/api/broadcasts", (r) =>
    r.fulfill({
      json: { data, updatedAt: new Date().toISOString(), stale: false },
    }),
  );
  await page.route("**/api/videos", (r) => r.fulfill({ json: { data: [] } }));
  await page.goto("/watch");
  const dates = page.getByRole("group", { name: "Match dates" });
  await expect(dates.getByRole("button")).toHaveText([
    "All",
    "Live now",
    "Today",
    "Next 48 hours",
    "Tomorrow",
    "This week",
  ]);
  await expect(page.locator(".broadcast-card")).toHaveCount(2);
  await expect(
    page.getByRole("button", { name: "Today", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await dates.getByRole("button", { name: "Live now", exact: true }).click();
  await expect(page.locator(".broadcast-card")).toHaveCount(2);
  await expect(
    page.locator(".broadcast-card").filter({ hasText: "Today's upcoming" }),
  ).toHaveCount(0);
  await expect(
    page.getByText("Major matchups first, then live action and kickoff time."),
  ).toHaveCount(0);
  await page
    .getByRole("navigation", { name: "Watch sections" })
    .getByRole("link", { name: "Replays & highlights", exact: true })
    .click();
  await expect(page).toHaveURL(/\/watch\?view=replays$/);
  await expect(
    page.getByRole("heading", { name: "Browse videos", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Watch sections" }),
  ).toBeVisible();
  await expect(
    page.locator(".broadcast-card[href^='/watch/ppv-']"),
  ).toHaveCount(0);
  await expect(page.getByRole("group", { name: "Match dates" })).toHaveCount(0);
});
test("a matched real fixture shows one compact tracker beside or below the stream, and can become the main view", async ({
  page,
}) => {
  const event = {
    ...verifiedCupFixtures[0]!,
    kind: "score",
    id: "ci-broadcast-football",
    home: "Chelsea",
    away: "Manchester United",
    status: "live",
    scheduleOnly: false,
    start: new Date(now - 3600000).toISOString(),
    end: new Date(now + 3600000).toISOString(),
    homeScore: 1,
    awayScore: 0,
    provenance: "provider",
    source: {
      provider: "CI",
      url: "https://example.test",
      license: "CI fixture",
      fetchedAt: new Date(now).toISOString(),
      stale: false,
    },
  };
  await page.route("**/api/broadcasts/*/event", (r) =>
    r.fulfill({ json: { data: event } }),
  );
  await page.route("**/api/events/ci-broadcast-football", (r) =>
    r.fulfill({ json: { data: event } }),
  );
  await page.route("**/api/trackers/ci-broadcast-football", (r) =>
    r.fulfill({ json: { data: null } }),
  );
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/watch/ppv-2");
  await expect(
    page.locator(".broadcast-view-layout > aside .broadcast-match-tracker"),
  ).toBeVisible();
  await expect(page.locator(".broadcast-match-tracker")).toHaveCount(1);
  await page.setViewportSize({ width: 360, height: 800 });
  await expect(
    page.locator(".broadcast-view-layout > div .broadcast-match-tracker"),
  ).toBeVisible();
  await page
    .getByRole("group", { name: "Viewing mode" })
    .getByRole("button", { name: "Match tracker", exact: true })
    .click();
  await expect(page.locator(".broadcast-player")).toHaveCount(0);
  await expect(page.getByLabel("Match tracker", { exact: true })).toBeVisible();
  await page.route("**/api/broadcasts", (r) =>
    r.fulfill({
      json: {
        data: items.map((item) =>
          item.id === "ppv-2" ? { ...item, sources: [] } : item,
        ),
        updatedAt: new Date().toISOString(),
        stale: false,
      },
    }),
  );
  await page.reload();
  await expect(page.getByLabel("Match tracker", { exact: true })).toBeVisible();
  await expect(page.locator(".broadcast-player")).toHaveCount(0);
  await expect(
    page
      .getByRole("group", { name: "Viewing mode" })
      .getByRole("button", { name: "Stream", exact: true }),
  ).toBeDisabled();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
