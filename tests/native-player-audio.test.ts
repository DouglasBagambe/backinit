import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";
import { playerAudioScript } from "../apps/native/src/player-audio";

function player() {
  const media = { muted: false, volume: 0.7, dataset: {} };
  let changed = () => {};
  const context = {
    window: {} as Record<string, unknown>,
    document: {
      documentElement: {},
      querySelectorAll: (selector: string) =>
        selector === "iframe" ? [] : [media],
      addEventListener: () => {},
    },
    MutationObserver: class {
      constructor(callback: () => void) {
        changed = callback;
      }
      observe() {}
    },
  };
  return {
    media,
    change: () => changed(),
    setMuted: (muted: boolean) =>
      runInNewContext(playerAudioScript(muted), context),
  };
}

describe("native player audio controls", () => {
  it("retains the latest mute state when provider content changes", () => {
    const page = player();
    page.setMuted(false);
    page.setMuted(true);
    page.change();
    expect(page.media.muted).toBe(true);
    expect(page.media.volume).toBe(0);
  });

  it("restores the original volume after subsequent page changes", () => {
    const page = player();
    page.setMuted(true);
    page.setMuted(false);
    page.change();
    expect(page.media.muted).toBe(false);
    expect(page.media.volume).toBe(0.7);
  });
});
