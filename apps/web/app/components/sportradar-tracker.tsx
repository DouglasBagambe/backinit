"use client";
import { useEffect, useId, useRef, useState } from "react";
import { type SportEvent, type TrackerSource } from "@backinit/domain";
import { EventTracker } from "./event-tracker";

type Sir = ((...args: unknown[]) => void) & {
  q?: unknown[][];
  l?: number;
  o?: { language: string; theme: string };
};
type WidgetWindow = Window & { BackInItSportradar?: Sir };
let loader: { clientId: string; promise: Promise<Sir> } | undefined;

// Documented custom-name bootstrap: one loader across route and lease updates.
// No script is requested until the API returns our configured Client ID.
function loadWidget(clientId: string, theme: string): Promise<Sir> {
  if (!/^[a-f0-9]{32}$/.test(clientId))
    return Promise.reject(new Error("Invalid widget client"));
  if (loader)
    return loader.clientId === clientId
      ? loader.promise
      : Promise.reject(new Error("Widget client changed; reload required"));
  const promise = new Promise<Sir>((resolve, reject) => {
    const host = window as WidgetWindow;
    const queued: Sir = (...args) => {
      (queued.q ??= []).push(args);
    };
    queued.l = Date.now();
    queued.o = { language: "en", theme };
    host.BackInItSportradar = queued;
    const script = document.createElement("script");
    script.async = true;
    script.src = `https://widgets.sir.sportradar.com/${clientId}/widgetloader`;
    script.setAttribute("n", "BackInItSportradar");
    script.onload = () => resolve(host.BackInItSportradar!);
    script.onerror = () => {
      script.remove();
      delete host.BackInItSportradar;
      loader = undefined;
      reject(new Error("Widget loader unavailable"));
    };
    document.head.appendChild(script);
  });
  loader = { clientId, promise };
  return promise;
}

export function SportradarTracker({
  source,
  event,
  theme,
  compact,
  summary,
  toggleSummary,
  retry,
}: {
  source: Extract<TrackerSource, { provider: "Sportradar" }>;
  event: SportEvent;
  theme: string;
  compact: boolean;
  summary: boolean;
  toggleSummary: () => void;
  retry: () => void;
}) {
  const id = `sr-${useId().replace(/[^a-z0-9]/gi, "")}`;
  const container = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"loading" | "ready" | "unavailable">(
    "loading",
  );
  const widgetTheme = theme === "dark" ? "sportradardark" : "sportradar";
  useEffect(() => {
    const element = container.current;
    if (!element) return;
    let disposed = false;
    let api: Sir | undefined;
    const timer = setTimeout(() => {
      if (!disposed) setState("unavailable");
    }, 20000);
    void loadWidget(source.clientId, widgetTheme)
      .then((sir) => {
        if (disposed) return;
        api = sir;
        sir("setClientTheme", widgetTheme);
        sir("addWidget", element, "match.lmtPlus", {
          matchId: source.matchId,
          silent: true,
          onTrack: (
            type: string,
            data: { matchId?: number | string; error?: unknown } | null,
          ) => {
            if (disposed) return;
            if (
              type === "license_error" ||
              (type === "data_change" && data?.error)
            ) {
              clearTimeout(timer);
              setState("unavailable");
            } else if (
              type === "data_change" &&
              data &&
              !data.error &&
              String(data.matchId).replace(/^sr:match:/, "") ===
                source.matchId.slice(9)
            ) {
              clearTimeout(timer);
              setState("ready");
            }
          },
        });
      })
      .catch(() => {
        if (!disposed) {
          clearTimeout(timer);
          setState("unavailable");
        }
      });
    return () => {
      disposed = true;
      clearTimeout(timer);
      api?.("removeWidget", element);
    };
  }, [source.clientId, source.matchId, widgetTheme]);
  const showSummary = summary || state !== "ready";
  return (
    <section
      className={`publisher-tracker sportradar-tracker${compact ? " publisher-tracker-compact" : ""}`}
      aria-label="Live match tracker"
    >
      <div className="sportradar-tracker-body">
        <div
          ref={container}
          id={id}
          className="sportradar-tracker-content"
          aria-hidden={showSummary || undefined}
          inert={showSummary || undefined}
        />
        {showSummary && (
          <div className="sportradar-tracker-summary">
            <EventTracker event={event} compact={compact} />
            {!summary && (
              <p role="status">
                {state === "loading"
                  ? "Loading live animation…"
                  : "Live animation is unavailable. Scores keep updating."}
              </p>
            )}
          </div>
        )}
      </div>
      <div className="tracker-controls">
        <button aria-pressed={summary} onClick={toggleSummary}>
          {summary ? "Live animation" : "Match summary"}
        </button>
        <button onClick={retry}>Reload animation</button>
      </div>
    </section>
  );
}
