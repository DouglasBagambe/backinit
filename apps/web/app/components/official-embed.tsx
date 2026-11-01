"use client";
import { useEffect, useRef } from "react";
import { youtube, type YouTubePlayer } from "../lib/youtube";
export function OfficialEmbed({
  url,
  title,
  onState,
  onProgress,
}: {
  url: string;
  title: string;
  onState: (state: string) => void;
  onProgress: (seconds: number) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let disposed = false;
    let ready = false;
    let player: YouTubePlayer | undefined;
    let previous: number | undefined;
    let advanced = 0;
    let lastProgress = Date.now();
    const timer = setInterval(() => {
      if (disposed) return;
      const state = ready && player ? player.getPlayerState() : -1;
      // A loaded frame is not successful playback. Recover a silent startup or
      // stalled network, while allowing user pauses and hidden tabs indefinitely.
      if (document.hidden || state === 2 || state === 0)
        lastProgress = Date.now();
      if (Date.now() - lastProgress >= 20000) {
        clearInterval(timer);
        onState(
          "Playback unavailable: the video stopped responding. Retry or open the official source.",
        );
        return;
      }
      if (!player || !ready || state !== 1) {
        previous = undefined;
        advanced = 0;
        return;
      }
      const seconds = player.getCurrentTime();
      if (
        previous !== undefined &&
        seconds > previous &&
        seconds - previous < 5
      ) {
        advanced += seconds - previous;
        lastProgress = Date.now();
      }
      previous = seconds;
      if (advanced >= 2) onProgress(seconds);
    }, 1000);
    const container = host.current;
    void youtube()
      .then((api) => {
        if (disposed || !container) return;
        const target = document.createElement("div");
        container.replaceChildren(target);
        player = new api.Player(target, {
          videoId: new URL(url).pathname.split("/").pop()!,
          host: "https://www.youtube-nocookie.com",
          playerVars: { playsinline: 1, autoplay: 1, origin: location.origin },
          events: {
            onReady: () => {
              ready = true;
              lastProgress = Date.now();
              if (!disposed) {
                const frame = container.querySelector("iframe");
                if (frame) {
                  frame.title = title;
                  frame.referrerPolicy = "strict-origin-when-cross-origin";
                }
                onState("Ready to play");
              }
            },
            onError: (event) => {
              if (!disposed)
                onState(
                  event.data === 153
                    ? "The provider could not verify this player’s origin. Open the official source to watch."
                    : event.data === 101 || event.data === 150
                      ? "The publisher has disabled playback on other sites. Open the official source to watch."
                      : "Video unavailable here. The provider may restrict embedding, region or age. Retry or open the official source.",
                );
            },
            onStateChange: (event) => {
              if (disposed) return;
              const states: Record<number, string> = {
                0: "Playback ended",
                1: "Playing",
                2: "Paused",
                3: "Buffering…",
              };
              if (states[event.data]) onState(states[event.data]!);
            },
          },
        });
      })
      .catch((error) => {
        if (!disposed) onState((error as Error).message);
      });
    return () => {
      disposed = true;
      clearInterval(timer);
      player?.destroy();
      container?.replaceChildren();
    };
  }, [url, title, onState, onProgress]);
  return <div className="official-embed" ref={host} aria-label={title} />;
}
