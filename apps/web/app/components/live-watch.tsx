"use client";
import Link from "next/link";
import { EventSkeleton } from "./brand";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  RefreshCw,
  ChevronRight,
  ChevronLeft,
  Search,
  SlidersHorizontal,
  Radio,
} from "lucide-react";
import {
  watchFeedSchema,
  eventTitle,
  sports,
  type WatchEntry,
} from "@backinit/domain";
import { Crest, SportMark } from "./marks";
import { useViewingZone, localDay, localStart } from "../lib/viewing-time";
const officialSchedules: Record<string, string> = {
  Football: "https://www.efl.com/matches/",
  Basketball: "https://www.nba.com/schedule",
  Tennis: "https://www.atptour.com/en/scores/current",
  WWE: "https://www.wwe.com/events",
  MMA: "https://www.ufc.com/events",
  "Formula 1": "https://www.formula1.com/en/racing/2026",
  Cricket: "https://www.icc-cricket.com/fixtures-results",
  "American football": "https://www.nfl.com/schedules/",
  Baseball: "https://www.mlb.com/schedule",
  Rugby: "https://www.world.rugby/tournaments/fixtures-results",
};
export function sourceLabel(entry: WatchEntry) {
  const live = entry.sources.filter(
    (s) => (s.presentation || "live") === "live",
  ).length;
  return live
    ? "Watch live"
    : entry.sources.length
      ? "Replay"
      : entry.availability === "external-only"
        ? "Viewing info"
        : "No stream";
}
export function LiveWatch({ preview = false }: { preview?: boolean }) {
  const params = useSearchParams();
  const selectedSport = params.get("sport") || "All sports";
  const requestedRange = params.get("range");
  const requestedDate = params.get("date");
  const [sport, setSport] = useState(selectedSport);
  const [entries, setEntries] = useState<WatchEntry[]>([]);
  const [range, setRange] = useState(
    params.get("range") === "live"
      ? "live"
      : params.get("range") === "upcoming"
        ? "upcoming"
        : "today",
  );
  const [date, setDate] = useState(params.get("date") || "");
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, retry] = useState(0);
  const { zone, choose } = useViewingZone();
  useEffect(() => setSport(selectedSport), [selectedSport]);
  useEffect(() => {
    setRange(
      requestedRange === "live"
        ? "live"
        : requestedRange === "upcoming"
          ? "upcoming"
          : "today",
    );
    setDate(requestedDate || "");
  }, [requestedRange, requestedDate]);
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const r = await fetch(
          `/api/watch${date ? `?date=${encodeURIComponent(date)}` : ""}`,
          { signal: controller.signal },
        );
        if (!r.ok) throw new Error();
        const result = watchFeedSchema.parse(await r.json());
        setEntries(result.data);
        setError("");
      } catch {
        if (!controller.signal.aborted)
          setError("Events unavailable. Try again.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    const timer = setInterval(() => {
      if (!document.hidden) void load();
    }, 30000);
    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, [attempt, date]);
  const today = localDay(new Date().toISOString(), zone);
  const filtered = entries
    .filter(({ event: e, sources }) => {
      const day =
        e.timeConfirmed === false
          ? e.start.slice(0, 10)
          : localDay(e.start, zone);
      const endDay =
        e.timeConfirmed === false
          ? (e.end || e.start).slice(0, 10)
          : localDay(e.end || e.start, zone);
      return (
        (!date || (day <= date && endDay >= date)) &&
        (range !== "today" ||
          (day <= (date || today) && endDay >= (date || today)) ||
          (!date && e.status === "live")) &&
        (range !== "live" || e.status === "live") &&
        sources.some((s) => (s.presentation || "live") === "live") &&
        (sport === "All sports" || e.sport === sport) &&
        `${eventTitle(e)} ${e.competition} ${e.sport}`
          .toLowerCase()
          .includes(query.toLowerCase()) &&
        e.status !== "finished" &&
        (!!date || endDay >= today || e.status === "live") &&
        (!!date ||
          e.status === "live" ||
          sources.length > 0 ||
          Date.parse(e.end || e.start) > Date.now() - 6 * 3600000)
      );
    })
    .sort((a, b) => {
      const featured = (e: WatchEntry) =>
        e.event.id === "efl-20261028-liverpool-chelsea" &&
        localDay(e.event.start, zone) === today
          ? 1
          : 0;
      return (
        featured(b) - featured(a) ||
        Number(b.event.status === "live") - Number(a.event.status === "live") ||
        a.event.start.localeCompare(b.event.start)
      );
    });
  const rows = filtered.slice(0, preview ? 6 : limit);
  const groups = new Map<string, WatchEntry[]>();
  for (const entry of rows) {
    const key = `${entry.event.sport} · ${entry.event.competition}`;
    groups.set(key, [...(groups.get(key) || []), entry]);
  }
  const selectedDate = date || today;
  function shiftDate(offset: number) {
    const day = new Date(`${selectedDate}T12:00:00Z`);
    day.setUTCDate(day.getUTCDate() + offset);
    setDate(day.toISOString().slice(0, 10));
    setRange("today");
  }
  return (
    <section className="live-discovery" aria-label="Live event discovery">
      <div className="watch-toolbar">
        <h1>{preview ? "Sport today" : "Watch"}</h1>
        <div className="filter-tabs" role="group" aria-label="Event schedule">
          {[
            ["live", "Live"],
            ["today", "Today"],
            ["upcoming", "Upcoming"],
          ].map(([value, label]) => (
            <button
              key={value}
              aria-pressed={range === value}
              onClick={() => {
                setRange(value);
                setDate("");
              }}
            >
              {value === "live" && <Radio size={13} />} {label}
            </button>
          ))}
        </div>
        <Link className="archive-link" href="/videos">
          Highlights <ChevronRight size={14} />
        </Link>
      </div>
      <div className="watch-controls">
        <div className="watch-date">
          <button aria-label="Previous day" onClick={() => shiftDate(-1)}>
            <ChevronLeft size={16} />
          </button>
          <input
            aria-label="Event date"
            type="date"
            value={selectedDate}
            onChange={(e) => {
              setDate(e.target.value);
              setRange("today");
            }}
          />
          <button aria-label="Next day" onClick={() => shiftDate(1)}>
            <ChevronRight size={16} />
          </button>
        </div>
        <label className="watch-search">
          <Search size={16} />
          <input
            aria-label="Find an event"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Team or competition"
          />
        </label>
        <details className="watch-options">
          <summary aria-label="Filters">
            <SlidersHorizontal size={16} />
            <span>Filters</span>
          </summary>
          <div className="watch-options-panel">
            <label>
              Sport
              <select
                aria-label="Event sport"
                value={sport}
                onChange={(e) => {
                  setSport(e.target.value);
                  setLimit(30);
                }}
              >
                {["All sports", ...sports].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <label>
              Timezone
              <select
                aria-label="Viewing timezone"
                value={zone}
                onChange={(e) => choose(e.target.value)}
              >
                {[
                  ...new Set([
                    zone,
                    "Africa/Kampala",
                    "UTC",
                    "Europe/London",
                    "America/New_York",
                    "Asia/Tokyo",
                  ]),
                ].map((z) => (
                  <option key={z}>{z}</option>
                ))}
              </select>
            </label>
          </div>
        </details>
      </div>
      <div className="schedule-meta">
        <span>
          {sport === "All sports" ? "All sports" : sport} · {filtered.length}{" "}
          events
        </span>
        <span>{zone}</span>
      </div>
      {loading && <EventSkeleton />}
      {error && (
        <p role="alert">
          {error} <button onClick={() => retry((a) => a + 1)}>Retry</button>
        </p>
      )}
      <div className="live-event-list">
        {[...groups].map(([name, items]) => (
          <section className="watch-competition" key={name} aria-label={name}>
            <h2>
              <SportMark name={items[0]!.event.sport} />
              {name}
            </h2>
            {items.map((entry) => {
              const e = entry.event;
              const featured =
                e.id === "efl-20261028-liverpool-chelsea" &&
                localDay(e.start, zone) === today;
              return (
                <Link
                  className={`live-event-row${featured ? " live-spotlight" : ""}`}
                  href={`/watch/${e.id}`}
                  key={e.id}
                >
                  <div
                    className={`event-start${e.status === "live" ? " event-is-live" : ""}`}
                  >
                    <time dateTime={e.start}>
                      {e.status === "live"
                        ? e.kind === "score"
                          ? e.clock || "Live"
                          : "Live"
                        : e.timeConfirmed === false
                          ? "Date only"
                          : localStart(e.start, zone, false)}
                    </time>
                    <small>
                      {e.status === "live"
                        ? "LIVE"
                        : e.timeConfirmed === false && e.end
                          ? "Tournament"
                          : new Intl.DateTimeFormat("en-GB", {
                              timeZone: zone,
                              day: "numeric",
                              month: "short",
                            }).format(new Date(e.start))}
                    </small>
                  </div>
                  <div className="event-main">
                    {featured && (
                      <span className="featured-label">Tonight’s pick</span>
                    )}
                    {e.kind === "score" ? (
                      <div className="watch-teams">
                        <span>
                          <Crest
                            name={e.home}
                            imageUrl={
                              e.kind === "score"
                                ? e.homeParticipant?.imageUrl
                                : undefined
                            }
                          />
                          <strong>{e.home}</strong>
                          <b>{e.homeScore ?? ""}</b>
                        </span>
                        <span>
                          <Crest
                            name={e.away}
                            imageUrl={
                              e.kind === "score"
                                ? e.awayParticipant?.imageUrl
                                : undefined
                            }
                          />
                          <strong>{e.away}</strong>
                          <b>{e.awayScore ?? ""}</b>
                        </span>
                      </div>
                    ) : (
                      <strong>{eventTitle(e)}</strong>
                    )}
                  </div>
                  <div className="event-access">
                    <span
                      className={
                        entry.availability === "in-page"
                          ? "pill source-available"
                          : "stream-status"
                      }
                    >
                      {sourceLabel(entry)}
                    </span>
                    <ChevronRight size={16} />
                  </div>
                </Link>
              );
            })}
          </section>
        ))}
      </div>
      {!loading && !filtered.length && (
        <div className="live-empty">
          <h2>No streams available</h2>
          <p>
            Try another date or sport, or browse all fixtures.{" "}
            <Link href="/fixtures">
              Fixtures <ChevronRight size={14} />
            </Link>
          </p>
          {range === "today" && (
            <button
              className="empty-upcoming"
              onClick={() => {
                setRange("upcoming");
                setDate("");
              }}
            >
              Upcoming events
            </button>
          )}
          {sport !== "All sports" && (
            <a href={officialSchedules[sport]} target="_blank" rel="noreferrer">
              {sport} schedule ↗
            </a>
          )}
        </div>
      )}
      {preview ? (
        <Link className="more-events" href="/watch?range=upcoming">
          All upcoming events <ChevronRight size={15} />
        </Link>
      ) : (
        filtered.length > limit && (
          <button onClick={() => setLimit((n) => n + 30)}>Show more</button>
        )
      )}
      <div className="live-coverage">
        <details>
          <summary>Coverage & viewing information</summary>
          <p>
            Broadcast availability can change and may depend on your location or
            publisher access. All other events are listed in Fixtures.
          </p>
          <div className="schedule-links">
            {sports.map((s) => (
              <a
                key={s}
                href={officialSchedules[s]}
                target="_blank"
                rel="noreferrer"
              >
                <SportMark name={s} />
                {s} ↗
              </a>
            ))}
          </div>
        </details>
        <button
          aria-label="Refresh event discovery"
          onClick={() => retry((a) => a + 1)}
        >
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>
    </section>
  );
}
