import { verifiedCupFixtures } from "../../apps/api/src/providers/efl";
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
const now = Date.parse("2026-11-02T12:00:00Z");
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
  await page.clock.setFixedTime(new Date(now));
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
  await page.clock.install({ time: new Date(now) });
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
  await expect(
    page.getByRole("button", { name: "Play Match 2", exact: true }),
  ).toHaveCount(0);
  await expect(page.locator(".broadcast-screen iframe")).toHaveAttribute(
    "src",
    items[1]!.sources[0]!.url,
  );
  await expect(page.locator(".broadcast-screen iframe")).not.toHaveAttribute(
    "sandbox",
    /.*/,
  );
  await expect(page.locator(".broadcast-player-brand")).toBeVisible();
  await page
    .getByRole("button", { name: /STREAM SOURCE.*for Match 2$/i })
    .click();
  await page.getByRole("option", { name: /SD/ }).click();
  await expect(page.locator(".broadcast-screen iframe")).toHaveAttribute(
    "src",
    items[1]!.sources[1]!.url,
  );
  await page.getByRole("button", { name: "Stop Match 2", exact: true }).click();
  await expect(page.locator(".broadcast-screen iframe")).toHaveCount(0);
  await expect(page.getByText("21 watching", { exact: true })).toBeVisible();
  await page.route("**/api/broadcasts", (r) =>
    r.fulfill({
      json: {
        data: items.map((item) =>
          item.id === "ppv-2" ? { ...item, viewers: 2300 } : item,
        ),
        updatedAt: new Date().toISOString(),
        stale: false,
      },
    }),
  );
  await page.clock.fastForward(61000);
  await expect(page.getByText("2,300 watching", { exact: true })).toBeVisible();
  await expect(page.locator("main")).not.toContainText(
    /across PPV|provider figure|supplied by PPV/,
  );
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
    page.locator(".multiview-tile.is-main").getByRole("heading"),
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
    page.locator(".multiview-tile.is-main").getByRole("heading"),
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
    page.locator('.multiview-tile[data-slot="2"]').getByRole("heading"),
  ).toHaveText("Match 3");
  await expect(
    page
      .locator('.multiview-tile[data-slot="1"]')
      .getByRole("button", { name: "Add stream", exact: true }),
  ).toBeVisible();
  await page
    .locator('.multiview-tile[data-slot="1"]')
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
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "Broadcast catalogue unavailable" }),
  ).toBeVisible();
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
  await page.getByRole("button", { name: /^Order Recommended/ }).click();
  await page.getByRole("option", { name: "Kickoff time", exact: true }).click();
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
    page.locator(".event-side .event-desktop-tracker"),
  ).toBeVisible();
  await expect(
    page.locator(
      ".event-desktop-tracker .event-tracker, .event-mobile-tracker .event-tracker",
    ),
  ).toHaveCount(1);
  await page.setViewportSize({ width: 360, height: 800 });
  await expect(
    page.locator(".event-viewing-main .event-mobile-tracker .event-tracker"),
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
      .getByRole("button", { name: "Watch stream", exact: true }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("playing Multiview frames survive focus changes and removing another tile", async ({
  page,
}) => {
  let loads = 0;
  await page.route("https://taifood-blog.asia/**", (r) => {
    loads++;
    return r.fulfill({ contentType: "text/html", body: "Player fixture" });
  });
  await page.goto("/multiview?n=3&streams=ppv-1,ppv-2,ppv-3");
  for (const n of [1, 2, 3])
    await page
      .getByRole("button", { name: `Play Match ${n}`, exact: true })
      .click();
  await expect(page.locator(".broadcast-screen iframe")).toHaveCount(3);
  await expect.poll(() => loads).toBe(3);
  await page.getByRole("button", { name: "Focus", exact: true }).click();
  await page
    .getByRole("button", { name: "Make main", exact: true })
    .first()
    .click();
  await expect(
    page.locator(".multiview-tile.is-main").getByRole("heading"),
  ).toHaveText("Match 2");
  await expect(page.locator(".broadcast-screen iframe")).toHaveCount(3);
  expect(loads).toBe(3);
  await page
    .getByRole("button", { name: "Remove stream 3", exact: true })
    .click();
  await expect(page.locator(".broadcast-screen iframe")).toHaveCount(2);
  expect(loads).toBe(3);
});
test("source menu is keyboard accessible and keeps choices outside the provider frame", async ({
  page,
}) => {
  await page.goto("/watch/ppv-1");
  const picker = page.getByRole("button", {
    name: /STREAM SOURCE.*for Match 1$/i,
  });
  await picker.focus();
  await picker.press("ArrowDown");
  await expect(picker).toHaveAttribute("aria-expanded", "true");
  await page.getByRole("option", { name: /HD/ }).press("ArrowDown");
  await page.getByRole("option", { name: /SD/ }).press("Enter");
  await expect(page.locator(".broadcast-screen iframe")).toHaveAttribute(
    "src",
    items[0]!.sources[1]!.url,
  );
  await picker.click();
  await picker.press("Escape");
  await expect(picker).toHaveAttribute("aria-expanded", "false");
  const audit = await new AxeBuilder({ page }).analyze();
  expect(
    audit.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    ),
  ).toEqual([]);
  await page.screenshot({
    path: "artifacts/player-toolbar-light.png",
    fullPage: true,
  });
});

test("external broadcasts keep all 130 sources searchable on narrow screens and filter by promotion", async ({
  page,
}) => {
  const expanded = {
    ...items[0]!,
    id: "ext-streamfree-test",
    title: "AEW Dynamite",
    category: "Wrestling",
    competition: "AEW",
    sources: Array.from({ length: 130 }, (_, i) => ({
      id: `source-${i}`,
      label: `Stream ${i + 1}`,
      url: `https://taifood-blog.asia/embed/source-${i}`,
    })),
  };
  await page.route("**/api/broadcasts", (r) =>
    r.fulfill({
      json: {
        data: [expanded, ...items],
        updatedAt: new Date().toISOString(),
        stale: false,
      },
    }),
  );
  await page.goto("/watch?range=all");
  await page.getByRole("button", { name: /^Competition or promotion/ }).click();
  await page.getByRole("option", { name: "AEW", exact: true }).click();
  await expect(page.locator(".broadcast-card")).toHaveCount(1);
  await page.locator(".broadcast-card").click();
  await page.setViewportSize({ width: 360, height: 800 });
  await page
    .getByRole("button", { name: /STREAM SOURCE.*for AEW Dynamite$/i })
    .click();
  await page
    .getByRole("textbox", { name: "Search stream sources" })
    .fill("Stream 130");
  await page.getByRole("option", { name: /Stream 130/ }).click();
  await expect(page.locator(".broadcast-screen iframe")).toHaveAttribute(
    "src",
    expanded.sources[129]!.url,
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "artifacts/player-toolbar-mobile.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ colorScheme: "dark" });
  await page.screenshot({
    path: "artifacts/player-toolbar-dark.png",
    fullPage: true,
  });
  await page.goto("/multiview?n=2&streams=ext-streamfree-test,ppv-2");
  await expect(
    page.getByRole("button", { name: "Play AEW Dynamite", exact: true }),
  ).toBeVisible();
});

test("channel artwork, country labels, long names and esports navigation stay usable", async ({
  page,
}) => {
  const channels = [
    {
      ...items[0]!,
      id: "ext-daddy-test",
      title: "Sky Sports Tennis UK",
      channel: true,
      category: "Tennis",
    },
    {
      ...items[1]!,
      id: "ext-daddy-long",
      title: "An unusually long specialist sports channel name Serbia",
      channel: true,
      category: "Sports",
    },
  ];
  await page.route("**/api/broadcasts", (r) =>
    r.fulfill({
      json: {
        data: channels,
        updatedAt: new Date().toISOString(),
        stale: false,
      },
    }),
  );
  await page.goto("/watch?view=channels");
  await expect(page.locator(".channel-monogram")).toHaveCount(2);
  await expect(
    page.locator(".channel-region").filter({ hasText: "United Kingdom" }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "artifacts/channel-identities-mobile.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.emulateMedia({ colorScheme: "dark" });
  await page.screenshot({
    path: "artifacts/channel-identities-dark.png",
    fullPage: true,
  });
  await page
    .locator(".sports-nav")
    .getByRole("link", { name: "Esports", exact: true })
    .click();
  await expect(page).toHaveURL(/sport=Esports/);
});
