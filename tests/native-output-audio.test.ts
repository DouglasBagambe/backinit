import { beforeEach, describe, expect, it, vi } from "vitest";

import { createPlayerAudioController } from "../apps/native/src/player-audio-controller";

const setMuted = vi.fn();
let setPlayerAudio: ReturnType<typeof createPlayerAudioController>;
beforeEach(() => {
  setMuted.mockReset();
  setPlayerAudio = createPlayerAudioController({ setMuted });
});

describe("native output audio", () => {
  it("mutes the browser surface without changing provider media when supported", async () => {
    setMuted.mockResolvedValue({ supported: true, muted: true });
    const view = { injectJavaScript: vi.fn() };
    await setPlayerAudio(view, 42, true);
    expect(setMuted).toHaveBeenCalledWith(42, true);
    expect(view.injectJavaScript).not.toHaveBeenCalled();
  });

  it("retains provider fallback on engines without native output muting", async () => {
    setMuted.mockResolvedValue({ supported: false });
    const view = { injectJavaScript: vi.fn() };
    await setPlayerAudio(view, 42, true);
    expect(view.injectJavaScript).toHaveBeenCalledOnce();
  });

  it("does not reapply a stale fallback after a rapid mute/unmute", async () => {
    let finish!: (value: { supported: boolean }) => void;
    setMuted.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    setMuted.mockResolvedValueOnce({ supported: false });
    const view = { injectJavaScript: vi.fn() };
    const first = setPlayerAudio(view, 42, true);
    await setPlayerAudio(view, 42, false);
    finish({ supported: false });
    await first;
    expect(view.injectJavaScript).toHaveBeenCalledOnce();
    expect(view.injectJavaScript.mock.calls[0]?.[0]).toContain(
      "const muted = false",
    );
  });

  it("handles a view that disappears during the native request", async () => {
    setMuted.mockRejectedValue(new Error("PLAYER_NOT_READY"));
    const view = { injectJavaScript: vi.fn() };
    await expect(setPlayerAudio(view, 42, true)).resolves.toBeUndefined();
    expect(view.injectJavaScript).toHaveBeenCalledOnce();
  });
});
