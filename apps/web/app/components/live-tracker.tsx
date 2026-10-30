"use client";
import { useEffect, useRef, useState } from "react";
import {
  trackerSourceSchema,
  type SportEvent,
  type TrackerSource,
} from "@backinit/domain";
import { EventTracker } from "./event-tracker";
import { BrandLoading } from "./brand";

export function LiveTracker({
  event,
  compact = false,
}: {
  event: SportEvent;
  compact?: boolean;
}) {
  const [source, setSource] = useState<TrackerSource | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, retry] = useState(0);
  const [theme, setTheme] = useState("light");
  const loadedRef = useRef(loaded);
  loadedRef.current = loaded;
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
    setFailed(false);
    if (
      event.kind !== "score" ||
      event.status !== "live" ||
      event.source?.stale ||
      event.scheduleOnly ||
      !["Football", "Basketball", "Tennis", "Cricket"].includes(event.sport)
    )
      return;
    const controller = new AbortController();
    let running = false;
    const refresh = async () => {
      if (running || document.hidden) return;
      running = true;
      try {
        const response = await fetch(`/api/trackers/${event.id}`, {
          signal: controller.signal,
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
  useEffect(() => {
    setLoaded(false);
    setFailed(false);
    if (!source) return;
    const timer = setTimeout(() => {
      if (!loadedRef.current) setFailed(true);
    }, 20000);
    return () => clearTimeout(timer);
  }, [source?.url, theme, attempt]);
  // The timeout guards a stalled navigation; onLoad is not proof of live tracker content.
  useEffect(() => {
    if (loaded) setFailed(false);
  }, [loaded]);
  if (!source || failed)
    return (
      <>
        <EventTracker event={event} compact={compact} />
        {failed && (
          <button className="tracker-retry" onClick={() => retry((n) => n + 1)}>
            Retry live tracker
          </button>
        )}
      </>
    );
  return (
    <section
      className={`publisher-tracker${compact ? " publisher-tracker-compact" : ""}`}
      aria-label="Live match tracker"
    >
      <div className="publisher-tracker-frame">
        {!loaded && (
          <div className="tracker-loading">
            <BrandLoading label="Loading live tracker" />
          </div>
        )}
        <iframe
          key={`${source.url}:${theme}:${attempt}`}
          title={`${event.sport} live match tracker`}
          src={`${source.url}?theme=${theme}`}
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          sandbox="allow-scripts allow-same-origin allow-popups"
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>
    </section>
  );
}
