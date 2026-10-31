import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { verifiedCupFixtures } from "../../apps/api/src/providers/efl";

test("publisher transport retains the authorized publisher origin for nested live data", async ({
  page,
  baseURL,
}) => {
  await page
    .context()
    .addCookies([{ name: "backinit-edition", value: "real", url: baseURL! }]);
  await page.clock.setFixedTime(new Date("2026-10-28T20:05:00Z"));
  await page.route(`**/api/events/${fixture.id}`, (r) =>
    r.fulfill({ json: { data: event } }),
  );
  const url =
    "https://sportscore.com/embed/tracker/football/liverpool-vs-chelsea/";
  await page.route(`**/api/trackers/${fixture.id}`, (r) =>
    r.fulfill({
      json: {
        data: {
          provider: "SportScore",
          kind: "publisher-tracker",
          transport: "publisher",
          eventId: fixture.id,
          url,
          sourceUrl: "https://sportscore.com/",
          checkedAt: source.fetchedAt,
          validUntil: "2026-10-28T20:07:00Z",
        },
      },
    }),
  );
  await page.route(`${url}?**`, (r) =>
    r.fulfill({
      contentType: "text/html",
      body: `<html><body><iframe title="Publisher animation" src="https://widgets.thesports01.com/origin-contract"></iframe><button onclick="parent.postMessage({type:'sportscore:resize',height:845},'*')">Report widget height</button></body></html>`,
    }),
  );
  await page.route("https://widgets.thesports01.com/origin-contract", (r) =>
    r.fulfill({
      contentType: "text/html",
      body: `<html><body><p id="state"></p><script>document.getElementById('state').textContent = new URL(document.referrer).origin === 'https://sportscore.com' ? 'Authorized match animation 40:30' : 'This domain is unauthorized';</script></body></html>`,
    }),
  );
  await openFixture(page, fixture.id);
  await page.clock.fastForward(31000);
  const frame = page.locator(".publisher-tracker-frame > iframe");
  await expect(frame).toHaveAttribute(
    "src",
    /^https:\/\/sportscore\.com\/embed\/tracker\//,
  );
  await expect(
    page
      .frameLocator(".publisher-tracker-frame > iframe")
      .frameLocator("iframe")
      .getByText("Authorized match animation 40:30"),
  ).toBeVisible();
  await page
    .frameLocator(".publisher-tracker-frame > iframe")
    .getByRole("button", { name: "Report widget height" })
    .click();
  await expect(page.locator(".publisher-tracker-frame")).toHaveCSS(
    "height",
    "845px",
  );
  await page.evaluate(() => {
    window.postMessage({ type: "sportscore:resize", height: 200 }, "*");
  });
  await expect(page.locator(".publisher-tracker-frame")).toHaveCSS(
    "height",
    "845px",
  );
  await page
    .getByRole("button", { name: "Match summary", exact: true })
    .click();
  await expect(page.locator(".tracker-recovery .tracker-score")).toHaveText(
    "1:0",
  );
});
async function openFixture(page: Page, id: string) {
  const hydrated = page.waitForResponse((r) =>
    r.url().includes("/api/streams?event="),
  );
  await page.goto(`/watch/${id}`, { waitUntil: "domcontentloaded" });
  await hydrated;
}
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

test("licensed tracker waits for real data readiness, recovers on license errors and uses natural height", async ({
  page,
  baseURL,
}) => {
  await page
    .context()
    .addCookies([{ name: "backinit-edition", value: "real", url: baseURL! }]);
  await page.clock.setFixedTime(new Date(source.fetchedAt));
  await page.route(`**/api/events/${fixture.id}`, (route) =>
    route.fulfill({ json: { data: event } }),
  );
  await page.route("**/api/trackers/*", (route) =>
    route.fulfill({
      json: {
        data: {
          provider: "Sportradar",
          kind: "publisher-tracker",
          eventId: event.id,
          clientId: "0".repeat(32),
          matchId: "sr:match:12345",
          checkedAt: source.fetchedAt,
          validUntil: "2026-10-28T20:07:00Z",
        },
      },
    }),
  );
  let loads = 0;
  await page.route("https://widgets.sir.sportradar.com/**", (route) => {
    loads++;
    return route.fulfill({
      contentType: "application/javascript",
      body: `
      window.__trackerContract = { adds: 0, removes: 0 };
      window.BackInItSportradar = function(method, element, name, props) {
        if (method === 'addWidget') {
          window.__trackerContract.adds++;
          element.innerHTML = '<div style="height:840px">Isolated widget contract fixture</div>';
          window.__trackerContract.track = props.onTrack;
        }
        if (method === 'removeWidget') {
          window.__trackerContract.removes++;
          element.replaceChildren();
        }
      };
    `,
    });
  });
  const hydrated = page.waitForResponse((r) =>
    r.url().includes("/api/streams?event="),
  );
  await page.goto(`/watch/${event.id}`);
  await hydrated;
  await expect(
    page.locator(".player-tracker-fallback .event-tracker"),
  ).toBeVisible();
  await page.clock.fastForward(31000);
  const widget = page.locator(".sportradar-tracker-content");
  await expect(widget).toHaveAttribute("aria-hidden", "true");
  await expect(
    page.locator(".sportradar-tracker-summary .tracker-score"),
  ).toHaveText("1:0");
  // A script load or an unrelated component's update cannot reveal an empty tracker.
  await expect(widget).toContainText("Isolated widget contract fixture");
  await page.evaluate(() =>
    (window as any).__trackerContract.track("data_change", { matchId: 999 }),
  );
  await expect(widget).toHaveAttribute("aria-hidden", "true");
  await page.evaluate(() =>
    (window as any).__trackerContract.track("data_change", {
      matchId: 12345,
      error: null,
    }),
  );
  await expect(widget).not.toHaveAttribute("aria-hidden");
  await expect(widget).toHaveCSS("height", "840px");
  await expect(page.locator(".sportradar-tracker-summary")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Match summary", exact: true })
    .click();
  await expect(widget).toHaveAttribute("inert", "");
  await page
    .getByRole("button", { name: "Live animation", exact: true })
    .click();
  await page.evaluate(() =>
    (window as any).__trackerContract.track("license_error", {
      error: { code: "NOT_LICENSED" },
    }),
  );
  await expect(page.locator(".sportradar-tracker-summary")).toContainText(
    "Scores keep updating",
  );
  await page
    .getByRole("button", { name: "Reload animation", exact: true })
    .click();
  await expect
    .poll(() => page.evaluate(() => (window as any).__trackerContract.adds))
    .toBe(2);
  expect(loads).toBe(1);
  expect(
    await page.evaluate(() => (window as any).__trackerContract.removes),
  ).toBe(1);
  await page.evaluate(() =>
    (window as any).__trackerContract.track("data_change", { matchId: 12345 }),
  );
  await expect(widget).not.toHaveAttribute("aria-hidden");
  await page.setViewportSize({ width: 375, height: 812 });
  await expect(widget).toHaveCSS("height", "840px");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

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
  await openFixture(page, fixture.id);
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
  // A published source is not proof it can play in this visitor's browser.
  // On playback failure, promote the tracker to the main area and remove the rail copy.
  await page.getByRole("button", { name: "Play video", exact: true }).click();
  await expect(
    page.locator(".player-tracker-fallback .event-tracker"),
  ).toBeVisible();
  await expect(
    page.locator(".event-mobile-tracker .event-tracker"),
  ).toHaveCount(0);
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(
    page.locator(".event-desktop-tracker .event-tracker"),
  ).toHaveCount(0);
  await expect(page.locator(".event-tracker")).toHaveCount(1);
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
  await page.route("**/api/trackers/*/view?**", (route) => {
    frames++;
    return route.fulfill({
      contentType: "text/html",
      body: `<html><body>Isolated publisher tracker test<script>parent.postMessage({type:"backinit:tracker-ready",eventId:${JSON.stringify(fixture.id)}},"*")</script></body></html>`,
    });
  });
  await openFixture(page, fixture.id);
  await expect(
    page.locator(".player-tracker-fallback .event-tracker"),
  ).toBeVisible();
  await page.clock.fastForward(31000);
  await expect(
    page.getByRole("region", { name: "Live match tracker", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".publisher-tracker iframe")).toHaveAttribute(
    "sandbox",
    "allow-scripts allow-popups",
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
  await page.route("**/api/trackers/*/view?**", async (route) => {
    requests++;
    await delayed;
    await route.fulfill({
      contentType: "text/html",
      body: `<html><body><script>parent.postMessage({type:"backinit:tracker-ready",eventId:"${fixture.id}"},"*")</script>Delayed publisher view<button onclick="parent.postMessage({type:'backinit:tracker-size',eventId:'${fixture.id}',height:740}, '*')">Resize tracker</button></body></html>`,
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
  await page.clock.fastForward(36000);
  await expect(
    page.getByText("Live animation is reconnecting. Scores keep updating."),
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

test("a successful iframe navigation is not readiness; a broken view reconnects without exposing the browser error", async ({
  page,
  baseURL,
}) => {
  await page
    .context()
    .addCookies([{ name: "backinit-edition", value: "real", url: baseURL! }]);
  await page.clock.setFixedTime(new Date(source.fetchedAt));
  await page.route(`**/api/events/${fixture.id}`, (r) =>
    r.fulfill({ json: { data: event } }),
  );
  await page.route(`**/api/trackers/${fixture.id}`, (r) =>
    r.fulfill({
      json: {
        data: {
          provider: "SportScore",
          kind: "publisher-tracker",
          eventId: fixture.id,
          url: "https://sportscore.com/embed/tracker/football/liverpool-vs-chelsea/",
          sourceUrl: "https://sportscore.com/",
          checkedAt: source.fetchedAt,
          validUntil: "2026-10-28T20:07:00Z",
        },
      },
    }),
  );
  let views = 0;
  await page.route("**/api/trackers/*/view?**", (r) => {
    views++;
    return r.fulfill({
      contentType: "text/html",
      body:
        views === 1
          ? `<html><body>Error document</body><script>parent.postMessage({type:'backinit:tracker-error',eventId:'${fixture.id}'},'*')</script></html>`
          : `<html><body>Recovered publisher widget<script>parent.postMessage({type:'backinit:tracker-ready',eventId:'${fixture.id}'},'*')</script></body></html>`,
    });
  });
  await openFixture(page, fixture.id);
  await expect(
    page.locator(".player-tracker-fallback .event-tracker"),
  ).toBeVisible();
  await expect.poll(() => views).toBe(1);
  await expect(page.locator(".publisher-tracker iframe")).toHaveAttribute(
    "aria-hidden",
    "true",
  );
  await expect(page.locator(".tracker-recovery .tracker-score")).toHaveText(
    "1:0",
  );
  await page.clock.fastForward(6000);
  await expect.poll(() => views).toBe(2);
  await expect(page.locator(".tracker-recovery")).toHaveCount(0);
  await expect(page.locator(".publisher-tracker iframe")).not.toHaveAttribute(
    "aria-hidden",
  );
  await expect(
    page
      .frameLocator(".publisher-tracker iframe")
      .getByText("Recovered publisher widget"),
  ).toBeVisible();
});

test("isolated backend relay permits the nested widget's own data requests without application-origin access", async ({
  page,
  baseURL,
}) => {
  await page
    .context()
    .addCookies([{ name: "backinit-edition", value: "real", url: baseURL! }]);
  await page.clock.setFixedTime(new Date(source.fetchedAt));
  await page.route(`**/api/events/${fixture.id}`, (r) =>
    r.fulfill({ json: { data: event } }),
  );
  const viewUrl = `https://backinit-api.onrender.com/trackers/${fixture.id}/view`;
  await page.route(`**/api/trackers/${fixture.id}`, (r) =>
    r.fulfill({
      json: {
        data: {
          provider: "SportScore",
          kind: "publisher-tracker",
          eventId: fixture.id,
          url: "https://sportscore.com/embed/tracker/football/liverpool-vs-chelsea/",
          viewUrl,
          sourceUrl: "https://sportscore.com/",
          checkedAt: source.fetchedAt,
          validUntil: "2026-10-28T20:07:00Z",
        },
      },
    }),
  );
  await page.route(`${viewUrl}?**`, (r) =>
    r.fulfill({
      contentType: "text/html",
      headers: {
        "Content-Security-Policy": `sandbox allow-scripts allow-same-origin; default-src 'none'; script-src 'unsafe-inline'; frame-src https://widgets.thesports01.com; connect-src 'none'; frame-ancestors ${baseURL}`,
      },
      body: `<html><body><iframe title="Publisher widget" src="https://widgets.thesports01.com/contract" onload="parent.postMessage({type:'backinit:tracker-ready',eventId:'${fixture.id}'},'*')"></iframe></body></html>`,
    }),
  );
  await page.route("https://widgets.thesports01.com/contract", (r) =>
    r.fulfill({
      contentType: "text/html",
      body: `<html><body><div id="score"></div><script>fetch('/contract-data').then(r=>r.json()).then(r=>document.getElementById('score').textContent=r.score)</script></body></html>`,
    }),
  );
  await page.route("https://widgets.thesports01.com/contract-data", (r) =>
    r.fulfill({ json: { score: "Live game 40:30" } }),
  );
  const hydrated = page.waitForResponse((r) =>
    r.url().includes("/api/streams?event="),
  );
  await openFixture(page, fixture.id);
  await hydrated;
  await expect(
    page.locator(".player-tracker-fallback .event-tracker"),
  ).toBeVisible();
  await page.clock.fastForward(31000);
  const frame = page.locator(
    ".publisher-tracker > .publisher-tracker-frame > iframe",
  );
  await expect(frame).toHaveAttribute(
    "sandbox",
    "allow-scripts allow-same-origin",
  );
  await expect(frame).toHaveAttribute("credentialless", "");
  await expect(
    page
      .frameLocator(".publisher-tracker-frame > iframe")
      .frameLocator("iframe")
      .getByText("Live game 40:30"),
  ).toBeVisible();
  await expect(page.locator(".tracker-recovery")).toHaveCount(0);
});

test("a slow publisher child never masks or repeatedly restarts a rendered live tracker", async ({
  page,
  baseURL,
}) => {
  await page
    .context()
    .addCookies([{ name: "backinit-edition", value: "real", url: baseURL! }]);
  await page.clock.install({ time: new Date(source.fetchedAt) });
  await page.route(`**/api/events/${fixture.id}`, (route) =>
    route.fulfill({ json: { data: event } }),
  );
  const url =
    "https://sportscore.com/embed/tracker/football/liverpool-vs-chelsea/";
  await page.route(`**/api/trackers/${fixture.id}`, (route) =>
    route.fulfill({
      json: {
        data: {
          provider: "SportScore",
          kind: "publisher-tracker",
          transport: "publisher",
          eventId: fixture.id,
          url,
          sourceUrl: "https://sportscore.com/",
          checkedAt: source.fetchedAt,
          validUntil: "2026-10-28T20:07:00Z",
        },
      },
    }),
  );
  let documents = 0;
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(`${url}?**`, (route) => {
    documents++;
    return route.fulfill({
      contentType: "text/html",
      body: '<html><body><p>Live animation document</p><iframe title="Slow resource" src="https://widgets.thesports01.com/slow-contract"></iframe></body></html>',
    });
  });
  await page.route(
    "https://widgets.thesports01.com/slow-contract",
    async (route) => {
      await pending;
      await route.fulfill({
        contentType: "text/html",
        body: "Reported live play",
      });
    },
  );
  await openFixture(page, fixture.id);
  const publisher = page.frameLocator(".publisher-tracker-frame > iframe");
  await expect(publisher.getByText("Live animation document")).toBeVisible();
  await expect(page.locator(".tracker-recovery")).toHaveCount(0);
  await page.clock.fastForward(45000);
  expect(documents).toBe(1);
  await expect(publisher.getByText("Live animation document")).toBeVisible();
  await expect(
    page.getByRole("status").filter({ hasText: "Animation is taking longer" }),
  ).toBeVisible();
  release();
  await expect(
    publisher.frameLocator("iframe").getByText("Reported live play"),
  ).toBeVisible();
  await expect(page.locator(".tracker-startup-status")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Match summary", exact: true })
    .click();
  await expect(page.locator(".tracker-recovery .tracker-score")).toHaveText(
    "1:0",
  );
});

test("an old score snapshot cannot suppress independently verified live animation discovery", async ({
  page,
  baseURL,
}) => {
  await page
    .context()
    .addCookies([{ name: "backinit-edition", value: "real", url: baseURL! }]);
  await page.clock.setFixedTime(new Date(source.fetchedAt));
  await page.route(`**/api/events/${fixture.id}`, (route) =>
    route.fulfill({
      json: {
        data: {
          ...event,
          status: "unknown",
          source: { ...source, stale: true },
        },
      },
    }),
  );
  const url =
    "https://sportscore.com/embed/tracker/football/liverpool-vs-chelsea/";
  let discovery = 0;
  await page.route(`**/api/trackers/${fixture.id}`, (route) => {
    discovery++;
    return route.fulfill({
      json: {
        data: {
          provider: "SportScore",
          kind: "publisher-tracker",
          transport: "publisher",
          eventId: fixture.id,
          url,
          sourceUrl: "https://sportscore.com/",
          checkedAt: source.fetchedAt,
          validUntil: "2026-10-28T20:07:00Z",
        },
      },
    });
  });
  await page.route(`${url}?**`, (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "Independently verified live animation",
    }),
  );
  await openFixture(page, fixture.id);
  await expect(
    page
      .frameLocator(".publisher-tracker-frame > iframe")
      .getByText("Independently verified live animation"),
  ).toBeVisible();
  expect(discovery).toBeGreaterThan(0);
  await expect(page.locator(".tracker-recovery")).toHaveCount(0);
});

test("tracker metadata renews before expiry without remounting a healthy animation", async ({
  page,
  baseURL,
}) => {
  await page
    .context()
    .addCookies([{ name: "backinit-edition", value: "real", url: baseURL! }]);
  await page.clock.install({ time: new Date(source.fetchedAt) });
  await page.route(`**/api/events/${fixture.id}`, (route) =>
    route.fulfill({ json: { data: event } }),
  );
  const url =
    "https://sportscore.com/embed/tracker/football/liverpool-vs-chelsea/";
  let renewals = 0;
  let documents = 0;
  await page.route(`**/api/trackers/${fixture.id}`, (route) => {
    renewals++;
    return route.fulfill({
      json: {
        data: {
          provider: "SportScore",
          kind: "publisher-tracker",
          transport: "publisher",
          eventId: fixture.id,
          url,
          sourceUrl: "https://sportscore.com/",
          checkedAt: source.fetchedAt,
          validUntil:
            renewals === 1 ? "2026-10-28T20:06:00Z" : "2026-10-28T20:08:00Z",
        },
      },
    });
  });
  await page.route(`${url}?**`, (route) => {
    documents++;
    return route.fulfill({
      contentType: "text/html",
      body: "Continuous live animation",
    });
  });
  await openFixture(page, fixture.id);
  const animation = page
    .frameLocator(".publisher-tracker-frame > iframe")
    .getByText("Continuous live animation");
  await expect(animation).toBeVisible();
  await page.clock.fastForward(31000);
  await expect.poll(() => renewals).toBeGreaterThan(1);
  await page.clock.fastForward(35000);
  await expect(animation).toBeVisible();
  expect(documents).toBe(1);
});
