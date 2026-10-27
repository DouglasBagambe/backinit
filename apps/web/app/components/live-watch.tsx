"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { RefreshCw, ChevronRight, CalendarDays, Radio } from "lucide-react";
import {
  watchFeedSchema,
  eventTitle,
  sports,
  type WatchEntry,
} from "@backinit/domain";
import { Crest } from "./marks";
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
    ? `${live} in-page ${live === 1 ? "source" : "sources"}`
    : entry.sources.length
      ? "Replay / highlights only"
      : entry.availability === "external-only"
        ? "Official viewing info"
        : "No in-page stream";
}
export function LiveWatch({ preview = false }: { preview?: boolean }) {
  const params = useSearchParams();
  const selectedSport = params.get("sport") || "All sports";
  const [sport, setSport] = useState(selectedSport);
  const [entries, setEntries] = useState<WatchEntry[]>([]);
  const [range, setRange] = useState(
    params.get("range") === "today" ? "today" : "upcoming",
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
          setError(
            "Live-event discovery is unavailable right now. Please retry.",
          );
      } finally {
        if (!controller.signal.aborted) setLoading(false);
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
        (range !== "today" || (day <= today && endDay >= today)) &&
        (range !== "live" || e.status === "live") &&
        (range !== "available" ||
          sources.some((s) => (s.presentation || "live") === "live")) &&
        (sport === "All sports" || e.sport === sport) &&
        `${eventTitle(e)} ${e.competition} ${e.sport}`
          .toLowerCase()
          .includes(query.toLowerCase()) &&
        e.status !== "finished" &&
        (endDay >= today || e.status === "live") &&
        (sources.length > 0 ||
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
  const priority = filtered.find(
    (e) =>
      e.event.id === "efl-20261028-liverpool-chelsea" &&
      localDay(e.event.start, zone) === today,
  );
  const rows = filtered
    .filter((e) => e !== priority)
    .slice(0, preview ? 5 : limit);
  return (
    <section className="live-discovery" aria-label="Live event discovery">
      <div className="section-heading">
        <h2>{preview ? "Live & upcoming" : "Find an event"}</h2>
        {preview ? (
          <Link href="/watch">
            All events <ChevronRight size={16} />
          </Link>
        ) : (
          <Link href="/videos">Replays & highlights ↗</Link>
        )}
      </div>
      <p className="live-intro">
        Choose an event to see its player, match information and verified
        viewing options. An event listing does not mean a broadcast is available
        here.
      </p>
      {priority && (
        <article className="live-spotlight">
          <div>
            <span className="eyebrow">TONIGHT · CARABAO CUP</span>
            <h2>
              <Crest name="Liverpool" /> Liverpool{" "}
              <span className="muted">vs</span> Chelsea <Crest name="Chelsea" />
            </h2>
            <p>
              <time dateTime={priority.event.start}>
                {localStart(priority.event.start, zone)}
              </time>{" "}
              · {zone} · Anfield
            </p>
            <p className="viewing-status">
              {priority.availability === "in-page"
                ? sourceLabel(priority)
                : "No in-page broadcast configured"}
            </p>
            <p className="fine">
              ITV and Sky coverage confirmed for the UK. Uganda viewing requires
              a locally permitted service; those UK broadcasts are not worldwide
              embeds.
            </p>
          </div>
          <Link className="primary" href={`/watch/${priority.event.id}`}>
            {priority.availability === "in-page"
              ? "Open event player"
              : "Open match & viewing options"}{" "}
            <ChevronRight size={17} />
          </Link>
        </article>
      )}
      {!preview && (
        <div className="live-filters">
          <div className="filter-tabs" role="group" aria-label="Event schedule">
            <button
              aria-pressed={range === "upcoming"}
              onClick={() => {
                setRange("upcoming");
                setDate("");
              }}
            >
              Live & upcoming
            </button>
            <button
              aria-pressed={range === "today"}
              onClick={() => {
                setRange("today");
                setDate("");
              }}
            >
              Today
            </button>
            <button
              aria-pressed={range === "live"}
              onClick={() => {
                setRange("live");
                setDate("");
              }}
            >
              Live status
            </button>
            <button
              aria-pressed={range === "available"}
              onClick={() => {
                setRange("available");
                setDate("");
              }}
            >
              In-page sources
            </button>
          </div>
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
            Find an event
            <input
              aria-label="Find an event"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Team, event or competition"
            />
          </label>
          <label>
            Date
            <input
              aria-label="Event date"
              type="date"
              value={date}
              onChange={(e) => {
                setDate(e.target.value);
                setRange("upcoming");
              }}
            />
          </label>
          <label>
            Times shown in
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
      )}
      <p className="fine">
        <CalendarDays size={14} /> {zone} · Times follow your selected timezone.
        Live status comes from the data provider.
      </p>
      {loading && (
        <p role="status" aria-busy="true">
          Checking event schedules…
        </p>
      )}
      {error && (
        <p role="alert">
          {error}{" "}
          <button onClick={() => retry((a) => a + 1)}>Retry discovery</button>
        </p>
      )}
      <div className="live-event-list">
        {rows.map((entry) => {
          const e = entry.event;
          return (
            <Link className="live-event-row" href={`/watch/${e.id}`} key={e.id}>
              <div className="event-start">
                <time dateTime={e.start}>
                  {e.timeConfirmed === false
                    ? "Date only"
                    : localStart(e.start, zone, false)}
                </time>
                <small>
                  {e.timeConfirmed === false && e.end
                    ? "Tournament week"
                    : new Intl.DateTimeFormat("en-GB", {
                        timeZone: zone,
                        day: "numeric",
                        month: "short",
                      }).format(new Date(e.start))}
                </small>
              </div>
              <div className="event-main">
                <span className="eyebrow">
                  {e.sport} · {e.competition}
                </span>
                <strong>
                  {e.kind === "score" ? (
                    <>
                      <Crest name={e.home} />
                      {e.home}
                      <span className="event-versus">vs</span>
                      <Crest name={e.away} />
                      {e.away}
                    </>
                  ) : (
                    eventTitle(e)
                  )}
                </strong>
                <small>
                  {e.scheduleOnly
                    ? "Official schedule · scores not connected"
                    : e.status === "live"
                      ? "Provider reports live"
                      : "Provider schedule"}
                </small>
              </div>
              <div className="event-access">
                <span
                  className={
                    entry.availability === "in-page"
                      ? "pill source-available"
                      : "pill"
                  }
                >
                  {e.status === "live" && <Radio size={12} />}{" "}
                  {sourceLabel(entry)}
                </span>
                <ChevronRight size={18} />
              </div>
            </Link>
          );
        })}
      </div>
      {!loading && !filtered.length && (
        <div className="panel live-empty">
          <h3>
            {range === "available"
              ? "No in-page live sources are available for these filters."
              : "No verified events match these filters."}
          </h3>
          <p>
            Try another date or sport. Coverage is currently limited; missing
            fixtures and streams are never replaced with demos.
          </p>
          {sport !== "All sports" && (
            <a href={officialSchedules[sport]} target="_blank" rel="noreferrer">
              Check the official {sport.toLowerCase()} schedule ↗
            </a>
          )}
        </div>
      )}
      {!preview && filtered.length > limit && (
        <button onClick={() => setLimit((n) => n + 30)}>
          Show more events
        </button>
      )}
      {!preview && (
        <div className="live-coverage">
          <details>
            <summary>Sports coverage & freshness</summary>
            <p>
              Automatic OpenLigaDB, Jolpica and EFL schedule adapters are
              supplemented by a limited set of officially verified fixtures.
              NBA, combat sports, tennis and other snapshot listings are not
              full live feeds. Recheck conditional and date-only events with
              their publisher.
            </p>
            <div className="schedule-links">
              {sports.map((s) => (
                <a
                  key={s}
                  href={officialSchedules[s]}
                  target="_blank"
                  rel="noreferrer"
                >
                  {s} official schedule ↗
                </a>
              ))}
            </div>
          </details>
          <button
            aria-label="Refresh event discovery"
            onClick={() => retry((a) => a + 1)}
          >
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      )}
    </section>
  );
}
