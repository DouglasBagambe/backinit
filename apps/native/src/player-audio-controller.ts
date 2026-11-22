import { playerAudioScript } from "./player-audio";

export type PlayerAudioHandle = { injectJavaScript: (script: string) => void };
export type NativeAudioModule = {
  setMuted: (
    tag: number,
    muted: boolean,
  ) => Promise<{ supported: boolean; muted?: boolean }>;
};

export function createPlayerAudioController(nativeAudio?: NativeAudioModule) {
  const requests = new WeakMap<PlayerAudioHandle, number>();
  /** Prefer muting the complete Android WebView; retain provider fallback on older engines. */
  return async function setPlayerAudio(
    view: PlayerAudioHandle | null | undefined,
    tag: number | null | undefined,
    muted: boolean,
  ) {
    if (!view) return;
    const request = (requests.get(view) || 0) + 1;
    requests.set(view, request);
    if (nativeAudio && tag != null) {
      try {
        const result = await nativeAudio.setMuted(tag, muted);
        if (result.supported) return;
      } catch {
        // A layout/load callback retries once the native surface has mounted.
      }
    }
    if (requests.get(view) === request)
      view.injectJavaScript(playerAudioScript(muted));
  };
}
