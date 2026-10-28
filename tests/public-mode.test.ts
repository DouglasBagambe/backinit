import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveEdition, demoEnabled } from "../apps/web/app/lib/edition";
import { apiUrl } from "../apps/web/app/lib/api-url";
import { SportsService } from "../apps/api/src/providers/service";
afterEach(() => vi.unstubAllEnvs());
describe("public installation defaults", () => {
  it("ignores old demo cookies and old default settings unless explicitly enabled", () => {
    vi.stubEnv("ALLOW_DEMO_MODE", undefined);
    vi.stubEnv("SPORTS_DATA_MODE", "demo");
    expect(demoEnabled()).toBe(false);
    expect(resolveEdition("demo")).toBe("real");
    expect(resolveEdition()).toBe("real");
    vi.stubEnv("ALLOW_DEMO_MODE", "true");
    expect(resolveEdition("demo")).toBe("demo");
    expect(resolveEdition("real")).toBe("real");
  });
  it("rejects API demo requests and does not substitute snapshots when ingestion is disabled outside tests", async () => {
    vi.stubEnv("ALLOW_DEMO_MODE", undefined);
    vi.stubEnv("SPORTS_PROVIDERS_DISABLED", "true");
    vi.stubEnv("NODE_ENV", "production");
    const s = new SportsService();
    await expect(s.feed("demo")).rejects.toThrow("Demo mode is disabled");
    expect(await s.feed("real")).toMatchObject({
      data: [],
      edition: "real",
      coverage: [{ status: "unavailable" }],
    });
  });
});
describe("deployed backend routing", () => {
  it("prefers the injected service binding and preserves the service path", () => {
    vi.stubEnv("API_INTERNAL_URL", "https://private.example.test/backend/");
    vi.stubEnv("API_URL", "https://other.example.test/");
    expect(apiUrl("/events?edition=real").href).toBe(
      "https://private.example.test/backend/events?edition=real",
    );
  });
  it("accepts an externally hosted API and fails explicitly on an unconfigured Vercel deployment", () => {
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("API_INTERNAL_URL", undefined);
    vi.stubEnv("API_URL", undefined);
    expect(() => apiUrl("/events")).toThrow("Configure API");
    vi.stubEnv("API_URL", "https://api.example.test");
    expect(apiUrl("/events").origin).toBe("https://api.example.test");
    expect(() => apiUrl("//untrusted.example.test")).toThrow(
      "Invalid API path",
    );
  });
});
