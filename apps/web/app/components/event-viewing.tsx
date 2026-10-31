"use client";
import { AdSlot } from "./advertising";
import { LiveTracker } from "./live-tracker";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  eventTitle,
  eventSchema,
  watchFeedSchema,
  type SportEvent,
} from "@backinit/domain";
import { LazyPlayer as Player } from "./lazy-player";
import { RealDetail } from "./real-detail";
import { Crest, SportMark } from "./marks";
import { localStart, localDay, useViewingZone } from "../lib/viewing-time";
export function EventViewing({
  event: initialEvent,
  events,
  favorite,
}: {
  event: SportEvent;
  events: SportEvent[];
  favorite: React.ReactNode;
}) {
  const [event, setEvent] = useState(initialEvent);
  const [hasBroadcast, setHasBroadcast] = useState(false);
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(min-width: 1001px)");
    const read = () => setWide(media.matches);
    read();
    media.addEventListener("change", read);
    return () => media.removeEventListener("change", read);
  }, []);
  useEffect(() => {
    setEvent(initialEvent);
    const controller = new AbortController();
    let running = false;
    const refresh = async () => {
      if (running || document.hidden) return;
      running = true;
      try {
        const response = await fetch(
          `/api/events/${encodeURIComponent(initialEvent.id)}`,
          {
            signal: AbortSignal.any([
              controller.signal,
              AbortSignal.timeout(25000),
            ]),
          },
        );
        if (!response.ok) throw new Error();
        const body = await response.json();
        const current = eventSchema.parse(body.data);
        if (current.id !== initialEvent.id || current.provenance !== "provider")
          throw new Error();
        if (!controller.signal.aborted) setEvent(current);
      } catch {
        if (!controller.signal.aborted)
          setEvent((old) => ({
            ...old,
            ...(old.status === "live" ? { status: "unknown" as const } : {}),
            ...(old.source ? { source: { ...old.source, stale: true } } : {}),
          }));
      } finally {
        running = false;
      }
    };
    const timer = setInterval(() => void refresh(), 30000);
    void refresh();
    document.addEventListener("visibilitychange", refresh);
    return () => {
      controller.abort();
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [initialEvent]);
  const [tab, setTab] = useState("Overview");
  const [watchableIds, setWatchableIds] = useState<string[]>([]);
  const [watchEvents, setWatchEvents] = useState<SportEvent[]>([]);
  useEffect(() => {
    const controller = new AbortController();
    let running = false;
    const load = async () => {
      if (running || controller.signal.aborted) return;
      running = true;
      try {
        const response = await fetch("/api/watch", {
          signal: AbortSignal.any([
            controller.signal,
            AbortSignal.timeout(20000),
          ]),
        });
        if (!response.ok) throw new Error();
        const feed = watchFeedSchema.parse(await response.json());
        if (!controller.signal.aborted)
          setWatchEvents(feed.data.map((entry) => entry.event));
        if (!controller.signal.aborted)
          setWatchableIds(
            feed.data
              .filter((entry) =>
                entry.sources.some(
                  (source) => (source.presentation || "live") === "live",
                ),
              )
              .map((entry) => entry.event.id),
          );
      } catch {
        if (!controller.signal.aborted) setWatchableIds([]);
      } finally {
        running = false;
      }
    };
    void load();
    const timer = setInterval(() => {
      if (!document.hidden) void load();
    }, 30000);
    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, []);
  const { zone } = useViewingZone();
  const related = (watchEvents.length ? watchEvents : events)
    .filter(
      (e) =>
        watchableIds.includes(e.id) &&
        e.provenance === "provider" &&
        e.id !== event.id &&
        e.status !== "finished" &&
        localDay(e.end || e.start, zone) >=
          localDay(new Date().toISOString(), zone) &&
        Date.parse(e.end || e.start) > Date.now() - 6 * 3600000 &&
        Date.parse(e.start) < Date.now() + 7 * 86400000,
    )
    .sort(
      (a, b) =>
        Number(localDay(b.start, zone) === localDay(event.start, zone)) -
          Number(localDay(a.start, zone) === localDay(event.start, zone)) ||
        Number(a.timeConfirmed === false) - Number(b.timeConfirmed === false) ||
        a.start.localeCompare(b.start),
    )
    .slice(0, 12);
  return (
    <div className="event-viewing">
      <Link className="back-link" href="/watch">
        ← All events
      </Link>
      <header className="event-viewing-header">
        <span className="eyebrow">
          <SportMark name={event.sport} /> {event.competition}
        </span>
        <h1>
          {event.kind === "score" ? (
            <>
              <Crest
                name={event.home}
                imageUrl={
                  event.kind === "score"
                    ? event.homeParticipant?.imageUrl
                    : undefined
                }
              />
              {event.home}
              <span className="muted"> vs </span>
              {event.away}
              <Crest
                name={event.away}
                imageUrl={
                  event.kind === "score"
                    ? event.awayParticipant?.imageUrl
                    : undefined
                }
              />
            </>
          ) : (
            eventTitle(event)
          )}
        </h1>
        <p>
          <time dateTime={event.start}>
            {event.timeConfirmed === false
              ? "Date only"
              : localStart(event.start, zone)}
          </time>{" "}
          · {zone}
          {event.detail?.venue ? ` · ${event.detail.venue}` : ""}
        </p>
        <div className="event-header-actions">
          {favorite}
          <a href="#official-viewing">Viewing options ↓</a>
          <a href={`/api/calendar/${event.id}`}>Calendar ↗</a>
          <Link href={`/match/${event.id}`}>Match Centre ↗</Link>
        </div>
      </header>
      <div className="event-viewing-layout">
        <div className="event-viewing-main">
          <Player
            key={event.id}
            eventId={event.id}
            fallback={<LiveTracker event={event} />}
            onAvailability={setHasBroadcast}
          />
          <div className="event-mobile-tracker">
            {hasBroadcast && !wide && <LiveTracker event={event} compact />}
          </div>
          <AdSlot />
          <section className="panel viewing-options" id="official-viewing">
            <h2>Viewing options</h2>
            {event.viewingLinks?.length ? (
              event.viewingLinks.map((link) => (
                <article key={link.url + link.label}>
                  <div>
                    <h3>{link.label}</h3>
                    <span className="pill">
                      {link.countries.length
                        ? link.countries.join(" / ")
                        : "Regional access"}{" "}
                      ·{" "}
                      {link.access === "audio"
                        ? "Audio / updates"
                        : link.access === "information"
                          ? "Information"
                          : link.access === "free-account"
                            ? "Free account"
                            : "Subscription"}{" "}
                      ·{" "}
                      {link.confirmation === "confirmed"
                        ? "Confirmed"
                        : "Check schedule"}
                    </span>
                    <details className="viewing-note">
                      <summary>Access details</summary>
                      <p>{link.note}</p>
                      <small>
                        Checked{" "}
                        {new Date(link.checkedAt).toLocaleDateString("en-GB", {
                          timeZone: zone,
                        })}{" "}
                        ·{" "}
                        <a
                          href={link.evidenceUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Evidence ↗
                        </a>
                      </small>
                    </details>
                  </div>
                  <a
                    className="back-link"
                    href={link.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Visit site ↗
                  </a>
                </article>
              ))
            ) : (
              <p>No viewing options confirmed.</p>
            )}
          </section>
          <section className="panel event-supporting">
            <div
              className="filter-tabs"
              role="group"
              aria-label="Event information"
            >
              {(event.sport === "Football"
                ? ["Overview", "Tracker", "Statistics", "Timeline", "Lineups"]
                : event.kind === "race"
                  ? ["Overview", "Classification"]
                  : event.kind === "card"
                    ? ["Overview", "Card"]
                    : ["Overview", "Statistics", "Timeline"]
              ).map((t) => (
                <button
                  key={t}
                  aria-pressed={tab === t}
                  onClick={() => setTab(t)}
                >
                  {t}
                </button>
              ))}
            </div>
            <div className="event-data-summary">
              <h2>
                {event.status === "live"
                  ? "Live"
                  : event.scheduleOnly
                    ? "Schedule only"
                    : event.status === "finished"
                      ? "Result"
                      : "Event information"}
              </h2>
              {event.kind === "score" && (
                <p className="event-score">
                  {event.homeScore ?? "–"} : {event.awayScore ?? "–"}
                </p>
              )}
              <p>
                {event.scheduleOnly
                  ? "Live match data unavailable."
                  : "Latest available match data."}
              </p>
              {event.source && (
                <p className="fine">
                  <a href={event.source.url} target="_blank" rel="noreferrer">
                    {event.source.provider} ↗
                  </a>{" "}
                  · {event.source.stale ? "Stale snapshot" : "Checked"}{" "}
                  {localStart(event.source.fetchedAt, zone)} · {zone}
                </p>
              )}
            </div>
            {(!event.scheduleOnly || tab !== "Overview") && (
              <RealDetail
                key={event.id + tab}
                event={event}
                tab={tab}
                hidePlayer
              />
            )}
          </section>
        </div>
        <aside className="event-side">
          {hasBroadcast && wide && (
            <div className="event-desktop-tracker">
              <LiveTracker event={event} compact />
            </div>
          )}
          <AdSlot format="rectangle" sponsored native />
          <section className="event-switcher">
            <h2>More to watch</h2>

            {related.map((e) => (
              <Link key={e.id} href={`/watch/${e.id}`}>
                <small>
                  {e.sport} ·{" "}
                  {e.timeConfirmed === false
                    ? "Date only"
                    : localStart(e.start, zone)}
                </small>
                <strong>{eventTitle(e)}</strong>
                <span>Watch →</span>
              </Link>
            ))}
            {!related.length && <p>No other streams available.</p>}
            <Link href="/fixtures">All fixtures →</Link>
          </section>
        </aside>
      </div>
    </div>
  );
}
