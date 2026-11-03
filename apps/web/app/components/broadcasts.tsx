"use client";
import { EntitySuggestions } from "./entity-suggestions";
import {
  eventTitle,
  watchFeedSchema,
  matchBroadcastEvent,
  sportKey,
  type SportEvent,
} from "@backinit/domain";
import { prioritizePlayback } from "../lib/playback-priority";
import { publicData } from "../lib/public-data-client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Plus,
  Play,
  X,
  Maximize2,
  RefreshCw,
  Share2,
  Columns2,
  ExternalLink,
  Radio,
  Tv,
  Clapperboard,
} from "lucide-react";
import {
  broadcastFeedSchema,
  broadcastState,
  type Broadcast,
  type BroadcastFeed,
} from "../lib/broadcast-types";
import { PlayerBrand } from "./player-brand";
import { BroadcastPlayer } from "./broadcast-player";
import { useBroadcasts } from "./use-broadcasts";
import { EventViewing } from "./event-viewing";
export { BroadcastPlayer } from "./broadcast-player";
import { WatchHub } from "./watch-hub";
import { useBroadcastMatch } from "./broadcast-match";
import { LiveTracker } from "./live-tracker";
import {
  compareBroadcasts,
  broadcastImportance,
} from "../lib/broadcast-ranking";
import { useViewingZone, localDay } from "../lib/viewing-time";
import { AdSlot } from "./advertising";
import { DisplayAdvertising } from "./display-advertising";
function useNow() {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(t);
  }, []);
  return now;
}
function StartTime({ item }: { item: Broadcast }) {
  const now = useNow();
  const { zone } = useViewingZone();
  if (item.channel) return <>24/7 channel</>;
  return (
    <time dateTime={new Date(item.start).toISOString()}>
      {now
        ? new Intl.DateTimeFormat("en-GB", {
            timeZone: zone,
            weekday: "short",
            day: "numeric",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
            hourCycle: "h23",
          }).format(item.start)
        : "Scheduled broadcast"}
    </time>
  );
}
function State({ item }: { item: Broadcast }) {
  const now = useNow();
  return (
    <span
      className={`broadcast-badge ${now && broadcastState(item, now) === "Live" ? "is-live" : ""}`}
    >
      {now ? broadcastState(item, now) : item.channel ? "24/7" : "Scheduled"}
    </span>
  );
}
/** Small editorial entry point; the full catalogue remains in Watch. */
export function HomeBroadcasts({ intro = true }: { intro?: boolean } = {}) {
  const { feed } = useBroadcasts();
  const now = useNow();
  const time = now || Date.now();
  const matches = feed.data
    .filter(
      (b) => !b.channel && b.end >= time && b.start <= time + 48 * 3600000,
    )
    .sort((a, b) => compareBroadcasts(a, b, time))
    .slice(0, 3);
  return (
    <section className="home-spotlight" aria-label="Your matchday">
      {intro && (
        <div className="home-intro">
          <div>
            <span className="eyebrow">EVERY MOMENT MATTERS</span>
            <h1>
              Make time for
              <br />
              the big moments.
            </h1>
            <p>Find your next game. Follow the action. Get back in it.</p>
          </div>
          <Link className="home-watch-cta" href="/watch">
            <Play size={18} fill="currentColor" />
            Explore Watch
          </Link>
        </div>
      )}
      <nav className="home-shortcuts" aria-label="Explore BackInIt">
        <Link href="/watch?range=live">
          <Radio size={16} />
          Live now
        </Link>
        <Link href="/watch?view=channels">
          <Tv size={16} />
          Sports channels
        </Link>
        <Link href="/watch?view=replays">
          <Clapperboard size={16} />
          Replays & highlights
        </Link>
      </nav>
      {matches.length > 0 && (
        <>
          <div className="section-heading">
            <h2>In the spotlight</h2>
            <Link href="/watch">All matches →</Link>
          </div>
          <div className="broadcast-grid home-broadcast-grid">
            {matches.map((item) => (
              <Link
                href={`/watch/${item.id}`}
                className="broadcast-card"
                key={item.id}
              >
                <div className="broadcast-poster">
                  {item.poster ? (
                    <img
                      src={item.poster}
                      alt=""
                      loading="lazy"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <span className="broadcast-poster-fallback">
                      <Play size={28} />
                    </span>
                  )}
                  <State item={item} />
                </div>
                <div className="broadcast-card-copy">
                  <small>
                    {item.category} · {item.competition}
                  </small>
                  <h3>{item.title}</h3>
                  <StartTime item={item} />
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
export function BroadcastDirectory({
  preview = false,
  primary = false,
  onAvailability,
}: {
  preview?: boolean;
  primary?: boolean;
  onAvailability?: (available: boolean) => void;
}) {
  const { feed, loading, retry } = useBroadcasts();
  const params = useSearchParams();
  const requestedDate = params.get("date") || "";
  const [matchError, setMatchError] = useState("");
  const [matchLoading, setMatchLoading] = useState(true);
  const [matchAttempt, retryMatches] = useState(0);
  const [matchEvents, setMatchEvents] = useState<SportEvent[]>([]);
  const [watchableIds, setWatchableIds] = useState<string[]>([]);
  useEffect(() => {
    setMatchLoading(true);
    const c = new AbortController();
    let busy = false;
    const load = async () => {
      if (busy) return;
      busy = true;
      try {
        const body = watchFeedSchema.parse(
          await publicData.read(
            `/api/watch${requestedDate ? `?date=${encodeURIComponent(requestedDate)}` : ""}`,
            c.signal,
          ),
        );
        if (!c.signal.aborted) {
          setMatchEvents([
            ...body.data.map((entry) => entry.event),
            ...body.statusEvents,
          ]);
          setWatchableIds(
            body.data
              .filter((entry) =>
                entry.sources.some(
                  (source) => (source.presentation || "live") === "live",
                ),
              )
              .map((entry) => entry.event.id),
          );
          setMatchError("");
        }
      } catch {
        if (!c.signal.aborted)
          setMatchError(
            "Match updates could not load. Your available streams are still shown.",
          );
      } finally {
        busy = false;
        if (!c.signal.aborted) setMatchLoading(false);
      }
    };
    void load();
    const timer = setInterval(() => {
      if (!document.hidden) void load();
    }, 30000);
    return () => {
      c.abort();
      clearInterval(timer);
    };
  }, [requestedDate, matchAttempt]);
  const matchedIds = new Set(
    feed.data.flatMap((b) => {
      const e = matchBroadcastEvent(b, matchEvents);
      return e ? [e.id] : [];
    }),
  );
  const trackerEvents = matchEvents.filter(
    (e) => !matchedIds.has(e.id) && ["live", "upcoming"].includes(e.status),
  );
  const catalogue: Broadcast[] = [
    ...feed.data,
    ...trackerEvents.map((e) => ({
      id: e.id,
      title: eventTitle(e),
      category: e.sport,
      competition: e.competition,
      start: Date.parse(e.start),
      end:
        e.status === "live"
          ? Date.now() + 60000
          : Date.parse(e.end || e.start) + 6 * 3600000,
      channel: false,
      viewers: null,
      sources: [],
      poster: null,
      pageUrl: "",
      replay: false,
    })),
  ];
  const officialFor = (b: Broadcast) =>
    matchEvents.find((e) => e.id === b.id) ||
    matchBroadcastEvent(b, matchEvents);
  const channels = params.get("view") === "channels";
  const replays = params.get("view") === "replays";
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All sports");
  const [range, setRange] = useState("Today");
  const [chosenDate, setChosenDate] = useState("");
  const [sort, setSort] = useState("Recommended");
  const [page, setPage] = useState(1);
  const now = useNow();
  const { zone } = useViewingZone();
  function updateFilter(patch: Record<string, string>) {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(patch))
      value ? next.set(key, value) : next.delete(key);
    window.history.replaceState(
      null,
      "",
      `${primary ? "/watch" : "/broadcasts"}?${next}`,
    );
  }
  useEffect(() => setQuery(params.get("q") || ""), [params.get("q")]);
  const requested = params.get("sport");
  const requestedRange = params.get("range");
  useEffect(() => {
    setRange(
      (
        {
          all: "All",
          upcoming: "All",
          live: "Live now",
          today: "Today",
          next48: "Next 48 hours",
          tomorrow: "Tomorrow",
          week: "This week",
        } as Record<string, string>
      )[requestedRange || ""] || "Today",
    );
    setChosenDate(requestedDate);
  }, [requestedRange, requestedDate]);
  useEffect(() => {
    onAvailability?.(feed.data.length > 0);
  }, [feed.data.length, onAvailability]);
  useEffect(() => {
    setCategory(
      (
        {
          WWE: "Wrestling",
          "American football": "American Football",
          "Ice hockey": "Ice Hockey",
        } as Record<string, string>
      )[requested || ""] ||
        requested ||
        "All sports",
    );
  }, [requested, channels]);
  useEffect(() => {
    setPage(1);
  }, [query, category, range, chosenDate, channels, sort]);
  const time = now || Date.now();
  const today = localDay(new Date(time).toISOString(), zone);
  const nextDay = new Date(`${today}T12:00:00Z`);
  nextDay.setUTCDate(nextDay.getUTCDate() + 1);
  const tomorrow = nextDay.toISOString().slice(0, 10);
  const inPeriod = (b: Broadcast) => {
    if (channels) return b.channel;
    const official = officialFor(b);
    if (
      b.channel ||
      (official
        ? !["live", "upcoming"].includes(official.status)
        : b.end < time)
    )
      return false;
    const day = localDay(new Date(b.start).toISOString(), zone);
    if (chosenDate) return day === chosenDate;
    if (range === "Today") return day === today;
    if (range === "Tomorrow") return day === tomorrow;
    if (range === "Live now")
      return official
        ? official.status === "live"
        : b.start <= time && b.end >= time;
    if (range === "This week") {
      const end = new Date(`${today}T12:00:00Z`);
      end.setUTCDate(end.getUTCDate() + ((7 - end.getUTCDay()) % 7));
      return day >= today && day <= end.toISOString().slice(0, 10);
    }
    if (range === "Next 48 hours") return b.start <= time + 2 * 86400000;
    return true;
  };
  const entries = catalogue
    .filter(
      (b) =>
        inPeriod(b) &&
        (category === "All sports" ||
          sportKey(category) === sportKey(b.category)) &&
        `${b.title} ${b.competition}`
          .toLowerCase()
          .includes(query.toLowerCase()),
    )
    .sort((a, b) =>
      channels
        ? a.title.localeCompare(b.title)
        : sort === "Kickoff time"
          ? a.start - b.start
          : compareBroadcasts(a, b, time),
    );
  const pageCount = Math.max(1, Math.ceil(entries.length / 12));
  const current = Math.min(page, pageCount);
  const visible = entries.slice(
    (current - 1) * 12,
    (current - 1) * 12 + (preview ? 6 : 12),
  );
  const featured =
    !channels && !query && current === 1 && sort === "Recommended";
  const root = primary ? "/watch" : "/broadcasts";
  const renderCard = (item: Broadcast) => (
    <Link
      href={`/watch/${item.id}`}
      className={`broadcast-card${broadcastImportance(item) >= 1000 ? " broadcast-card-marquee" : ""}`}
      key={item.id}
    >
      <div className="broadcast-poster">
        {item.poster ? (
          <img
            src={item.poster}
            alt=""
            loading="lazy"
            referrerPolicy="no-referrer"
          />
        ) : (
          <span className="broadcast-poster-fallback">
            <>
              <Radio size={30} />
              <strong>{item.title}</strong>
            </>
          </span>
        )}
        {officialFor(item) ? (
          <span
            className={`broadcast-badge ${officialFor(item)?.status === "live" ? "is-live" : ""}`}
          >
            {officialFor(item)?.status === "live" ? "Live" : "Upcoming"}
          </span>
        ) : (
          <State item={item} />
        )}
      </div>
      <div className="broadcast-card-copy">
        <small>
          {item.category} · {item.competition}
        </small>
        {broadcastImportance(item) >= 1000 && (
          <span className="broadcast-big-match">Big match</span>
        )}
        <h3>{item.title}</h3>
        <StartTime item={item} />
        {!item.sources.length && (
          <span className="broadcast-sources">
            {watchableIds.includes(item.id)
              ? "Watch stream & tracker"
              : "Match centre & tracker"}
          </span>
        )}
        {item.sources.length > 1 && (
          <span className="broadcast-sources">
            {item.sources.length} stream options
          </span>
        )}
      </div>
    </Link>
  );
  return (
    <section className="broadcast-directory" aria-label="Broadcast catalogue">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Your matchday, all in one place</span>
          {preview ? (
            <h2>More broadcasts</h2>
          ) : (
            <h1>{primary ? "Watch" : "Broadcasts"}</h1>
          )}
        </div>
        <div className="broadcast-actions">
          <Link href="/multiview">
            <Columns2 size={17} /> Multiview
          </Link>
          {preview && <Link href="/watch">All matches →</Link>}
        </div>
      </div>
      {!preview && (
        <>
          <nav className="watch-section-tabs" aria-label="Watch sections">
            <Link
              href={root}
              aria-current={!channels && !replays ? "page" : undefined}
            >
              <Radio size={18} /> Matches
            </Link>
            <Link
              href={`${root}?view=channels`}
              aria-current={channels ? "page" : undefined}
            >
              <Tv size={18} /> Sports channels
            </Link>
            <Link
              href={`${root}?view=replays`}
              aria-current={replays ? "page" : undefined}
            >
              <Clapperboard size={18} /> Replays & highlights
            </Link>
          </nav>
          {!replays && (
            <>
              {!channels && (
                <div
                  className="watch-date-tabs"
                  role="group"
                  aria-label="Match dates"
                >
                  {[
                    "All",
                    "Live now",
                    "Today",
                    "Next 48 hours",
                    "Tomorrow",
                    "This week",
                  ].map((value) => (
                    <button
                      key={value}
                      aria-pressed={!chosenDate && range === value}
                      onClick={() => {
                        setChosenDate("");
                        setRange(value);
                        updateFilter({
                          date: "",
                          range: (
                            {
                              All: "all",
                              "Live now": "live",
                              Today: "today",
                              "Next 48 hours": "next48",
                              Tomorrow: "tomorrow",
                              "This week": "week",
                            } as Record<string, string>
                          )[value]!,
                        });
                      }}
                    >
                      {value}
                    </button>
                  ))}
                </div>
              )}
              <div className="broadcast-filters">
                <label>
                  Search broadcasts
                  <input
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      updateFilter({ q: e.target.value });
                    }}
                    placeholder={
                      channels
                        ? "Find a sports channel…"
                        : "Team, event or competition…"
                    }
                  />
                </label>
                <label>
                  Sport
                  <select
                    value={category}
                    onChange={(e) => {
                      setCategory(e.target.value);
                      updateFilter({
                        sport:
                          e.target.value === "All sports" ? "" : e.target.value,
                      });
                    }}
                  >
                    {[
                      "All sports",
                      ...(category !== "All sports" ? [category] : []),
                      ...new Set(
                        catalogue
                          .filter((b) => b.channel === channels)
                          .map((b) => b.category),
                      ),
                    ]
                      .filter((c, i, all) => all.indexOf(c) === i)
                      .map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                  </select>
                </label>
                {!channels && (
                  <details className="broadcast-more-filters">
                    <summary>More filters</summary>
                    <div className="broadcast-filter-popover">
                      <label>
                        Choose date
                        <input
                          type="date"
                          value={chosenDate}
                          onChange={(e) => {
                            setChosenDate(e.target.value);
                            updateFilter({ date: e.target.value });
                          }}
                        />
                      </label>
                      <label>
                        Order
                        <select
                          value={sort}
                          onChange={(e) => setSort(e.target.value)}
                        >
                          <option>Recommended</option>
                          <option>Kickoff time</option>
                        </select>
                      </label>
                    </div>
                  </details>
                )}
              </div>
              <EntitySuggestions
                query={query}
                sport={category === "All sports" ? undefined : category}
              />
              <div className="broadcast-results-meta">
                <span>
                  {entries.length} {channels ? "sports channels" : "matches"}
                  {category !== "All sports" ? ` · ${category}` : ""}
                </span>
                <span>{channels ? "Live sports networks" : zone}</span>
              </div>
            </>
          )}
        </>
      )}
      {replays ? (
        <>
          <WatchHub />
          <BroadcastArchive />
        </>
      ) : (
        <>
          {matchError && !channels && (
            <p className="broadcast-notice" role="alert">
              {matchError}{" "}
              <button onClick={() => retryMatches((n) => n + 1)}>
                Retry match updates
              </button>
            </p>
          )}
          {(loading || matchLoading) && !catalogue.length && (
            <p role="status">Loading broadcasts…</p>
          )}
          {feed.message && (
            <p className="broadcast-notice" role="status">
              {feed.message} <button onClick={retry}>Retry</button>
            </p>
          )}
          {featured && visible.length > 0 && (
            <div className="broadcast-section-heading">
              <h2>Top games</h2>
            </div>
          )}
          {!featured && entries.length > 0 && (
            <div className="broadcast-section-heading">
              <h2>{channels ? "Sports channels" : "Matches"}</h2>
            </div>
          )}
          <div className="broadcast-grid">
            {(featured ? visible.slice(0, 3) : visible).map(renderCard)}
          </div>
          {featured && visible.length > 3 && (
            <>
              <div className="broadcast-section-heading">
                <h2>More matches</h2>
              </div>
              <div className="broadcast-grid">
                {visible.slice(3).map(renderCard)}
              </div>
            </>
          )}
          {!loading &&
            !matchLoading &&
            !entries.length &&
            !feed.message &&
            !matchError && (
              <div className="broadcast-empty">
                <h2>
                  {channels
                    ? "No sports channels match"
                    : "No matches in this view"}
                </h2>
                <p>
                  {channels
                    ? "Try another sport or search."
                    : "Try another day, sport or All."}
                </p>
                <button
                  onClick={() => {
                    setQuery("");
                    setCategory("All sports");
                    setChosenDate("");
                    setRange("All");
                  }}
                >
                  Reset filters
                </button>
              </div>
            )}
          {!preview && pageCount > 1 && (
            <nav className="broadcast-pagination" aria-label="Broadcast pages">
              <button
                disabled={current === 1}
                onClick={() => {
                  setPage(current - 1);
                  document
                    .querySelector(".broadcast-directory")
                    ?.scrollIntoView({ block: "start" });
                }}
              >
                Previous
              </button>
              <span>
                Page {current} of {pageCount}
              </span>
              <button
                disabled={current === pageCount}
                onClick={() => {
                  setPage(current + 1);
                  document
                    .querySelector(".broadcast-directory")
                    ?.scrollIntoView({ block: "start" });
                }}
              >
                Next
              </button>
            </nav>
          )}
        </>
      )}
    </section>
  );
}
export function BroadcastViewing({ id }: { id: string }) {
  const { feed, loading, retry } = useBroadcasts();
  const item = feed.data.find((b) => b.id === id);
  const [theatre, setTheatre] = useState(false);
  const [shared, setShared] = useState(false);
  const { event, checking } = useBroadcastMatch(item);
  const [mode, setMode] = useState("stream");
  useEffect(() => setMode("stream"), [id]);
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(min-width:1001px)");
    const read = () => setWide(media.matches);
    read();
    media.addEventListener("change", read);
    return () => media.removeEventListener("change", read);
  }, []);
  const mainTracker = Boolean(
    event && (mode === "tracker" || !item?.sources.length),
  );
  if (!item)
    return (
      <section className="panel">
        <h1>{loading ? "Loading broadcast…" : "Broadcast unavailable"}</h1>
        <p>
          {loading
            ? "Fetching broadcast details…"
            : feed.message ||
              "This event is no longer in the provider’s catalogue."}
        </p>
        <button onClick={retry}>Retry</button>{" "}
        <Link href="/broadcasts">Browse broadcasts</Link>
      </section>
    );
  if (event)
    return (
      <EventViewing
        event={event}
        events={[]}
        favorite={null}
        broadcast={item}
      />
    );
  return (
    <section className={`broadcast-view${theatre ? " broadcast-theatre" : ""}`}>
      <header className="broadcast-title">
        <span className="eyebrow">
          {item.category} · {item.competition}
        </span>
        <h1>{item.title}</h1>
        <StartTime item={item} />
        <div className="broadcast-actions">
          <button onClick={() => setTheatre((v) => !v)}>
            {theatre ? "Standard view" : "Theatre view"}
          </button>
          <Link href={`/multiview?streams=${item.id}`}>
            <Columns2 size={16} /> Add to multiview
          </Link>
          <button
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(location.href);
                setShared(true);
              } catch {
                setShared(false);
              }
            }}
          >
            <Share2 size={16} />
            {shared ? "Link copied" : "Share"}
          </button>
        </div>
      </header>
      <div className="broadcast-view-layout">
        <div>
          {event && (
            <div
              className="view-mode-selector"
              role="group"
              aria-label="Viewing mode"
            >
              <button
                aria-pressed={!mainTracker}
                onClick={() => setMode("stream")}
                disabled={!item.sources.length}
              >
                Stream
              </button>
              <button
                aria-pressed={mainTracker}
                onClick={() => setMode("tracker")}
              >
                Match tracker
              </button>
            </div>
          )}
          {mainTracker && event ? (
            <LiveTracker event={event} />
          ) : (
            <BroadcastPlayer item={item} autoLoad />
          )}
          {event && !mainTracker && (!wide || theatre) && (
            <div className="broadcast-match-tracker">
              <LiveTracker event={event} compact />
            </div>
          )}
          {!item.channel && !event && (
            <p className="broadcast-tracker-status">
              {checking
                ? "Checking match updates…"
                : "Live match tracking is not available for this broadcast yet."}
            </p>
          )}
          {item.viewers !== null && (
            <p className="broadcast-viewers">
              {new Intl.NumberFormat().format(item.viewers)} watching
              {feed.stale ? " · last update" : ""}
            </p>
          )}
          <DisplayAdvertising />
        </div>
        <aside>
          {event && !mainTracker && wide && !theatre && (
            <div className="broadcast-match-tracker">
              <LiveTracker event={event} compact />
            </div>
          )}
          <h2>More to watch</h2>
          {feed.data
            .filter((b) => b.id !== id && b.category === item.category)
            .slice(0, 6)
            .map((b) => (
              <Link
                className="broadcast-related"
                key={b.id}
                href={`/watch/${b.id}`}
              >
                <State item={b} />
                <strong>{b.title}</strong>
                <StartTime item={b} />
              </Link>
            ))}
          <DisplayAdvertising placement="rectangle" />
          <AdSlot sponsored native format="rectangle" />
        </aside>
      </div>
    </section>
  );
}
export function Multiview() {
  const { feed, loading } = useBroadcasts();
  const params = useSearchParams();
  const [ids, setIds] = useState<string[]>([]);
  const [count, setCount] = useState(2);
  const [focus, setFocus] = useState(false);
  const [chooser, setChooser] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [copied, setCopied] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const now = useNow();
  useEffect(() => {
    const values = (params.get("streams") || "")
      .split(",")
      .map((id) => (/^ppv-\d+$/.test(id) ? id : ""))
      .slice(0, 4);
    setIds(values);
    const n = Number(params.get("n"));
    setCount([2, 3, 4].includes(n) ? n : Math.max(2, values.length));
    setFocus(params.get("layout") === "focus");
  }, [params]);
  function update(nextIds = ids, n = count, main = focus) {
    setIds(nextIds);
    setCount(n);
    setFocus(main);
    const p = new URLSearchParams({
      n: String(n),
      layout: main ? "focus" : "equal",
      streams: nextIds.slice(0, n).join(","),
    });
    history.replaceState(null, "", `/multiview?${p}`);
  }
  useEffect(() => {
    if (chooser !== null) {
      dialog.current?.showModal();
    } else dialog.current?.close();
  }, [chooser]);
  return (
    <section className="multiview">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Your matchday, your view</span>
          <h1>Multiview</h1>
        </div>
        <Link href="/broadcasts">Browse broadcasts →</Link>
      </div>
      <div className="multiview-toolbar">
        <div aria-label="Number of streams">
          {[2, 3, 4].map((n) => (
            <button
              key={n}
              aria-pressed={n === count}
              onClick={() => update(ids.slice(0, n), n)}
            >
              {n} streams
            </button>
          ))}
        </div>
        <div aria-label="Layout">
          <button
            aria-pressed={!focus}
            onClick={() => update(ids, count, false)}
          >
            Equal
          </button>
          <button aria-pressed={focus} onClick={() => update(ids, count, true)}>
            Focus
          </button>
        </div>
        <button
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(location.href);
              setCopied(true);
            } catch {}
          }}
        >
          <Share2 size={16} />
          {copied ? "Copied" : "Share view"}
        </button>
      </div>
      <p className="multiview-hint">
        Choose your streams. Use each player’s volume control to keep one audio
        feed on.
      </p>
      <div
        className={`multiview-grid multiview-${count}${focus ? " multiview-focus" : ""}`}
      >
        {Array.from({ length: count }, (_, index) => {
          const item = feed.data.find((b) => b.id === ids[index]);
          return (
            <article
              className="multiview-tile"
              key={`${index}-${ids[index] || "empty"}`}
            >
              {item ? (
                <>
                  <div className="multiview-tile-title">
                    <h2>{item.title}</h2>
                    <button
                      aria-label={`Change stream ${index + 1}`}
                      onClick={() => {
                        setQuery("");
                        setChooser(index);
                      }}
                    >
                      Change
                    </button>
                    {index > 0 && focus && (
                      <button
                        onClick={() => {
                          const next = [...ids];
                          [next[0], next[index]] = [next[index]!, next[0]!];
                          update(next);
                        }}
                      >
                        Make main
                      </button>
                    )}
                    <button
                      aria-label={`Remove stream ${index + 1}`}
                      onClick={() => {
                        const next = [...ids];
                        next[index] = "";
                        update(next);
                      }}
                    >
                      <X size={16} />
                    </button>
                  </div>
                  <BroadcastPlayer item={item} compact />
                </>
              ) : (
                <button
                  className="multiview-add"
                  onClick={() => {
                    setQuery("");
                    setChooser(index);
                  }}
                >
                  <Plus size={30} />
                  <span>{loading ? "Loading streams…" : "Add stream"}</span>
                </button>
              )}
            </article>
          );
        })}
      </div>
      <dialog
        ref={dialog}
        className="stream-chooser"
        aria-labelledby="stream-chooser-title"
        onCancel={() => setChooser(null)}
        onClick={(e) => {
          if (e.target === dialog.current) setChooser(null);
        }}
      >
        <div className="stream-chooser-heading">
          <h2 id="stream-chooser-title">Choose a stream</h2>
          <button
            autoFocus
            aria-label="Close stream chooser"
            onClick={() => setChooser(null)}
          >
            <X />
          </button>
        </div>
        <label>
          Search
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Team, sport or channel…"
          />
        </label>
        <div className="stream-chooser-list">
          {feed.data
            .filter(
              (b) =>
                !ids.includes(b.id) &&
                `${b.title} ${b.category}`
                  .toLowerCase()
                  .includes(query.toLowerCase()),
            )
            .map((b) => (
              <button
                key={b.id}
                onClick={() => {
                  const next = [...ids];
                  while (next.length < count) next.push("");
                  next[chooser!] = b.id;
                  update(next);
                  setChooser(null);
                }}
              >
                <span>
                  <small>
                    {b.category} · {now ? broadcastState(b, now) : "Broadcast"}
                  </small>
                  <strong>{b.title}</strong>
                </span>
                <Plus size={18} />
              </button>
            ))}
        </div>
      </dialog>
    </section>
  );
}
const archive = [
  {
    title: "ONE Samurai 1",
    category: "MMA",
    date: "29 Apr 2026",
    url: "https://ppv.rw/vod/one-samurai-1",
  },
  {
    title: "East vs West 25: Batumi",
    category: "Arm wrestling",
    date: "1 Aug 2026",
    url: "https://ppv.rw/vod/east-vs-west-25-batumi",
  },
  {
    title: "East vs West 25: Extended Pass",
    category: "Arm wrestling",
    date: "2 Aug 2026",
    url: "https://ppv.rw/vod/east-vs-west-25-extended-pass",
  },
  {
    title: "East vs West 23: Germany",
    category: "Arm wrestling",
    date: "18 Apr 2026",
    url: "https://ppv.rw/vod/east-vs-west-23",
  },
];
export function BroadcastArchive() {
  return (
    <section className="broadcast-archive">
      <div className="section-heading">
        <h2>More sports replays</h2>
        <a href="https://ppv.rw/vods" target="_blank" rel="noreferrer">
          Full replay archive ↗
        </a>
      </div>
      <p>Full-event replays. These open in a separate viewing site.</p>
      <div className="broadcast-grid">
        {archive.map((v) => (
          <a
            className="broadcast-card broadcast-archive-card"
            href={v.url}
            target="_blank"
            rel="noreferrer"
            key={v.url}
          >
            <small>
              {v.category} · {v.date}
            </small>
            <h3>{v.title}</h3>
            <span>
              Watch replay <ExternalLink size={15} />
            </span>
          </a>
        ))}
      </div>
    </section>
  );
}
