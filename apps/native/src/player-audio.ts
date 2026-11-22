/**
 * Keep media created by provider pages aligned with the app-owned mute state.
 * The script is intentionally self-contained because it runs inside a WebView.
 */
export function playerAudioScript(muted: boolean) {
  return `(() => {
    const muted = ${muted ? "true" : "false"};
    window.__backinitMuted = muted;
    const apply = () => {
      document.querySelectorAll('video,audio').forEach((media) => {
        if (muted) {
          if (!media.dataset.backinitVolume) {
            media.dataset.backinitVolume = String(media.volume);
          }
          media.muted = true;
          media.volume = 0;
        } else {
          media.muted = false;
          const volume = Number(media.dataset.backinitVolume);
          media.volume = Number.isFinite(volume) ? volume : 1;
          delete media.dataset.backinitVolume;
        }
      });
    };
    apply();
    if (!window.__backinitAudioObserver) {
      window.__backinitAudioObserver = new MutationObserver(apply);
      window.__backinitAudioObserver.observe(document.documentElement, {
        childList: true,
        subtree: true,
      });
      document.addEventListener('volumechange', (event) => {
        const media = event.target;
        if (window.__backinitMuted && media &&
            (media.tagName === 'VIDEO' || media.tagName === 'AUDIO') &&
            (!media.muted || media.volume !== 0)) {
          media.muted = true;
          media.volume = 0;
        }
      }, true);
    }
  })(); true;`;
}
