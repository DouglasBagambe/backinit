"use client";
import { useState, useEffect, useRef } from "react";
import { Play, X, RefreshCw, Maximize2 } from "lucide-react";
import { prioritizePlayback } from "../lib/playback-priority";
import { type Broadcast } from "../lib/broadcast-types";
import { SourcePicker } from "./source-picker";
import { BrandMark } from "./brand";
export function BroadcastPlayer({
  item,
  compact = false,
  autoLoad = false,
}: {
  item: Broadcast;
  compact?: boolean;
  autoLoad?: boolean;
}) {
  const [source, setSource] = useState(item.sources[0]?.id || "");
  const [playing, setPlaying] = useState(false);
  const [attempt, retry] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [slow, setSlow] = useState(false);
  const [failed, setFailed] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const choice = item.sources.find((s) => s.id === source) || item.sources[0];
  useEffect(() => {
    let next = item.sources[0]?.id || "";
    try {
      const saved = sessionStorage.getItem(`backinit-source:${item.id}`);
      if (item.sources.some((s) => s.id === saved)) next = saved!;
    } catch {}
    setSource(next);
    if (autoLoad) prioritizePlayback();
    setPlaying(autoLoad);
  }, [item.id, autoLoad]);
  useEffect(() => {
    setLoaded(false);
    setSlow(false);
    setFailed(false);
    if (!playing) return;
    const t = setTimeout(() => setSlow(true), 15000);
    return () => clearTimeout(t);
  }, [source, choice?.url, playing, attempt]);
  return (
    <div
      className={`broadcast-player${compact ? " broadcast-player-compact" : ""}`}
      ref={root}
    >
      <div className="broadcast-player-rim">
        <span className="broadcast-badge">
          {item.channel ? "24/7" : "Stream"}
        </span>
        <span className="broadcast-player-brand">
          <BrandMark />
          <span>
            back<span className="brand-accent">in</span>it
            <span className="brand-accent">.</span>
          </span>
        </span>
      </div>
      <div className="broadcast-screen">
        {playing && choice && !failed ? (
          <iframe
            key={`${item.id}-${choice.id}-${attempt}`}
            src={choice.url}
            title={`${item.title} broadcast`}
            allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            onLoad={() => {
              setLoaded(true);
              performance.mark("backinit:embed-frame-loaded");
            }}
            onError={() => setFailed(true)}
          />
        ) : (
          <div className="broadcast-start">
            {item.poster && <img src={item.poster} alt="" />}
            {choice && !failed ? (
              <button
                aria-label={`Play ${item.title}`}
                onClick={() => {
                  prioritizePlayback();
                  setPlaying(true);
                }}
              >
                <Play size={46} fill="currentColor" strokeWidth={0} />
              </button>
            ) : (
              <p>
                {failed
                  ? "This stream could not load. Retry or choose another source."
                  : "A player has not been supplied yet."}
              </p>
            )}
          </div>
        )}
      </div>
      <div className="broadcast-player-controls">
        {item.sources.length > 0 && (
          <SourcePicker
            sources={item.sources}
            selected={choice?.id}
            title={item.title}
            onChange={(id) => {
              setSource(id);
              try {
                sessionStorage.setItem(`backinit-source:${item.id}`, id);
              } catch {}
              prioritizePlayback();
              setPlaying(true);
            }}
          />
        )}
        <div className="broadcast-player-actions">
          <button
            title="Reload stream"
            aria-label={`Reload ${item.title}`}
            onClick={() => {
              prioritizePlayback();
              retry((n) => n + 1);
              setPlaying(true);
            }}
          >
            <RefreshCw size={16} />
          </button>
          {playing && (
            <button
              title="Stop stream"
              aria-label={`Stop ${item.title}`}
              onClick={() => setPlaying(false)}
            >
              <X size={16} />
            </button>
          )}
          <button
            title="Fullscreen"
            aria-label={`Fullscreen ${item.title}`}
            onClick={() => {
              void root.current?.requestFullscreen?.().catch(() => {});
            }}
          >
            <Maximize2 size={16} />
          </button>
        </div>
      </div>
      {slow && !loaded && playing && (
        <p role="status" className="broadcast-status">
          Still connecting. Try another stream or reload.
        </p>
      )}
    </div>
  );
}
