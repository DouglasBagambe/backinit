import { describe, expect, it } from "vitest";
import { isAdFreeHost } from "../apps/web/app/lib/ad-host";

describe("ad-free host", () => {
  it("disables BackInIt advertising only on the private db subdomain", () => {
    expect(isAdFreeHost("db.backinit.live")).toBe(true);
    expect(isAdFreeHost("DB.BACKINIT.LIVE.")).toBe(true);
    expect(isAdFreeHost("backinit.live")).toBe(false);
    expect(isAdFreeHost("db.backinit.live.example.com")).toBe(false);
  });
});
