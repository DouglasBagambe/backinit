import { describe, expect, it } from "vitest";
import { playerHardeningScript } from "../apps/native/src/player-hardening";

describe("native player ad and popup hardening", () => {
  it("blocks popup APIs and external link click traps", () => {
    expect(playerHardeningScript).toContain("window.open = () => null");
    expect(playerHardeningScript).toContain(
      "destination.origin !== location.origin",
    );
    expect(playerHardeningScript).toContain("event.stopImmediatePropagation()");
    expect(playerHardeningScript).toContain(
      "document.addEventListener('auxclick'",
    );
  });
});
