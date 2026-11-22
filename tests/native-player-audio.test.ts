import { describe, expect, it } from "vitest";
import { playerAudioScript } from "../apps/native/src/player-audio";

describe("native player audio controls", () => {
  it("mutes current and subsequently-created media", () => {
    const script = playerAudioScript(true);
    expect(script).toContain("window.__backinitMuted = muted");
    expect(script).toContain("media.muted = true");
    expect(script).toContain("media.volume = 0");
    expect(script).toContain("new MutationObserver(apply)");
  });

  it("restores media volume when unmuted", () => {
    const script = playerAudioScript(false);
    expect(script).toContain("const muted = false");
    expect(script).toContain("media.muted = false");
    expect(script).toContain("media.dataset.backinitVolume");
  });
});
