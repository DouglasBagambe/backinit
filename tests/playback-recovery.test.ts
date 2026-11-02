import { afterEach, expect, it, vi } from "vitest";
import { playbackRecovery } from "../apps/web/app/lib/playback-recovery";
afterEach(() => vi.useRealTimers());
it("bounds consecutive network recovery, recovers media once, and cancels pending recovery on teardown", async () => {
  vi.useFakeTimers();
  const reload = vi.fn(),
    media = vi.fn(),
    exhausted = vi.fn();
  const recovery = playbackRecovery({
    reload,
    media,
    exhausted,
    cancelled: () => false,
  });
  recovery.fatal("network");
  await vi.advanceTimersByTimeAsync(1000);
  recovery.fatal("network");
  await vi.advanceTimersByTimeAsync(2000);
  expect(reload).toHaveBeenCalledTimes(2);
  recovery.fatal("network");
  expect(exhausted).toHaveBeenCalledTimes(1);
  recovery.fatal("media");
  expect(media).toHaveBeenCalledTimes(1);
  recovery.fatal("media");
  expect(exhausted).toHaveBeenCalledTimes(2);
  recovery.healthy();
  recovery.fatal("network");
  recovery.destroy();
  await vi.advanceTimersByTimeAsync(3000);
  expect(reload).toHaveBeenCalledTimes(2);
});
it("never restarts an abandoned player", async () => {
  vi.useFakeTimers();
  let cancelled = false;
  const reload = vi.fn();
  const r = playbackRecovery({
    reload,
    media: vi.fn(),
    exhausted: vi.fn(),
    cancelled: () => cancelled,
  });
  r.fatal("network");
  cancelled = true;
  await vi.advanceTimersByTimeAsync(3000);
  expect(reload).not.toHaveBeenCalled();
});
