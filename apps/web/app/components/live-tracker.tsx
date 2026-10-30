"use client";
import { useEffect, useRef, useState } from "react";
import {
  trackerSourceSchema,
  type SportEvent,
  type TrackerSource,
} from "@backinit/domain";
import { EventTracker } from "./event-tracker";

export function LiveTracker({
  event,
  compact = false,
}: {
  event: SportEvent;
  compact?: boolean;
}) {
  const [source, setSource] = useState<TrackerSource | null>(null);
  const [attempt, retry] = useState(0);
  const [summary, setSummary] = useState(false);
  const [theme, setTheme] = useState("light");
  const current = useRef(source);
  current.current = source;
  useEffect(() => {
    const read = () =>
      setTheme(
        document.documentElement.dataset.theme === "dark" ? "dark" : "light",
      );
    read();
    const observer = new MutationObserver(read);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    setSource(null);
    setSummary(false);
  }, [event.id]);
  useEffect(() => {
    if (
      event.kind !== "score" ||
      event.status === "finished" ||
      event.status === "upcoming" ||
      event.scheduleOnly ||
      !["Football", "Basketball", "Tennis", "Cricket"].includes(event.sport)
    ) {
      setSource(null);
      return;
    }
    const controller = new AbortController();
    let running = false;
    const refresh = async () => {
      if (
        running ||
        document.hidden ||
        event.status !== "live" ||
        event.source?.stale
      )
        return;
      running = true;
      try {
        const response = await fetch(`/api/trackers/${event.id}`, {
          signal: AbortSignal.any([
            controller.signal,
            AbortSignal.timeout(35000),
          ]),
        });
        if (!response.ok) throw new Error();
        const body = await response.json();
        const next =
          body.data === null ? null : trackerSourceSchema.parse(body.data);
        if (
          next &&
          (next.eventId !== event.id ||
            Date.parse(next.validUntil) <= Date.now())
        )
          throw new Error();
        if (!controller.signal.aborted) setSource(next);
      } catch {
        if (!controller.signal.aborted)
          setSource((old) =>
            old && Date.parse(old.validUntil) > Date.now() ? old : null,
          );
      } finally {
        running = false;
      }
    };
    void refresh();
    const interval = setInterval(() => void refresh(), 60000);
    const expiry = setInterval(() => {
      if (
        current.current &&
        Date.parse(current.current.validUntil) <= Date.now()
      )
        setSource(null);
    }, 1000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      controller.abort();
      clearInterval(interval);
      clearInterval(expiry);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [
    event.id,
    event.kind,
    event.sport,
    event.status,
    event.source?.stale,
    event.scheduleOnly,
    attempt,
  ]);
  if (!source) return <EventTracker event={event} compact={compact} />;
  return (
    <PublisherTracker
      key={`${source.url}:${theme}:${attempt}`}
      source={source}
      event={event}
      theme={theme}
      compact={compact}
      summary={summary}
      toggleSummary={() => setSummary((old) => !old)}
      retry={() => {
        setSummary(false);
        retry((n) => n + 1);
      }}
    />
  );
}

function PublisherTracker({
  source,
  event,
  theme,
  compact,
  summary,
  toggleSummary,
  retry,
}: {
  source: TrackerSource;
  event: SportEvent;
  theme: string;
  compact: boolean;
  summary: boolean;
  toggleSummary: () => void;
  retry: () => void;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const loadedRef = useRef(false);
  const [loaded, setLoaded] = useState(false);
  const [slow, setSlow] = useState(false);
  const [height, setHeight] = useState<number>();
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!loadedRef.current) setSlow(true);
    }, 20000);
    // Published resize protocol; accept messages only from this exact publisher frame.
    const resize = (message: MessageEvent) => {
      if (
        message.origin !== new URL(source.url).origin ||
        message.source !== frame.current?.contentWindow ||
        message.data?.type !== "sportscore:resize" ||
        typeof message.data.height !== "number" ||
        !Number.isFinite(message.data.height)
      )
        return;
      setHeight(Math.max(420, Math.min(1200, Math.ceil(message.data.height))));
    };
    window.addEventListener("message", resize);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("message", resize);
    };
  }, [source.url]);
  const showSummary = summary || !loaded;
  return (
    <section
      className={`publisher-tracker${compact ? " publisher-tracker-compact" : ""}`}
      aria-label="Live match tracker"
    >
      <div
        className="publisher-tracker-frame"
        style={height ? { height } : undefined}
      >
        <iframe
          ref={frame}
          title={`${event.sport} live match tracker`}
          src={`${source.url}?theme=${theme}`}
          onLoad={() => {
            loadedRef.current = true;
            setLoaded(true);
          }}
          onError={() => setSlow(true)}
          sandbox="allow-scripts allow-same-origin allow-popups"
          referrerPolicy="strict-origin-when-cross-origin"
          aria-hidden={showSummary || undefined}
          tabIndex={showSummary ? -1 : undefined}
        />
        {showSummary && (
          <div className="tracker-recovery">
            <EventTracker event={event} compact={compact} />
            {!loaded && !summary && (
              <p role="status">
                {slow
                  ? "Live animation is taking longer to load. Scores keep updating."
                  : "Loading live animation…"}
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
