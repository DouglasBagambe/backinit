import { defineConfig } from "@playwright/test";
import { resolve } from "node:path";
process.env.E2E_DATABASE_PATH ||= resolve(
  `apps/api/.data/e2e-${process.pid}.sqlite`,
);
const webPort = Number(process.env.E2E_WEB_PORT || 3100);
const apiPort = Number(process.env.E2E_API_PORT || 4100);
const webOrigin = `http://127.0.0.1:${webPort}`;
const apiOrigin = `http://127.0.0.1:${apiPort}`;
export default defineConfig({
  testDir: "tests/e2e",
  outputDir:
    process.env.E2E_BROWSER === "firefox"
      ? "test-results-firefox"
      : "test-results",
  timeout: 45000,
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: webOrigin,
    browserName: process.env.E2E_BROWSER === "firefox" ? "firefox" : "chromium",
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: "pnpm --filter @backinit/api start",
      env: {
        SPORTS_DATA_MODE: "demo",
        ALLOW_DEMO_MODE: "true",
        SPORTS_PROVIDERS_DISABLED: "true",
        STREAM_ALLOWED_HOSTS: "media.backinit.test",
        PORT: String(apiPort),
        WEB_ORIGIN: webOrigin,
        NODE_ENV: "test",
        DATABASE_PATH: process.env.E2E_DATABASE_PATH,
      },
      url: `${apiOrigin}/health`,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: `pnpm --filter @backinit/web start --port ${webPort}`,
      env: {
        SPORTS_DATA_MODE: "demo",
        ALLOW_DEMO_MODE: "true",
        API_URL: apiOrigin,
        APP_ORIGIN: webOrigin,
        // Ad requests are intercepted in advertising tests; no network permission is implied.
        ADSTERRA_NATIVE_ENABLED: "true",
      },
      url: webOrigin,
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
    },
  ],
});
