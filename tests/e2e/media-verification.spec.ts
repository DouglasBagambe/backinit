import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
test("external media: admin preview records actual decoded HLS and live DASH playback", async ({
  page,
  baseURL,
}) => {
  test.skip(
    process.env.VERIFY_EXTERNAL_MEDIA !== "true",
    "Optional provider-network probe, separate from deterministic CI.",
  );
  test.setTimeout(120000);
  const email = `media-probe-${Date.now()}@example.test`;
  const password = "backinit-media-verification-password";
  const created = await page.request.post("/api/account/register", {
    headers: { Origin: baseURL! },
    data: { email, password },
  });
  expect(created.status()).toBe(201);
  const { user } = await created.json();
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
  for (const id of ["bbb-hls", "dash-live-simulator"]) {
    await page
      .getByRole("button", { name: `Verify ${id}`, exact: true })
      .click();
    const preview = page.getByRole("region", {
      name: "Source playback verification",
    });
    await preview.locator("video").waitFor();
    await page.waitForFunction(
      () => document.querySelector("video")?.readyState >= 2,
      {},
      { timeout: 45000 },
    );
    await preview.locator("video").evaluate(async (v) => {
      v.muted = true;
      await v.play();
    });
    await expect(
      page.getByText(
        "Playback verified in this browser. Distribution rights still require operator review.",
        { exact: true },
      ),
    ).toBeVisible({ timeout: 30000 });
    const body = await (await page.request.get("/api/admin/sources")).json();
    expect(body.checks[id]).toMatchObject({
      result: "passed",
      method: "native-decoded",
    });
    expect(body.checks[id].currentTime).toBeGreaterThan(1);
    expect(body.checks[id].width).toBeGreaterThan(0);
    if (id === "dash-live-simulator") {
      expect(body.checks[id].live).toBe(true);
      await expect(
        preview.getByRole("button", { name: "Go live", exact: true }),
      ).toBeVisible();
    }
    console.log(id, JSON.stringify(body.checks[id]));
    await page.screenshot({ path: `artifacts/admin-decoded-${id}.png` });
    await preview
      .getByRole("button", { name: "Close preview", exact: true })
      .click();
  }
});
