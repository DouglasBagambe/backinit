"use client";
import { LeagueStandings, useLeagueStandings } from "./league-standings";
import { BroadcastPlayer } from "./broadcast-player";
import { useBroadcasts } from "./use-broadcasts";
import { AdSlot } from "./advertising";
import { DisplayAdvertising } from "./display-advertising";
import { LiveTracker } from "./live-tracker";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  eventTitle,
  eventScore,
  entityHref,
  matchBroadcastEvent,
  type Broadcast,
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
  broadcast: suppliedBroadcast,
}: {
  event: SportEvent;
  events: SportEvent[];
  favorite: React.ReactNode;
  broadcast?: Broadcast;
}) {
  const [event, setEvent] = useState(initialEvent);
  const { feed: broadcasts } = useBroadcasts();
  const broadcast =
    suppliedBroadcast ||
    broadcasts.data.find(
      (item) => matchBroadcastEvent(item, [event])?.id === event.id,
    );
  const [mode, setMode] = useState("stream");
  const [theatre, setTheatre] = useState(false);
  const leagueTable = useLeagueStandings([event]);
  const tabs = [
    "Overview",
    ...(leagueTable ? ["Standings"] : []),
    ...(event.detail?.form?.length ? ["Form"] : []),
    ...(event.detail?.headToHead?.length ? ["Head to head"] : []),
    ...(event.detail?.statistics?.length ? ["Statistics"] : []),
    ...(event.detail?.lineups?.some((t) => t.players.length)
      ? ["Lineups"]
      : []),
    ...(event.detail?.timeline?.length || event.detail?.goals?.length
      ? ["Timeline"]
      : []),
  ];
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
    if (suppliedBroadcast) return;
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
  }, [initialEvent, Boolean(suppliedBroadcast)]);
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
    <div className={`event-viewing${theatre ? " broadcast-theatre" : ""}`}>
      <Link className="back-link" href="/watch">
        ← Watch
      </Link>
      <header className="event-viewing-header">
        <span className="eyebrow">
          <SportMark name={event.sport} />{" "}
          <Link
            href={entityHref("competition", event.competition, event.sport)}
          >
            {event.competition}
          </Link>
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
              <Link
                href={entityHref(
                  ["Tennis", "Badminton"].includes(event.sport)
                    ? "athlete"
                    : "team",
                  event.home,
                  event.sport,
                  {
                    id: event.homeParticipant?.id,
                    providerSport: event.source?.provider
                      .split(":")[1]
                      ?.split("/")[0],
                    league: event.source?.provider.split("/")[1],
                  },
                )}
              >
                {event.home}
              </Link>
              <span className="muted"> vs </span>
              <Link
                href={entityHref(
                  ["Tennis", "Badminton"].includes(event.sport)
                    ? "athlete"
                    : "team",
                  event.away,
                  event.sport,
                  {
                    id: event.awayParticipant?.id,
                    providerSport: event.source?.provider
                      .split(":")[1]
                      ?.split("/")[0],
                    league: event.source?.provider.split("/")[1],
                  },
                )}
              >
                {event.away}
              </Link>
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
        {event.kind === "score" && event.status !== "upcoming" && (
          <div className="match-header-result">
            <strong>
              {eventScore(event, "home")} <span>:</span>{" "}
              {eventScore(event, "away")}
            </strong>
            <small>{event.clock}</small>
          </div>
        )}
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
          {Boolean(event.viewingLinks?.length) && (
            <a href="#official-viewing">Viewing options ↓</a>
          )}
          <a href={`/api/calendar/${event.id}`}>Calendar ↗</a>
          <button aria-pressed={theatre} onClick={() => setTheatre((v) => !v)}>
            {theatre ? "Exit theatre" : "Theatre mode"}
          </button>
        </div>
      </header>
      <div className="event-viewing-layout">
        <div className="event-viewing-main">
          {broadcast?.sources.length ? (
            <>
              <div
                className="filter-tabs"
                role="group"
                aria-label="Viewing mode"
              >
                <button
                  aria-pressed={mode === "stream"}
                  onClick={() => setMode("stream")}
                >
                  Watch stream
                </button>
                <button
                  aria-pressed={mode === "tracker"}
                  onClick={() => setMode("tracker")}
                >
                  Match tracker
                </button>
              </div>
              {mode === "tracker" ? (
                <LiveTracker event={event} />
              ) : (
                <BroadcastPlayer item={broadcast} autoLoad />
              )}
              {broadcast.viewers !== null && (
                <p className="broadcast-viewers">
                  {new Intl.NumberFormat().format(broadcast.viewers)} watching
                </p>
              )}
            </>
          ) : (
            <Player
              key={event.id}
              eventId={event.id}
              fallback={<LiveTracker event={event} />}
              onAvailability={setHasBroadcast}
            />
          )}
          <div className="event-mobile-tracker">
            {(hasBroadcast || (broadcast && mode === "stream")) && !wide && (
              <LiveTracker event={event} compact />
            )}
          </div>
          {Boolean(event.viewingLinks?.length) && (
            <details className="panel viewing-options" id="official-viewing">
              <summary>Viewing options</summary>
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
                          {new Date(link.checkedAt).toLocaleDateString(
                            "en-GB",
                            {
                              timeZone: zone,
                            },
                          )}{" "}
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
            </details>
          )}
          <section className="panel event-supporting">
            <div
              className="filter-tabs"
              role="group"
              aria-label="Event information"
            >
              {tabs.map((t) => (
                <button
                  key={t}
                  aria-pressed={(tabs.includes(tab) ? tab : "Overview") === t}
                  onClick={() => setTab(t)}
                >
                  {t}
                </button>
              ))}
            </div>
            {event.source && (
              <details className="event-source-details">
                <summary>Match data</summary>
                <p className="fine">
                  <a href={event.source.url} target="_blank" rel="noreferrer">
                    {event.source.provider} ↗
                  </a>{" "}
                  · {event.source.stale ? "Last available snapshot" : "Checked"}{" "}
                  {localStart(event.source.fetchedAt, zone)} · {zone}
                </p>
              </details>
            )}
            {tab === "Standings" && leagueTable ? (
              <LeagueStandings
                data={leagueTable}
                highlight={
                  event.kind === "score" ? [event.home, event.away] : []
                }
              />
            ) : (
              (!event.scheduleOnly || tab !== "Overview") && (
                <RealDetail
                  key={event.id + tab}
                  event={event}
                  tab={tabs.includes(tab) ? tab : "Overview"}
                  hidePlayer
                />
              )
            )}
          </section>
          <DisplayAdvertising />
          <AdSlot />
        </div>
        <aside className="event-side">
          {(hasBroadcast || (broadcast && mode === "stream")) && wide && (
            <div className="event-desktop-tracker">
              <LiveTracker event={event} compact />
            </div>
          )}
          <DisplayAdvertising placement="rectangle" />
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
            {!related.length && (
              <Link href="/watch">Browse matches & channels →</Link>
            )}
            <Link href="/fixtures">All fixtures →</Link>
          </section>
        </aside>
      </div>
    </div>
  );
}
