import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 45000,
  fullyParallel: false,
  workers: 2,
  use: { baseURL: "http://127.0.0.1:3000", trace: "retain-on-failure" },
  webServer: [
    {
      command: "pnpm --filter @backinit/api start",
      url: "http://127.0.0.1:4000/health",
      reuseExistingServer: !process.env.CI,
    },
    {
      command: "pnpm --filter @backinit/web start",
      url: "http://127.0.0.1:3000",
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
    },
  ],
});
