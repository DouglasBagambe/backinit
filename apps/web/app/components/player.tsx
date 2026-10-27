"use client";
import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import type { MediaPlayerClass } from "dashjs";
import {
  streamSourceSchema,
  sourceIsActive,
  type StreamSource,
} from "@backinit/domain";
import { z } from "zod";
export function Player({ eventId }: { eventId?: string }) {
  const video = useRef<HTMLVideoElement>(null);
  const engine = useRef<Hls | null>(null);
  const dash = useRef<MediaPlayerClass | null>(null);
  const [sources, setSources] = useState<StreamSource[]>([]);
  const [selected, select] = useState("");
  const [started, start] = useState(false);
  const [attempt, retry] = useState(0);
  const [state, setState] = useState("Loading source registry…");
  const [health, setHealth] = useState("");
  const [levels, setLevels] = useState<{ label: string; index: number }[]>([]);
  const [quality, setQuality] = useState(-1);
  const [embedConsent, setEmbedConsent] = useState(false);
  const source = sources.find((s) => s.id === selected);
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch(
          `/api/streams${eventId ? `?event=${encodeURIComponent(eventId)}` : ""}`,
          { signal: controller.signal },
        );
        if (!response.ok) throw new Error();
        const result = z
          .object({ data: z.array(streamSourceSchema) })
          .parse(await response.json());
        const active = result.data.filter((s) => sourceIsActive(s));
        setSources(active);
        select(active[0]?.id || "");
        setState(
          active.length
            ? "Ready to play"
            : "No authorized sources are configured.",
        );
      } catch {
        if (!controller.signal.aborted)
          setState("Source registry unavailable. Reload to retry.");
      }
    }
    void load();
    return () => controller.abort();
  }, [eventId]);
  useEffect(() => {
    if (!source || !started) return;
    let disposed = false;
    const el = video.current;
    const failure = () => {
      if (!disposed)
        setState("Playback unavailable. Check your connection and retry.");
    };
    setState(
      source.content === "test" ? "Loading test stream…" : "Loading stream…",
    );
    setHealth("Checking source availability…");
    setLevels([]);
    setQuality(-1);
    const check = new AbortController();
    const checkAvailability = () => {
      void fetch(`/api/streams/${source.id}/health`, { signal: check.signal })
        .then(async (r) => {
          if (r.status === 404) throw new Error("revoked");
          return r.json();
        })
        .then((r) => {
          if (!disposed) setHealth(r.message);
        })
        .catch((e) => {
          if (disposed) return;
          if (e.message === "revoked") {
            setState("Source is no longer available.");
            start(false);
            setSources((list) => list.filter((s) => s.id !== source.id));
            engine.current?.destroy();
            dash.current?.reset();
            if (el) {
              el.pause();
              el.removeAttribute("src");
              el.load();
            }
          } else
            setHealth("Availability check failed. Playback may still work.");
        });
    };
    checkAvailability();
    const healthTimer = setInterval(checkAvailability, 60000);
    const expiry = setInterval(() => {
      if (Date.now() < Date.parse(source.validUntil)) return;
      failure();
      start(false);
      setSources((list) => list.filter((s) => s.id !== source.id));
      engine.current?.destroy();
      dash.current?.reset();
      if (el) {
        el.pause();
        el.removeAttribute("src");
        el.load();
      }
    }, 1000);
    async function attach() {
      if (source!.type === "embed") {
        setState(
          "Provider embed ready · player controls belong to the provider",
        );
        return;
      }
      if (!el) return;
      if (source!.type === "dash") {
        const { MediaPlayer } = await import("dashjs");
        if (disposed) return;
        const player = MediaPlayer().create();
        dash.current = player;
        player.on(MediaPlayer.events.ERROR, failure);
        player.initialize(el, source!.url, false);
      } else if (el.canPlayType("application/vnd.apple.mpegurl"))
        el.src = source!.url;
      else if (Hls.isSupported()) {
        const h = new Hls({ maxBufferLength: 30 });
        engine.current = h;
        h.loadSource(source!.url);
        h.attachMedia(el);
        h.on(Hls.Events.MANIFEST_PARSED, () => {
          if (!disposed)
            setLevels(
              h.levels.map((l, index) => ({ label: `${l.height}p`, index })),
            );
        });
        h.on(Hls.Events.ERROR, (_, data) => {
          if (data.fatal) failure();
        });
      } else setState("This browser does not support this stream format.");
    }
    void attach().catch(failure);
    return () => {
      disposed = true;
      check.abort();
      clearInterval(expiry);
      clearInterval(healthTimer);
      engine.current?.destroy();
      engine.current = null;
      dash.current?.reset();
      dash.current = null;
      if (el) {
        el.pause();
        el.removeAttribute("src");
        el.load();
      }
    };
  }, [started, attempt, source]);
  return (
    <section className="player">
      <div className="player-screen">
        {started && source ? (
          source.type === "embed" ? (
            embedConsent ? (
              <iframe
                title={source.name}
                src={source.url}
                allow="fullscreen; picture-in-picture; encrypted-media"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
                sandbox="allow-scripts allow-same-origin allow-presentation"
              />
            ) : (
              <div className="player-intro">
                <h2>Watch with the provider.</h2>
                <p>
                  Loading this embed connects to YouTube. Its privacy policy and
                  player controls apply.
                </p>
                <button onClick={() => setEmbedConsent(true)}>
                  Load permitted embed
                </button>
              </div>
            )
          ) : (
            <video
              ref={video}
              controls
              playsInline
              preload="metadata"
              onPlaying={() =>
                setState(
                  source.content === "test" ? "Playing test film" : "Playing",
                )
              }
              onWaiting={() => setState("Buffering…")}
              onCanPlay={() => setState("Ready · press play")}
              onError={() =>
                setState(
                  "Playback unavailable. Check your connection and retry.",
                )
              }
              aria-label={
                source.content === "test"
                  ? "Big Buck Bunny test film"
                  : source.name
              }
            />
          )
        ) : (
          <div className="player-intro">
            <span className="eyebrow">
              {eventId ? "IN THE FRONT ROW" : "THE PLAYBACK LAB"}
            </span>
            <h2>A front-row experience.</h2>
            <p>
              {eventId
                ? "Watch here when an authorized source is available."
                : "Try integrated playback with Big Buck Bunny, an open movie. This is a test film, not a sports broadcast."}
            </p>
            <button
              disabled={!source}
              className="primary"
              onClick={() => start(true)}
            >
              ▶ {eventId ? "Load player" : "Load test player"}
            </button>
          </div>
        )}
      </div>
      <div className="player-bar">
        <span role="status">{state}</span>
        {sources.length > 0 && (
          <label>
            Source{" "}
            <select
              aria-label="Stream source"
              value={selected}
              onChange={(e) => {
                select(e.target.value);
                setEmbedConsent(false);
                setHealth("");
              }}
            >
              {sources.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        )}
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
      {health && <p className="fine">{health}</p>}
      {source && (
        <p className="fine">
          {source.content === "test"
            ? "Test film · Big Buck Bunny by Blender Foundation · CC BY 3.0. "
            : "Authorized source · "}
          {source.rightsOwner}. Native controls include fullscreen and
          picture-in-picture where supported.{" "}
          <a href={source.rightsEvidence} target="_blank" rel="noreferrer">
            Source & rights ↗
          </a>
        </p>
      )}
    </section>
  );
}
