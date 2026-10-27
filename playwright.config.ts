import { defineConfig } from "@playwright/test";
import { resolve } from "node:path";
process.env.E2E_DATABASE_PATH ||= resolve(
  `apps/api/.data/e2e-${process.pid}.sqlite`,
);
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 45000,
  fullyParallel: false,
  workers: 1,
  use: { baseURL: "http://127.0.0.1:3000", trace: "retain-on-failure" },
  webServer: [
    {
      command: "pnpm --filter @backinit/api start",
      env: {
        SPORTS_DATA_MODE: "demo",
        NODE_ENV: "test",
        DATABASE_PATH: process.env.E2E_DATABASE_PATH,
      },
      url: "http://127.0.0.1:4000/health",
      reuseExistingServer: !process.env.CI,
    },
    {
      command: "pnpm --filter @backinit/web start",
      env: { SPORTS_DATA_MODE: "demo" },
      url: "http://127.0.0.1:3000",
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
    },
  ],
});
