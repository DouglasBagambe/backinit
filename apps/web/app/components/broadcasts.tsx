"use client";
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
import { WatchHub } from "./watch-hub";
import { useBroadcastMatch } from "./broadcast-match";
import { LiveTracker } from "./live-tracker";
import {
  compareBroadcasts,
  broadcastImportance,
} from "../lib/broadcast-ranking";
import { useViewingZone, localDay } from "../lib/viewing-time";
import { AdSlot, PlaybackAdNotice } from "./advertising";
import { DisplayAdvertising } from "./display-advertising";
function useBroadcasts() {
  const [feed, setFeed] = useState<BroadcastFeed>({
    data: [],
    updatedAt: null,
    stale: false,
  });
  const [loading, setLoading] = useState(true);
  const [attempt, retry] = useState(0);
  useEffect(() => {
    const c = new AbortController();
    let busy = false;
    const load = async () => {
      if (busy || document.hidden) return;
      busy = true;
      try {
        const r = await fetch("/api/broadcasts", {
          signal: AbortSignal.any([c.signal, AbortSignal.timeout(9000)]),
        });
        const next = broadcastFeedSchema.parse(await r.json());
        if (!c.signal.aborted)
          setFeed((old) =>
            next.updatedAt
              ? next
              : { ...old, stale: true, message: next.message },
          );
      } catch {
        if (!c.signal.aborted)
          setFeed((old) => ({
            ...old,
            stale: true,
            message: "Broadcast catalogue unavailable. Try again.",
          }));
      } finally {
        busy = false;
        if (!c.signal.aborted) setLoading(false);
      }
    };
    void load();
    const timer = setInterval(load, 60000);
    document.addEventListener("visibilitychange", load);
    return () => {
      c.abort();
      clearInterval(timer);
      document.removeEventListener("visibilitychange", load);
    };
  }, [attempt]);
  return { feed, loading, retry: () => retry((x) => x + 1) };
}
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
        ? new Intl.DateTimeFormat(undefined, {
            timeZone: zone,
            weekday: "short",
            day: "numeric",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
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
  const requested = params.get("sport");
  const requestedRange = params.get("range");
  useEffect(() => {
    setRange(requestedRange === "live" ? "Live now" : "Today");
    setChosenDate(params.get("date") || "");
  }, [requestedRange, params]);
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
    if (b.channel || b.end < time) return false;
    const day = localDay(new Date(b.start).toISOString(), zone);
    if (chosenDate) return day === chosenDate;
    if (range === "Today") return day === today;
    if (range === "Tomorrow") return day === tomorrow;
    if (range === "Live now") return b.start <= time && b.end >= time;
    if (range === "This week") {
      const end = new Date(`${today}T12:00:00Z`);
      end.setUTCDate(end.getUTCDate() + ((7 - end.getUTCDay()) % 7));
      return day >= today && day <= end.toISOString().slice(0, 10);
    }
    if (range === "Next 48 hours") return b.start <= time + 2 * 86400000;
    return true;
  };
  const entries = feed.data
    .filter(
      (b) =>
        inPeriod(b) &&
        (category === "All sports" || category === b.category) &&
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
            <Play size={30} />
          </span>
        )}
        <State item={item} />
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
        {item.sources.length > 1 && (
          <span className="broadcast-sources">
            {item.sources.length} stream options
          </span>
        )}
      </div>
    </Link>
  );
  if (primary && !feed.data.length && !channels && !replays)
    return feed.message ? (
      <p className="broadcast-notice" role="status">
        {feed.message} <button onClick={retry}>Retry</button>
      </p>
    ) : null;
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
                    onChange={(e) => setQuery(e.target.value)}
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
                    onChange={(e) => setCategory(e.target.value)}
                  >
                    {[
                      "All sports",
                      ...new Set(
                        feed.data
                          .filter((b) => b.channel === channels)
                          .map((b) => b.category),
                      ),
                    ].map((c) => (
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
                          onChange={(e) => setChosenDate(e.target.value)}
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
          {loading && !feed.data.length && (
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
          {!loading && !entries.length && !feed.message && (
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
          {!preview && (
            <p className="broadcast-credit">
              Schedule and viewer figures supplied by PPV. Playback availability
              can change.{" "}
              <a href="https://ppv.st/api" target="_blank" rel="noreferrer">
                Integration information ↗
              </a>
            </p>
          )}
        </>
      )}
    </section>
  );
}
export function BroadcastPlayer({
  item,
  compact = false,
}: {
  item: Broadcast;
  compact?: boolean;
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
    setSource(item.sources[0]?.id || "");
    setPlaying(false);
  }, [item.id]);
  useEffect(() => {
    setLoaded(false);
    setSlow(false);
    setFailed(false);
    if (!playing) return;
    const t = setTimeout(() => setSlow(true), 15000);
    return () => clearTimeout(t);
  }, [source, playing, attempt]);
  return (
    <div
      className={`broadcast-player${compact ? " broadcast-player-compact" : ""}`}
      ref={root}
    >
      <div className="broadcast-player-rim">
        <State item={item} />
        <PlayerBrand />
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
            onLoad={() => setLoaded(true)}
            onError={() => setFailed(true)}
          />
        ) : (
          <div className="broadcast-start">
            {item.poster && <img src={item.poster} alt="" />}
            {choice && !failed ? (
              <button
                aria-label={`Play ${item.title}`}
                onClick={() => setPlaying(true)}
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
        {item.sources.length > 1 && (
          <label>
            <span className="sr-only">Stream for {item.title}</span>
            <select
              aria-label={`Stream for ${item.title}`}
              value={choice?.id}
              onChange={(e) => {
                setSource(e.target.value);
                setPlaying(false);
              }}
            >
              {item.sources.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        )}
        <button
          title="Reload stream"
          aria-label={`Reload ${item.title}`}
          onClick={() => {
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
      {!playing && <PlaybackAdNotice />}
      {slow && !loaded && playing && (
        <p role="status" className="broadcast-status">
          Still connecting. Try another stream or reload.
        </p>
      )}
    </div>
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
            <BroadcastPlayer item={item} />
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
              {new Intl.NumberFormat().format(item.viewers)} watching across PPV
              · provider figure{feed.stale ? " · last snapshot" : ""}
            </p>
          )}
          <DisplayAdvertising />
          <details className="viewing-notes">
            <summary>Broadcast information</summary>
            <p>
              Embedded player supplied by PPV. Its playback restrictions,
              controls and advertising remain in place. A loaded frame does not
              confirm live playback.{" "}
              <a href={item.pageUrl} target="_blank" rel="noreferrer">
                Open provider page ↗
              </a>
            </p>
          </details>
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
          PPV archive ↗
        </a>
      </div>
      <p>Full-event replays on PPV. These open on the provider’s site.</p>
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
