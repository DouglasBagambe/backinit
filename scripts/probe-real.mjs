// Optional network-backed smoke review. Start built API/web servers first.
import { chromium, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
const base = "http://127.0.0.1:3000";
const response = await fetch("http://127.0.0.1:4000/events?edition=real");
if (!response.ok) throw new Error(`Feed HTTP ${response.status}`);
const feed = await response.json();
if (!feed.data.length || feed.data.some((e) => e.provenance !== "provider"))
  throw new Error("Real provider feed unavailable or mixed");
const football = feed.data.find(
  (e) => e.kind === "score" && e.detail?.goals?.length > 1,
);
const race = feed.data.find(
  (e) => e.kind === "race" && e.detail?.classification?.length,
);
if (!football || !race)
  throw new Error("Required real goals/classification unavailable");
const browser = await chromium.launch();
try {
  const context = await browser.newContext();
  await context.addCookies([
    { name: "backinit-edition", value: "real", url: base },
  ]);
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  for (const theme of ["light", "dark"]) {
    await page.goto(`${base}/settings`);
    await page
      .locator("footer")
      .getByRole("button", { name: theme, exact: true })
      .click();
    for (const width of [360, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      for (const path of ["/", `/match/${football.id}`, `/match/${race.id}`]) {
        await page.goto(base + path);
        await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
        await expect(
          page.getByText("All event details on this page are demo content.", {
            exact: false,
          }),
        ).toHaveCount(0);
        if (
          await page.evaluate(
            () => document.documentElement.scrollWidth > innerWidth,
          )
        )
          throw new Error(`Overflow ${path} ${width}`);
        const result = await new AxeBuilder({ page }).analyze();
        const violations = result.violations.filter((v) =>
          ["serious", "critical"].includes(v.impact),
        );
        if (violations.length)
          throw new Error(
            JSON.stringify(
              violations.map((v) => ({
                id: v.id,
                targets: v.nodes.map((n) => n.target),
              })),
            ),
          );
        await page.screenshot({
          path: `artifacts/real-${theme}-${width}-${path.replaceAll("/", "_")}.png`,
          fullPage: true,
        });
      }
    }
  }
  await page.goto(`${base}/match/${football.id}`);
  const replay = page.locator(".event-replay");
  const initial = await replay.innerText();
  await page.getByRole("button", { name: "Next goal", exact: true }).click();
  await expect(replay).not.toHaveText(initial);
  await expect(
    page.getByRole("heading", { name: "Bundesliga standings", exact: true }),
  ).toBeVisible();
  const calendar = await context.request.get(
    `${base}/api/calendar/${football.id}`,
  );
  expect(calendar.status()).toBe(200);
  const ics = await calendar.text();
  expect(ics).toContain("BEGIN:VEVENT");
  expect(ics).not.toContain("DEMO:");
  for (const line of ics.split("\r\n"))
    expect(Buffer.byteLength(line)).toBeLessThanOrEqual(75);
  expect(errors).toEqual([]);
  console.log(
    JSON.stringify(
      {
        events: feed.data.length,
        coverage: feed.coverage,
        football: football.id,
        race: race.id,
        reviews: 12,
        calendar: true,
        pageErrors: errors,
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
