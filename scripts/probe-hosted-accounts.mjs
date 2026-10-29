// Run only against an isolated QA database. Never pass a production connection.
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium, expect } from "@playwright/test";
if (!process.env.BACKINIT_TEST_DATABASE_URL)
  throw new Error("Set BACKINIT_TEST_DATABASE_URL to an isolated QA database");
const apiPort = 4600,
  webPort = 3600;
const origin = `http://127.0.0.1:${webPort}`;
let api,
  web,
  browser,
  page,
  password = `qa-${randomUUID()}`,
  registered = false;
const email = `browser-qa-${randomUUID()}@example.test`;
const evidence = { checkedAt: new Date().toISOString(), checks: [] };
function startApi() {
  return spawn(process.execPath, ["dist/apps/api/src/main.js"], {
    cwd: new URL("../apps/api/", import.meta.url),
    stdio: "ignore",
    env: {
      ...process.env,
      DATABASE_URL: process.env.BACKINIT_TEST_DATABASE_URL,
      SPORTS_DATA_ONLY: "true",
      SPORTS_PROVIDERS_DISABLED: "true",
      NODE_ENV: "production",
      HOST: "127.0.0.1",
      PORT: String(apiPort),
      WEB_ORIGIN: origin,
    },
  });
}
async function ready(url) {
  const deadline = Date.now() + 45000;
  while (Date.now() < deadline) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("QA service did not start");
}
async function stop(child) {
  if (!child || child.exitCode !== null) return;
  const done = new Promise((resolve) => child.once("exit", resolve));
  child.kill("SIGTERM");
  await done;
}
async function login(target) {
  await target.goto(`${origin}/profile`);
  await target.getByLabel("Email", { exact: true }).fill(email);
  await target.getByLabel("Password", { exact: true }).fill(password);
  await target.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(target.getByText(`Signed in as ${email}`)).toBeVisible({
    timeout: 20000,
  });
}
try {
  api = startApi();
  await ready(`http://127.0.0.1:${apiPort}/health`);
  web = spawn(
    "pnpm",
    ["--filter", "@backinit/web", "start", "--port", String(webPort)],
    {
      stdio: "ignore",
      detached: true,
      env: {
        ...process.env,
        API_BACKEND: "external",
        API_URL: `http://127.0.0.1:${apiPort}`,
        APP_ORIGIN: origin,
        ALLOW_DEMO_MODE: "false",
        SPORTS_DATA_MODE: "real",
      },
    },
  );
  await ready(origin);
  browser = await chromium.launch();
  const context = await browser.newContext();
  page = await context.newPage();
  await page.goto(`${origin}/profile`);
  await page
    .getByRole("button", { name: "Create an account", exact: true })
    .click();
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  const responsePromise = page.waitForResponse((r) =>
    r.url().endsWith("/api/account/register"),
  );
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  const response = await responsePromise;
  expect(response.status()).toBe(201);
  expect((await response.json()).token).toBeUndefined();
  registered = true;
  await expect(page.getByText(`Signed in as ${email}`)).toBeVisible();
  const cookie = (await context.cookies()).find(
    (c) => c.name === "backinit-session",
  );
  expect(cookie?.httpOnly).toBe(true);
  expect(cookie?.sameSite).toBe("Lax");
  evidence.checks.push(
    "Browser signup, HttpOnly session cookie, response token removed",
  );
  const saved = await page.request.post(`${origin}/api/account/favorites`, {
    headers: { Origin: origin },
    data: { kind: "team", target: "Arsenal" },
  });
  expect(saved.ok()).toBe(true);
  await stop(api);
  api = startApi();
  await ready(`http://127.0.0.1:${apiPort}/health`);
  expect((await page.request.get(`${origin}/api/account/me`)).ok()).toBe(true);
  const favorites = await (
    await page.request.get(`${origin}/api/account/favorites`)
  ).json();
  expect(favorites.data).toContainEqual({ kind: "team", target: "Arsenal" });
  evidence.checks.push(
    "Session and favorites survive a complete API process restart",
  );
  const fresh = await browser.newContext();
  const freshPage = await fresh.newPage();
  await login(freshPage);
  expect(
    (
      await (
        await freshPage.request.get(`${origin}/api/account/favorites`)
      ).json()
    ).data,
  ).toContainEqual({ kind: "team", target: "Arsenal" });
  evidence.checks.push("Fresh browser sign-in restores persisted favorites");
  await page.getByText("Recovery codes", { exact: true }).click();
  await page
    .getByLabel("Current password for recovery codes", { exact: true })
    .fill(password);
  await page
    .getByRole("button", { name: "Generate recovery codes", exact: true })
    .click();
  await expect(page.locator(".recovery-codes code")).toHaveCount(5);
  const code = await page.locator(".recovery-codes code").first().textContent();
  await page
    .getByRole("button", { name: "Hide recovery codes", exact: true })
    .click();
  const recoveryContext = await browser.newContext();
  const recoveryPage = await recoveryContext.newPage();
  await recoveryPage.goto(`${origin}/profile`);
  await recoveryPage
    .getByRole("button", {
      name: "Forgot password? Use a recovery code",
      exact: true,
    })
    .click();
  await recoveryPage.getByLabel("Email", { exact: true }).fill(email);
  await recoveryPage.getByLabel("Recovery code", { exact: true }).fill(code);
  password = `reset-${randomUUID()}`;
  await recoveryPage.getByLabel("New password", { exact: true }).fill(password);
  await recoveryPage
    .getByRole("button", { name: "Reset password", exact: true })
    .click();
  await expect(
    recoveryPage.locator(".account-panel [role=alert]"),
  ).toContainText("Password reset", { timeout: 20000 });
  expect((await page.request.get(`${origin}/api/account/me`)).status()).toBe(
    401,
  );
  expect(
    (await freshPage.request.get(`${origin}/api/account/me`)).status(),
  ).toBe(401);
  await login(recoveryPage);
  page = recoveryPage;
  const exported = await (
    await page.request.get(`${origin}/api/account/export`)
  ).json();
  expect(JSON.stringify(exported)).not.toContain(password);
  expect(JSON.stringify(exported)).not.toContain("token_hash");
  evidence.checks.push(
    "Browser recovery resets password and revokes both existing sessions; privacy export contains no password or token hashes",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await mkdir("artifacts", { recursive: true });
  await page.screenshot({
    path: "artifacts/hosted-account-mobile.png",
    fullPage: true,
  });
  const removed = await page.request.post(`${origin}/api/account/delete`, {
    headers: { Origin: origin },
    data: { password, confirmation: "DELETE" },
  });
  expect(removed.ok()).toBe(true);
  registered = false;
  expect((await page.request.get(`${origin}/api/account/me`)).status()).toBe(
    401,
  );
  evidence.checks.push("Own synthetic QA account deleted and session rejected");
  await writeFile(
    "artifacts/hosted-accounts.json",
    JSON.stringify(evidence, null, 2),
  );
  console.log(JSON.stringify(evidence));
} finally {
  if (registered && page) {
    // Cleanup is restricted to this probe's own authenticated synthetic account.
    await page.request
      .post(`${origin}/api/account/delete`, {
        headers: { Origin: origin },
        data: { password, confirmation: "DELETE" },
      })
      .catch(() => {});
  }
  await browser?.close();
  await stop(api);
  if (web?.pid) {
    try {
      process.kill(-web.pid, "SIGTERM");
    } catch {}
  }
}
