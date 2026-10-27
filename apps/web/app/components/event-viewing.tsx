"use client";
import Link from "next/link";
import { useState } from "react";
import { eventTitle, type SportEvent } from "@backinit/domain";
import { LazyPlayer as Player } from "./lazy-player";
import { RealDetail } from "./real-detail";
import { Crest } from "./marks";
import { localStart, localDay, useViewingZone } from "../lib/viewing-time";
export function EventViewing({
  event,
  events,
  favorite,
}: {
  event: SportEvent;
  events: SportEvent[];
  favorite: React.ReactNode;
}) {
  const [tab, setTab] = useState("Overview");
  const { zone } = useViewingZone();
  const related = events
    .filter(
      (e) =>
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
        ← All live & upcoming events
      </Link>
      <header className="event-viewing-header">
        <span className="eyebrow">
          {event.sport} · {event.competition}
        </span>
        <h1>
          {event.kind === "score" ? (
            <>
              <Crest name={event.home} />
              {event.home}
              <span className="muted"> vs </span>
              {event.away}
              <Crest name={event.away} />
            </>
          ) : (
            eventTitle(event)
          )}
        </h1>
        <p>
          <time dateTime={event.start}>
            {event.timeConfirmed === false
              ? "Date / tournament week · time not confirmed"
              : localStart(event.start, zone)}
          </time>{" "}
          · {zone} · {event.detail?.venue || "Venue not supplied"}
        </p>
        <div className="event-header-actions">
          {favorite}
          <a href="#official-viewing">Official viewing options ↓</a>
          <a href={`/api/calendar/${event.id}`}>Add to calendar ↗</a>
          <Link href={`/match/${event.id}`}>Match Centre ↗</Link>
        </div>
      </header>
      <div className="event-viewing-layout">
        <div className="event-viewing-main">
          <Player key={event.id} eventId={event.id} />
          <section className="panel viewing-options" id="official-viewing">
            <h2>Official viewing options</h2>
            <p>
              These links open only when you choose them. They are broadcaster
              or club destinations, not streams embedded by BackInIt.
            </p>
            {event.viewingLinks?.length ? (
              event.viewingLinks.map((link) => (
                <article key={link.url + link.label}>
                  <div>
                    <h3>{link.label}</h3>
                    <span className="pill">
                      {link.countries.length
                        ? link.countries.join(" / ")
                        : "Provider territory rules"}{" "}
                      ·{" "}
                      {link.access === "audio"
                        ? "AUDIO / UPDATES"
                        : link.access === "information"
                          ? "INFORMATION"
                          : link.access === "free-account"
                            ? "FREE ACCOUNT"
                            : "SUBSCRIPTION"}{" "}
                      ·{" "}
                      {link.confirmation === "confirmed"
                        ? "COVERAGE CONFIRMED"
                        : "CHECK SCHEDULE"}
                    </span>
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
                  </div>
                  <a
                    className="back-link"
                    href={link.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open official site ↗
                  </a>
                </article>
              ))
            ) : (
              <p>
                No event-specific broadcaster has been confirmed. We will not
                substitute a replay, test film or unrelated feed.
              </p>
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
                  ? "Provider reports live"
                  : event.scheduleOnly
                    ? "Official fixture · schedule only"
                    : event.status === "finished"
                      ? "Reported result"
                      : "Event information"}
              </h2>
              {event.kind === "score" && (
                <p className="event-score">
                  {event.homeScore ?? "–"} : {event.awayScore ?? "–"}
                </p>
              )}
              <p>
                {event.scheduleOnly
                  ? "Live scores, lineups, statistics and match events are not connected for this fixture. A scheduled start is never used to invent live status."
                  : "Details below reflect the provider’s latest available snapshot."}
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
            <RealDetail
              key={event.id + tab}
              event={event}
              tab={tab}
              hidePlayer
            />
          </section>
        </div>
        <aside className="event-switcher">
          <h2>Switch event</h2>
          <p className="fine">
            {zone} · Listings do not imply stream availability.
          </p>
          {related.map((e) => (
            <Link key={e.id} href={`/watch/${e.id}`}>
              <small>
                {e.sport} ·{" "}
                {e.timeConfirmed === false
                  ? "Tournament / matchday · time not confirmed"
                  : localStart(e.start, zone)}
              </small>
              <strong>{eventTitle(e)}</strong>
              <span>{e.scheduleOnly ? "Schedule only" : "Open event"} →</span>
            </Link>
          ))}
          {!related.length && (
            <p>No other verified fixtures are available in this period.</p>
          )}
        </aside>
      </div>
    </div>
  );
}
