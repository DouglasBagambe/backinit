import { afterEach, it, expect, vi } from "vitest";
import { validOrigin } from "../apps/web/app/lib/origin";
afterEach(() => vi.unstubAllEnvs());
it("uses the browser Host when Next normalizes its request URL; denies missing and foreign origins", () => {
  const request = (origin?: string) =>
    new Request("http://localhost:3000/api/account/login", {
      headers: { host: "127.0.0.1:3000", ...(origin ? { origin } : {}) },
    });
  expect(validOrigin(request("http://127.0.0.1:3000"))).toBe(true);
  expect(validOrigin(request("https://evil.test"))).toBe(false);
  expect(validOrigin(request("http://127.0.0.1:4000"))).toBe(false);
  expect(validOrigin(request())).toBe(false);
});
it("accepts same-host writes on both production domains while keeping previews and lookalikes out", () => {
  const request = (origin: string, host = new URL(origin).host) =>
    new Request("https://www.backinit.live/api/account/login", {
      headers: { origin, host },
    });
  for (const configured of [
    "https://www.backinit.live",
    "https://backinit.live",
  ]) {
    vi.stubEnv("APP_ORIGIN", configured);
    expect(validOrigin(request("https://backinit.live"))).toBe(true);
    expect(validOrigin(request("https://www.backinit.live"))).toBe(true);
    for (const origin of [
      "https://evil.test",
      "https://www.backinit.live.evil.test",
      "https://preview.backinit.live",
      "http://backinit.live",
      "https://backinit.live:8443",
    ])
      expect(validOrigin(request(origin))).toBe(false);
    const alternate = configured.includes("www.")
      ? "https://backinit.live"
      : "https://www.backinit.live";
    expect(validOrigin(request(alternate, "preview.example"))).toBe(false);
  }
  vi.stubEnv("APP_ORIGIN", "https://preview.example");
  expect(validOrigin(request("https://backinit.live"))).toBe(false);
});
