import { it, expect } from "vitest";
import { validOrigin } from "../apps/web/app/lib/origin";
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
