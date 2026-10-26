"use client";
import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
const sources = [
  {
    id: "hls",
    name: "Big Buck Bunny · HLS test",
    url: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
  },
] as const;
export function Player() {
  const video = useRef<HTMLVideoElement>(null);
  const engine = useRef<Hls | null>(null);
  const [started, start] = useState(false);
  const [attempt, retry] = useState(0);
  const [state, setState] = useState("Ready to play");
  const [levels, setLevels] = useState<{ label: string; index: number }[]>([]);
  const [quality, setQuality] = useState(-1);
  useEffect(() => {
    if (!started || !video.current) return;
    const el = video.current;
    setState("Loading test stream…");
    setLevels([]);
    setQuality(-1);
    if (el.canPlayType("application/vnd.apple.mpegurl"))
      el.src = sources[0].url;
    else if (Hls.isSupported()) {
      const h = new Hls();
      engine.current = h;
      h.loadSource(sources[0].url);
      h.attachMedia(el);
      h.on(Hls.Events.MANIFEST_PARSED, () =>
        setLevels(
          h.levels.map((l, index) => ({ label: `${l.height}p`, index })),
        ),
      );
      h.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal)
          setState("Playback unavailable. Check your connection and retry.");
      });
    } else setState("This browser does not support HLS playback.");
    return () => {
      engine.current?.destroy();
      engine.current = null;
      el.removeAttribute("src");
      el.load();
    };
  }, [started, attempt]);
  return (
    <section className="player">
      <div className="player-screen">
        {started ? (
          <video
            ref={video}
            controls
            playsInline
            preload="metadata"
            onPlaying={() => setState("Playing test film")}
            onWaiting={() => setState("Buffering…")}
            onCanPlay={() => setState("Ready · press play")}
            onError={() =>
              setState("Playback unavailable. Check your connection and retry.")
            }
            aria-label="Big Buck Bunny test film"
          />
        ) : (
          <div className="player-intro">
            <span className="eyebrow">THE PLAYBACK LAB</span>
            <h2>A front-row experience.</h2>
            <p>
              Try our integrated player with Big Buck Bunny, an open movie.
              <br />
              This is a test film, not a sports broadcast.
            </p>
            <button className="primary" onClick={() => start(true)}>
              ▶ Load test player
            </button>
          </div>
        )}
      </div>
      <div className="player-bar">
        <span role="status">{state}</span>
        {started && <button onClick={() => retry((a) => a + 1)}>Retry</button>}
        {levels.length > 0 && (
          <label>
            Quality{" "}
            <select
              aria-label="Video quality"
              value={quality}
              onChange={(e) => {
                const q = Number(e.target.value);
                setQuality(q);
                if (engine.current) engine.current.currentLevel = q;
              }}
            >
              <option value={-1}>Auto</option>
              {levels.map((l) => (
                <option key={l.index} value={l.index}>
                  {l.label}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      <p className="fine">
        Test source: Big Buck Bunny by Blender Foundation, CC BY 3.0. Native
        controls include fullscreen and picture-in-picture where supported.{" "}
        <a href="https://peach.blender.org/" target="_blank" rel="noreferrer">
          About the film ↗
        </a>
      </p>
    </section>
  );
}
