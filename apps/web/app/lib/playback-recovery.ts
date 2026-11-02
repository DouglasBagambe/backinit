/** Retry transport errors conservatively; never keep a dead source in a loop. */
export function playbackRecovery(actions: {
  reload: () => void;
  media: () => void;
  exhausted: () => void;
  cancelled: () => boolean;
}) {
  let networkRetries = 0;
  let recoveredMedia = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  return {
    healthy() {
      networkRetries = 0;
    },
    fatal(kind: "network" | "media" | "other") {
      if (actions.cancelled()) return;
      if (kind === "network" && networkRetries < 2) {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
          if (!actions.cancelled()) actions.reload();
        }, 1000 * ++networkRetries);
      } else if (kind === "media" && !recoveredMedia) {
        recoveredMedia = true;
        actions.media();
      } else actions.exhausted();
    },
    destroy() {
      if (timer) clearTimeout(timer);
    },
  };
}
