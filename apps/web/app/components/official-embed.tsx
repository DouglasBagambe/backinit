"use client";
import { useEffect, useRef } from "react";
import { youtube } from "../lib/youtube";
export function OfficialEmbed({
  url,
  title,
  onState,
}: {
  url: string;
  title: string;
  onState: (state: string) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let disposed = false;
    let player: { destroy(): void } | undefined;
    const container = host.current;
    void youtube()
      .then((api) => {
        if (disposed || !container) return;
        const target = document.createElement("div");
        container.replaceChildren(target);
        player = new api.Player(target, {
          videoId: new URL(url).pathname.split("/").pop()!,
          host: "https://www.youtube-nocookie.com",
          playerVars: { playsinline: 1, origin: location.origin },
          events: {
            onReady: () => {
              if (!disposed) {
                const frame = container.querySelector("iframe");
                if (frame) {
                  frame.title = title;
                  frame.referrerPolicy = "strict-origin-when-cross-origin";
                }
                onState("Official player ready · press play");
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
                1: "Playing official video",
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
      player?.destroy();
      container?.replaceChildren();
    };
  }, [url, title, onState]);
  return <div className="official-embed" ref={host} aria-label={title} />;
}
