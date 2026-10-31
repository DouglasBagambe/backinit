"use client";
import { BrandLoading } from "./brand";
import { Play } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { OfficialEmbed } from "./official-embed";
import {
  streamSourceSchema,
  sourceIsActive,
  type StreamSource,
  type PlaybackReport,
} from "@backinit/domain";
import { attachPlayback, type Transport } from "../lib/playback-engine";
import { z } from "zod";
export function Player({
  eventId,
  sourceId,
  previewSource,
  onPlaybackReport,
  fallback,
  onAvailability,
}: {
  eventId?: string;
  fallback?: React.ReactNode;
  onAvailability?: (available: boolean) => void;
  sourceId?: string;
  previewSource?: StreamSource;
  onPlaybackReport?: (report: PlaybackReport) => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const screen = useRef<HTMLDivElement>(null);
  const engine = useRef<Transport | undefined>(undefined);
  const [sources, setSources] = useState<StreamSource[]>([]);
  const [selected, select] = useState("");
  const [started, start] = useState(false);
  const [attempt, retry] = useState(0);
  const [registryAttempt, reload] = useState(0);
  const [state, setState] = useState("Checking streams…");
  const [health, setHealth] = useState("");
  const [levels, setLevels] = useState<{ label: string; index: number }[]>([]);
  const [quality, setQuality] = useState(-1);
  const [consent, setConsent] = useState(false);
  const [isLive, setLive] = useState(false);
  const [controls, setControls] = useState({ fullscreen: false, pip: false });
  const reported = useRef(false);
  const failedSources = useRef(new Set<string>());
  const liveRef = useRef(false);
  const reportRef = useRef(onPlaybackReport);
  reportRef.current = onPlaybackReport;
  const source = sources.find((s) => s.id === selected);
  const playbackFailed =
    /unavailable|could not|disabled|restrict|withdrawn|expired/i.test(state) &&
    !state.startsWith("Streams unavailable") &&
    !state.includes("viewing mode");
  useEffect(() => {
    onAvailability?.(Boolean(source) && !playbackFailed);
  }, [Boolean(source), playbackFailed, onAvailability]);
  const sourcesRef = useRef(sources);
  sourcesRef.current = sources;
  useEffect(() => {
    setControls({
      fullscreen: !!document.fullscreenEnabled,
      pip: !!document.pictureInPictureEnabled,
    });
  }, []);
  useEffect(() => {
    if (previewSource) {
      setSources([previewSource]);
      select(previewSource.id);
      start(true);
      setState("Administrator preview · source is not published by this check");
      return;
    }
    const controller = new AbortController();
    let running = false;
    let first = true;
    async function load() {
      if (running || controller.signal.aborted) return;
      running = true;
      try {
        const response = await fetch(
          `/api/streams${eventId ? `?event=${encodeURIComponent(eventId)}` : sourceId ? "?library=1" : ""}`,
          {
            signal: AbortSignal.any([
              controller.signal,
              AbortSignal.timeout(20000),
            ]),
          },
        );
        if (!response.ok) throw new Error();
        const result = z
          .object({ data: z.array(streamSourceSchema) })
          .parse(await response.json());
        const active = result.data.filter(
          (s) => sourceIsActive(s) && (!sourceId || s.id === sourceId),
        );
        // Preserve object identity across polling so a healthy playing engine is not restarted.
        setSources((old) => {
          const stable = active.map((item) => {
            const previous = old.find((s) => s.id === item.id);
            return previous && JSON.stringify(previous) === JSON.stringify(item)
              ? previous
              : item;
          });
          return old.length === stable.length &&
            stable.every((s, i) => s === old[i])
            ? old
            : stable;
        });
        select((old) =>
          active.some((s) => s.id === old)
            ? old
            : sourceId && active.some((s) => s.id === sourceId)
              ? sourceId
              : active[0]?.id || "",
        );
        if (first) {
          if (sourceId || eventId) start(true);
          setState(
            active.length ? "Ready · press play" : "No stream available.",
          );
          first = false;
        }
      } catch {
        if (!controller.signal.aborted)
          setState("Streams unavailable. Try again.");
      } finally {
        running = false;
      }
    }
    void load();
    const timer = setInterval(() => {
      if (!document.hidden) void load();
    }, 60000);
    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, [eventId, sourceId, previewSource, registryAttempt]);
  useEffect(() => {
    if (!source || !started) return;
    // Registry refreshes can select an earlier source after a revocation.
    // Only an explicit Retry or source choice may restart a known failure.
    if (failedSources.current.has(source.id)) {
      start(false);
      setState("Playback unavailable. Retry or choose another source.");
      return;
    }
    let disposed = false;
    let transport: Transport | undefined;
    const element = video.current;
    const withdraw = (message: string) => {
      const alternatives = sourcesRef.current.filter(
        (s) => s.id !== source.id && sourceIsActive(s),
      );
      const next = alternatives.find(
        (item) => !failedSources.current.has(item.id),
      );
      setSources(alternatives);
      select(next?.id || alternatives[0]?.id || "");
      start(Boolean(next));
      setConsent(false);
      setState(
        next
          ? "Switching source…"
          : alternatives.length
            ? "Playback unavailable. Retry or choose another source."
            : message,
      );
    };
    const fail = () => {
      if (!disposed) {
        failedSources.current.add(source.id);
        setState("Playback unavailable. Retry or choose another source.");
      }
    };
    reported.current = false;
    liveRef.current = false;
    setLive(false);
    setLevels([]);
    setQuality(-1);
    setState(source.type === "embed" ? "Ready to play" : "Loading stream…");
    const loadingTimer =
      source.type === "embed" ? undefined : setTimeout(fail, 15000);
    const decoded = () => clearTimeout(loadingTimer);
    element?.addEventListener("loadeddata", decoded);
    const check = new AbortController();
    const availability = () => {
      if (previewSource) {
        setHealth(
          "Administrator preview. Playback is checked in this browser; technical playback does not establish distribution rights.",
        );
        return;
      }
      void fetch(`/api/streams/${source.id}/health`, { signal: check.signal })
        .then(async (r) => {
          if (r.status === 404) throw new Error("revoked");
          if (!r.ok) throw new Error();
          return r.json();
        })
        .then((r) => {
          if (!disposed) setHealth(r.message);
        })
        .catch((error) => {
          if (disposed) return;
          if (error.message === "revoked") {
            withdraw("Source withdrawn or its playback verification expired.");
          } else
            setHealth("Availability check failed. Playback may still work.");
        });
    };
    availability();
    const healthTimer = setInterval(availability, 60000);
    const expiry = setInterval(() => {
      const latest = sourcesRef.current.find((s) => s.id === source.id);
      if (previewSource || (latest && sourceIsActive(latest))) return;
      withdraw("Source availability window has ended.");
    }, 1000);
    if (source.type !== "embed" && element)
      void attachPlayback(element, source, {
        cancelled: () => disposed,
        error: fail,
        levels: setLevels,
        live: (value) => {
          if (!disposed) {
            setLive(value);
            liveRef.current = value;
          }
        },
      })
        .then((value) => {
          if (disposed) value?.destroy();
          else {
            transport = value;
            engine.current = value;
          }
        })
        .catch(fail);
    return () => {
      disposed = true;
      check.abort();
      clearTimeout(loadingTimer);
      element?.removeEventListener("loadeddata", decoded);
      clearInterval(healthTimer);
      clearInterval(expiry);
      transport?.destroy();
      if (engine.current === transport) engine.current = undefined;
      if (element) {
        element.pause();
        element.removeAttribute("src");
        element.load();
      }
    };
    // Lease/metadata refreshes must not restart a healthy playing broadcast.
  }, [
    source?.id,
    source?.url,
    source?.version,
    source?.type,
    started,
    attempt,
    previewSource,
  ]);
  const embedState = useCallback((value: string) => {
    setState(value);
  }, []);
  const embedProgress = useCallback((seconds: number) => {
    if (!reported.current) {
      reported.current = true;
      reportRef.current?.({
        result: "passed",
        method: "provider-player",
        currentTime: seconds,
        width: 0,
        height: 0,
      });
    }
  }, []);
  const errorState = async (action: () => Promise<unknown>) => {
    try {
      await action();
    } catch {
      setState(
        "This browser could not open that viewing mode. Use the player’s native controls where supported.",
      );
    }
  };
  const youtube =
    source && new URL(source.url).hostname === "www.youtube-nocookie.com";
  const failed =
    /unavailable|could not|disabled|restrict|withdrawn|expired/i.test(state);
  const retryPlayback = () => {
    if (source) failedSources.current.delete(source.id);
    start(true);
    setState("Ready to play");
    retry((n) => n + 1);
  };
  const selectSource = (id: string) => {
    failedSources.current.delete(id);
    start(true);
    setState("Ready to play");
    select(id);
    setConsent(false);
    setHealth("");
  };
  const sourceSelector = sources.length > 1 && (
    <label>
      Source{" "}
      <select
        aria-label="Stream source"
        value={selected}
        onChange={(e) => selectSource(e.target.value)}
      >
        {sources.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
            {s.content === "sports" ? ` · ${s.presentation || "live"}` : ""}
          </option>
        ))}
      </select>
    </label>
  );
  const nextSource = failed && sources.length > 1 && (
    <button
      onClick={() =>
        selectSource(
          sources[
            (sources.findIndex((s) => s.id === selected) + 1) % sources.length
          ]!.id,
        )
      }
    >
      Try next source
    </button>
  );
  if (eventId && (!source || (playbackFailed && fallback)))
    return (
      <section
        className={`player player-unavailable${fallback ? " player-tracker-fallback" : ""}`}
        aria-label="Event player"
      >
        {fallback}
        <div className="player-empty">
          <div role="status">
            <h2 className={fallback ? "sr-only" : undefined}>
              {state === "Checking streams…"
                ? state
                : state.startsWith("Streams unavailable")
                  ? "Unable to check streams"
                  : failed && source
                    ? "Stream unavailable here"
                    : "No stream available"}
            </h2>
            {source && <span className="sr-only">{state}</span>}
          </div>
          {sourceSelector}
          {nextSource}
          {source && <button onClick={retryPlayback}>Retry</button>}
          <button
            onClick={() => {
              retryPlayback();
              reload((n) => n + 1);
            }}
          >
            Check streams
          </button>
        </div>
      </section>
    );
  return (
    <section
      className={`player${eventId && !source ? " player-unavailable" : ""}`}
      aria-label={
        previewSource
          ? "Administrator playback preview"
          : eventId
            ? "Event player"
            : "Video player"
      }
    >
      <div className="player-screen" ref={screen}>
        {started && source ? (
          source.type === "embed" ? (
            consent ? (
              youtube ? (
                <OfficialEmbed
                  key={`${source.id}-${attempt}`}
                  url={source.url}
                  title={source.name}
                  onState={embedState}
                  onProgress={embedProgress}
                />
              ) : (
                <iframe
                  key={`${source.id}-${attempt}`}
                  className="permitted-embed"
                  src={source.url}
                  title={source.name}
                  allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
                  allowFullScreen
                  sandbox="allow-scripts allow-same-origin allow-presentation"
                  referrerPolicy="strict-origin-when-cross-origin"
                  onLoad={() =>
                    setState("Publisher frame loaded · playback unverified")
                  }
                />
              )
            ) : (
              <div className="player-intro player-consent">
                {source.catalog && (
                  <img
                    className="player-poster"
                    src={source.catalog.thumbnail}
                    alt=""
                    referrerPolicy="no-referrer"
                  />
                )}
                <div className="player-consent-copy">
                  <button
                    className="player-play"
                    aria-label="Play video"
                    onClick={() => setConsent(true)}
                  >
                    <Play
                      size={48}
                      fill="currentColor"
                      strokeWidth={0}
                      aria-hidden="true"
                    />
                  </button>
                </div>
              </div>
            )
          ) : (
            <video
              ref={video}
              controls
              playsInline
              preload="metadata"
              aria-label={source.name}
              onPlaying={() =>
                setState(
                  source.content === "test" ? "Playing test signal" : "Playing",
                )
              }
              onPause={() => setState("Paused")}
              onWaiting={() => setState("Buffering…")}
              onCanPlay={() => setState("Ready · press play")}
              onDurationChange={(e) => {
                if (e.currentTarget.duration === Infinity) {
                  setLive(true);
                  liveRef.current = true;
                }
              }}
              onError={() =>
                setState(
                  "Playback unavailable. Retry or choose another source.",
                )
              }
              onTimeUpdate={(e) => {
                const v = e.currentTarget;
                if (
                  !reported.current &&
                  Array.from(
                    { length: v.played.length },
                    (_, i) => v.played.end(i) - v.played.start(i),
                  ).reduce((total, n) => total + n, 0) > 1 &&
                  v.currentTime > 1 &&
                  v.readyState >= 2 &&
                  v.videoWidth > 0 &&
                  !v.paused
                ) {
                  reported.current = true;
                  reportRef.current?.({
                    result: "passed",
                    method: "native-decoded",
                    currentTime: v.currentTime,
                    width: v.videoWidth,
                    height: v.videoHeight,
                    live: liveRef.current,
                  });
                }
              }}
            />
          )
        ) : (
          <div className="player-intro">
            <span className="eyebrow">
              {eventId
                ? "EVENT VIEWING"
                : sourceId
                  ? "OFFICIAL VIDEO"
                  : "PLAYBACK VERIFICATION"}
            </span>
            <h2>
              {eventId
                ? source
                  ? "Watch this event"
                  : "No stream available"
                : sourceId
                  ? "Video unavailable"
                  : "Test the player"}
            </h2>
            <p>
              {eventId
                ? "Check the viewing options below."
                : sourceId
                  ? "This video is no longer listed. Choose another video or open its official source."
                  : "Public test signals verify playback only. They are not sports broadcasts."}
            </p>
            {source && (
              <button className="primary" onClick={() => start(true)}>
                <span aria-hidden="true">▶</span>{" "}
                {eventId ? "Load player" : "Load test player"}
              </button>
            )}
          </div>
        )}
      </div>
      <div className="player-bar">
        <span className="playback-state" role="status">
          {(state.startsWith("Loading") || state.startsWith("Buffering")) && (
            <span className="buffering-mark" aria-hidden="true">
              <BrandLoading />
            </span>
          )}
          {state}
        </span>
        {source && (
          <span className="pill">
            {source.content === "test"
              ? isLive
                ? "LIVE TEST SIGNAL"
                : "TEST CONTENT"
              : source.content === "official"
                ? source.catalog?.category
                : (source.presentation || "live").toUpperCase()}
          </span>
        )}
        {sourceSelector}
        {started && source && <button onClick={retryPlayback}>Retry</button>}
        {nextSource}
        {!source && (
          <button onClick={() => reload((a) => a + 1)}>
            Check sources again
          </button>
        )}
        {started && source?.type !== "embed" && source && (
          <>
            {isLive && (
              <button onClick={() => engine.current?.live()}>Go live</button>
            )}
            <button
              disabled={!controls.fullscreen}
              onClick={() =>
                void errorState(() =>
                  document.fullscreenElement
                    ? document.exitFullscreen()
                    : screen.current!.requestFullscreen(),
                )
              }
            >
              Fullscreen
            </button>
            <button
              disabled={!controls.pip}
              title={
                controls.pip
                  ? "Open picture-in-picture"
                  : "Picture-in-picture is unavailable in this browser"
              }
              onClick={() =>
                void errorState(() =>
                  document.pictureInPictureElement
                    ? document.exitPictureInPicture()
                    : video.current!.requestPictureInPicture(),
                )
              }
            >
              Picture-in-picture
            </button>
          </>
        )}
        {levels.length > 0 && (
          <label>
            Quality{" "}
            <select
              aria-label="Video quality"
              value={quality}
              onChange={(e) => {
                const q = Number(e.target.value);
                setQuality(q);
                engine.current?.quality(q);
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
      {source && (
        <details className="player-information">
          <summary>Viewing information</summary>
          <p className="fine">
            {source.type === "embed" && (
              <>
                Pressing Play connects to{" "}
                {youtube ? "YouTube" : new URL(source.url).hostname}. The
                provider’s privacy policy and playback restrictions apply.{" "}
              </>
            )}
            {source.content === "test"
              ? "Playback-testing content · not a sports broadcast. "
              : ""}
            {source.rightsOwner}.{" "}
            <a href={source.rightsEvidence} target="_blank" rel="noreferrer">
              Source information ↗
            </a>
          </p>
          {health && <p className="fine">{health}</p>}
        </details>
      )}
      {failed && source && (
        <p className="fine">
          <a href={source.rightsEvidence} target="_blank" rel="noreferrer">
            Open official source ↗
          </a>
        </p>
      )}
    </section>
  );
}
