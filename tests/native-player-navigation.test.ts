import { describe, expect, it } from "vitest";
import { isPlayerNavigationAllowed } from "../apps/native/src/player-navigation.js";

describe("native player navigation", () => {
  const player = "https://ppv.st/embed/match-one";

  it("keeps normal playback navigation on the provider origin", () => {
    expect(isPlayerNavigationAllowed(player, player)).toBe(true);
    expect(isPlayerNavigationAllowed(player, "/embed/match-two?source=2")).toBe(
      true,
    );
    expect(isPlayerNavigationAllowed(player, "about:blank")).toBe(true);
  });

  it("blocks ads and external schemes from replacing the app player", () => {
    expect(
      isPlayerNavigationAllowed(player, "https://ads.example/click-through"),
    ).toBe(false);
    expect(isPlayerNavigationAllowed(player, "intent://advertisement")).toBe(
      false,
    );
    expect(isPlayerNavigationAllowed(player, "javascript:alert(1)")).toBe(
      false,
    );
  });
});
