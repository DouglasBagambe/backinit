import { defineConfig } from "vitest/config";
export default defineConfig({
  resolve: {
    alias: {
      "@backinit/domain": new URL(
        "./packages/domain/src/index.ts",
        import.meta.url,
      ).pathname,
    },
  },
  test: { include: ["tests/**/*.test.ts"] },
});
