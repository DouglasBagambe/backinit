import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { verifiedCupFixtures } from "../../apps/api/src/providers/efl";
const at = "2026-10-28T20:05:00Z";
const fixture = verifiedCupFixtures.find((e) =>
  e.id.includes("liverpool-chelsea"),
)!;
const event = {
  ...fixture,
  kind: "score" as const,
  status: "live" as const,
  scheduleOnly: false,
  homeScore: 1,
  awayScore: 0,
  clock: "5′",
  source: {
    provider: "CI",
    url: "https://example.test",
    license: "CI",
    fetchedAt: at,
    stale: false,
  },
};
test.beforeEach(async ({ page, baseURL }) => {
  await page
    .context()
    .addCookies([{ name: "backinit-edition", value: "real", url: baseURL! }]);
  await page.clock.setFixedTime(new Date(at));
  await page.addInitScript(() =>
    localStorage.setItem("backinit-timezone", "Africa/Kampala"),
  );
  await page.route("**/api/broadcasts", (r) =>
    r.fulfill({ json: { data: [], updatedAt: at, stale: false } }),
  );
  await page.route("**/api/watch*", (r) =>
    r.fulfill({ json: { data: [], coverage: [], generatedAt: at } }),
  );
  await page.route("**/api/trackers/*", (r) =>
    r.fulfill({ json: { data: null } }),
  );
  await page.route("**/api/events*", (r) =>
    r.fulfill({
      json: r.request().url().includes(`/api/events/${fixture.id}`)
        ? { data: event }
        : { data: [event], edition: "real", source: "CI", coverage: [] },
    }),
  );
});
test("player search works outside match lists and opens a real profile with persistent following", async ({
  page,
}) => {
  await page.route("**/api/search?*", (r) =>
    r.fulfill({
      json: {
        data: [
          {
            id: "296395",
            name: "Cole Palmer",
            kind: "athlete",
            sport: "Football",
            providerSport: "soccer",
            league: "eng.1",
          },
        ],
      },
    }),
  );
  await page.route("**/api/athlete-profile?*", (r) =>
    r.fulfill({
      json: {
        value: {
          id: "296395",
          name: "Cole Palmer",
          sport: "Football",
          position: "Midfielder",
          team: { id: "363", displayName: "Chelsea" },
          appearances: [
            {
              id: "espn-soccer-eng-1-123",
              date: "2026-10-27T12:00:00Z",
              opponent: "Opponent",
              atVs: "vs",
              team: "CHE",
              score: "2-0",
              result: "W",
              statistics: [{ label: "Goals", value: "1" }],
            },
          ],
          country: "England",
          statistics: {
            displayName: "Premier League Stats",
            statistics: [{ displayName: "Goals", displayValue: "3" }],
          },
        },
        stale: false,
        fetchedAt: at,
      },
    }),
  );
  await page.route("**/api/team-profile?*", (r) =>
    r.fulfill({
      json: {
        name: "Chelsea",
        data: [
          {
            ...event,
            id: "ci-next-chelsea",
            status: "upcoming",
            start: "2026-10-30T20:00:00Z",
            home: "Chelsea",
            away: "Arsenal",
          },
        ],
        players: [],
      },
    }),
  );
  await page.goto("/search");
  await expect(
    page.getByRole("heading", { name: "Find your sport" }),
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: "Search sport", exact: true })
    .fill("Cole Palmer");
  await page.getByRole("link", { name: /Cole Palmer Football/ }).click();
  await expect(
    page.getByRole("heading", { name: "Cole Palmer", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".athlete-bio")).toContainText("Midfielder");
  await expect(page.locator(".athlete-bio")).toContainText(
    "Premier League Stats",
  );
  await expect(
    page.getByRole("heading", { name: "Chelsea fixtures" }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "Team schedule · player participation is confirmed when lineups are announced.",
    ),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: /Chelsea →/ })).toHaveAttribute(
    "href",
    /pid=363/,
  );
  await expect(
    page.getByRole("heading", { name: "Recent appearances" }),
  ).toBeVisible();
  await expect(page.getByText("Goals: 1", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("link", { name: /CHE vs Opponent/ }),
  ).toHaveAttribute("href", "/watch/espn-soccer-eng-1-123");
  await page.screenshot({
    path: "artifacts/unified-player-profile.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Follow", exact: true }).click();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Following ✓", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.setViewportSize({ width: 360, height: 800 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("Watch applies one sport and live filter to both streams and tracker-only matches", async ({
  page,
}) => {
  const tennis = {
    ...event,
    id: "ci-tennis",
    sport: "Tennis",
    home: "Carlos Alcaraz",
    away: "Jannik Sinner",
    homeScore: null,
    awayScore: null,
    detail: { periods: [{ label: "Set 1", home: "3", away: "2" }] },
  };
  await page.route("**/api/watch*", (r) =>
    r.fulfill({
      json: {
        data: [
          event,
          tennis,
          {
            ...tennis,
            id: "ci-tennis-next",
            status: "upcoming",
            start: "2026-10-28T20:30:00Z",
          },
        ].map((event) => ({ event, sources: [], availability: "unavailable" })),
        coverage: [],
        generatedAt: at,
      },
    }),
  );
  await page.goto("/watch");
  await expect(page.locator(".broadcast-card")).toHaveCount(3);
  await page
    .getByRole("combobox", { name: "Sport", exact: true })
    .selectOption("Tennis");
  await expect(page.locator(".broadcast-card")).toHaveCount(2);
  await expect(page.locator(".broadcast-grid")).not.toContainText("Liverpool");
  await page.getByRole("button", { name: "Live now", exact: true }).click();
  await expect(page.locator(".broadcast-card")).toHaveCount(1);
  await expect(page.locator(".broadcast-card")).toContainText(
    "Match centre & tracker",
  );
  await page.reload();
  await expect(
    page.getByRole("combobox", { name: "Sport", exact: true }),
  ).toHaveValue("Tennis");
  await expect(
    page.getByRole("button", { name: "Live now", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".broadcast-card")).toHaveCount(1);
});
test("Fixtures and Scores use local time, separate statuses and keep the time column clear", async ({
  page,
}) => {
  const entries = [
    event,
    {
      ...event,
      id: "ci-next",
      status: "upcoming",
      start: "2026-10-28T20:30:00Z",
      homeScore: null,
      awayScore: null,
      clock: "11/28 - 4:30 PM EST",
    },
    {
      ...event,
      id: "ci-result",
      status: "finished",
      homeScore: 2,
      clock: "FT",
    },
  ];
  await page.route("**/api/events*", (r) =>
    r.fulfill({
      json: { data: entries, edition: "real", source: "CI", coverage: [] },
    }),
  );
  await page.goto("/fixtures?date=2026-10-28");
  await expect(page.locator(".sports-browser .match-row")).toHaveCount(3);
  await expect(page.locator(".sports-browser")).not.toContainText("EST");
  await page.getByRole("button", { name: "Upcoming", exact: true }).click();
  await expect(page.locator(".match-row")).toHaveCount(1);
  for (const width of [320, 989]) {
    await page.setViewportSize({ width, height: 800 });
    expect(
      await page.locator(".match-row").evaluate((row) => {
        const time = row.querySelector(".match-time")!.getBoundingClientRect();
        const names = row
          .querySelector(".match-teams")!
          .getBoundingClientRect();
        return time.right <= names.left && row.scrollWidth <= row.clientWidth;
      }),
    ).toBe(true);
  }
  await page.goto("/scores?date=2026-10-28");
  await expect(page.locator(".match-row")).toHaveCount(1);
  await expect(page.locator(".match-row")).toContainText("FT");
});
test("fixture and Watch URLs share the same match information and correct formation", async ({
  page,
}) => {
  const positions = [
    "G",
    "CD-L",
    "CD-R",
    "LB",
    "RB",
    "AM",
    "LM",
    "RM",
    "F",
    "AM-L",
    "AM-R",
  ];
  const rich = {
    ...event,
    detail: {
      lineups: [
        {
          team: "Liverpool",
          formation: "4-2-3-1",
          players: positions.map((position, i) => ({
            name: `Player ${i + 1}`,
            position,
            starter: true,
            jersey: String(i + 1),
            formationPlace: String(i + 1),
          })),
        },
      ],
      statistics: [{ label: "Shots", home: "10", away: "6" }],
    },
  };
  await page.route(`**/api/events/${fixture.id}`, (r) =>
    r.fulfill({ json: { data: rich } }),
  );
  for (const prefix of ["match", "watch"]) {
    await page.goto(`/${prefix}/${fixture.id}`);
    await expect(page.locator(".event-viewing-header h1")).toContainText(
      "Liverpool",
    );
    await page.getByRole("button", { name: "Lineups", exact: true }).click();
    await expect(page.locator(".formation-line")).toHaveCount(5);
    await expect(page.locator(".formation-line").nth(3)).toHaveText(
      /Player 4.*Player 2.*Player 3.*Player 5/,
    );
    if (prefix === "watch")
      await page
        .locator(".lineup-grid")
        .screenshot({ path: "artifacts/unified-match-lineups.png" });
    await page.getByRole("button", { name: "Statistics", exact: true }).click();
    await expect(page.getByRole("table")).toContainText("Shots");
  }
  await page.setViewportSize({ width: 360, height: 800 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const result = await new AxeBuilder({ page }).analyze();
  expect(
    result.violations
      .filter((v) => ["serious", "critical"].includes(v.impact || ""))
      .map((v) => v.id),
  ).toEqual([]);
});

test("page searches find profiles even without matches on the chosen date", async ({
  page,
}) => {
  await page.route("**/api/search?*", (r) =>
    r.fulfill({
      json: {
        data: [
          {
            id: "296395",
            name: "Cole Palmer",
            kind: "athlete",
            sport: "Football",
            providerSport: "soccer",
            league: "eng.1",
          },
          {
            id: "363",
            name: "Chelsea",
            kind: "team",
            sport: "Football",
            providerSport: "soccer",
            league: "eng.1",
          },
        ],
      },
    }),
  );
  await page.goto("/sport/football?q=palmer");
  await expect(
    page
      .getByRole("region", { name: "Matching teams and players" })
      .getByRole("link", { name: /Cole Palmer/ }),
  ).toHaveAttribute("href", /pid=296395/);
  await page.goto("/scores?q=chelsea&status=all");
  await expect(
    page
      .getByRole("region", { name: "Matching teams and players" })
      .getByRole("link", { name: /Chelsea/ }),
  ).toHaveAttribute("href", /pid=363/);
});

test("a player profile can retry provider failure without losing the page", async ({
  page,
}) => {
  let calls = 0;
  await page.route("**/api/athlete-profile?*", (r) => {
    calls++;
    return calls === 1
      ? r.fulfill({ status: 503, json: { message: "retry" } })
      : r.fulfill({
          json: {
            value: {
              id: "1966",
              name: "LeBron James",
              sport: "Basketball",
              age: 41,
            },
            stale: false,
            fetchedAt: at,
          },
        });
  });
  await page.goto(
    "/explore/athlete?name=LeBron+James&sport=Basketball&pid=1966&psport=basketball&league=nba",
  );
  await expect(page.getByText("Player details could not load.")).toBeVisible();
  await page.getByRole("button", { name: "Retry profile" }).click();
  await expect(page.locator(".athlete-bio")).toContainText("41");
  await expect(page.getByRole("button", { name: "Retry profile" })).toHaveCount(
    0,
  );
});
