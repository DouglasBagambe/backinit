import { afterEach, expect, it, vi } from "vitest";
import { apiUrl } from "../apps/web/app/lib/api-url";

afterEach(() => vi.unstubAllEnvs());

it("uses the deployment binding at runtime and preserves its base path", () => {
  vi.stubEnv("API_URL", "http://127.0.0.1:4000");
  vi.stubEnv("API_INTERNAL_URL", "https://internal.example/service/api/");
  expect(apiUrl("/events?edition=real").href).toBe(
    "https://internal.example/service/api/events?edition=real",
  );
  vi.stubEnv("API_INTERNAL_URL", "https://preview.example/");
  expect(apiUrl("account/me").href).toBe("https://preview.example/account/me");
});

it("keeps local development working without a binding", () => {
  vi.stubEnv("VERCEL", "");
  vi.stubEnv("API_INTERNAL_URL", "");
  vi.stubEnv("API_URL", "http://127.0.0.1:4100");
  expect(apiUrl("/watch?date=2026-10-28").href).toBe(
    "http://127.0.0.1:4100/watch?date=2026-10-28",
  );
  vi.stubEnv("API_URL", "");
  expect(apiUrl("health").href).toBe("http://127.0.0.1:4000/health");
});

it("does not silently use localhost or a manually configured upstream on Vercel", () => {
  vi.stubEnv("API_BACKEND", "");
  vi.stubEnv("VERCEL", "1");
  vi.stubEnv("API_INTERNAL_URL", "");
  vi.stubEnv("API_URL", "https://old-deployment.example");
  expect(() => apiUrl("events")).toThrow("Missing api service binding");
});

it("uses the explicitly selected external backend instead of an old binding", () => {
  vi.stubEnv("VERCEL", "1");
  vi.stubEnv("API_BACKEND", "external");
  vi.stubEnv("API_INTERNAL_URL", "https://old-api.example/");
  vi.stubEnv("API_URL", "https://backinit-api.onrender.com");
  expect(apiUrl("/watch?date=2026-10-28").href).toBe(
    "https://backinit-api.onrender.com/watch?date=2026-10-28",
  );
  vi.stubEnv("API_URL", "http://127.0.0.1:4000");
  expect(() => apiUrl("events")).toThrow("Invalid API address");
  vi.stubEnv("API_URL", "");
  expect(() => apiUrl("events")).toThrow("Missing external API_URL");
});
