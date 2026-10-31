"use client";
import Link from "next/link";
import { AdvertisingProvider, AdSlot, AdPreferences } from "./advertising";
import { BrandMark, EventSkeleton } from "./brand";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  ChevronRight,
  ChevronDown,
  Search,
  Star,
  Play,
  Radio,
  CalendarDays,
  House,
  Settings,
  ArrowLeft,
  Globe2,
  Activity,
  Trophy,
  Menu,
  X,
  Heart,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import {
  sports,
  eventTitle,
  filterEvents,
  type SportEvent,
  type Coverage,
  type NewsFeed,
  type EventFeed,
} from "@backinit/domain";
import { LazyPlayer as Player } from "./lazy-player";
import { Crest, Empty } from "./primitives";
import { MatchCentre } from "./match-centre";
import { News } from "./news";
import { Utility } from "./utility";
import { SportMark } from "./marks";
import { LiveWatch } from "./live-watch";
import { WeekendMatches } from "./weekend-matches";
import { EventViewing } from "./event-viewing";
import { WatchHub } from "./watch-hub";
import { Privacy } from "./privacy";
import { Account, accountRequest, type AccountUser } from "./account";
import { Admin } from "./admin";
import { Directory, type Follow } from "./directory";
import { usesCatalogue } from "../lib/page-data";
import { feedSchema, eventSchema, freshEventFeed } from "@backinit/domain";
const sportUrl = (s: string) =>
  "/sport/" + s.toLowerCase().replaceAll(" ", "-");
export function Experience({
  route,
  initialEvents,
  feedSource: seedSource,
  edition,
  coverage: seedCoverage,
  news,
  demoAvailable = false,
  nativeAdsEnabled = false,
}: {
  route: string;
  initialEvents: SportEvent[];
  feedSource: string;
  edition: "real" | "demo";
  coverage: Coverage[];
  news: NewsFeed | null;
  demoAvailable?: boolean;
  nativeAdsEnabled?: boolean;
}) {
  const [liveFeed, setLiveFeed] = useState<EventFeed>({
    data: initialEvents,
    source: seedSource,
    coverage: seedCoverage,
    edition,
  });
  const [catalogueLoading, setCatalogueLoading] = useState(
    edition === "real" && usesCatalogue(route) && !initialEvents.length,
  );
  const events = liveFeed.data;
  const feedSource = liveFeed.source;
  const coverage = liveFeed.coverage;
  useEffect(() => {
    setLiveFeed((old) =>
      initialEvents.length || old.edition !== edition || !old.data.length
        ? {
            data: initialEvents,
            source: seedSource,
            coverage: seedCoverage,
            edition,
          }
        : freshEventFeed(old),
    );
  }, [initialEvents, seedSource, seedCoverage, edition, route]);
  useEffect(
    () =>
      setCatalogueLoading(
        edition === "real" && usesCatalogue(route) && !liveFeed.data.length,
      ),
    [route, edition, initialEvents.length, liveFeed.data.length],
  );
  const router = useRouter();
  const real = edition === "real";
  const [editionError, setEditionError] = useState("");
  const [date, setDate] = useState("");
  useEffect(() => {
    // Refresh data without rerendering the whole route or blocking a navigation.
    if (
      !real ||
      !usesCatalogue(route) ||
      route === "watch" ||
      route.startsWith("watch/")
    )
      return;
    const controller = new AbortController();
    const matchId = route.startsWith("match/") ? route.split("/")[1] : null;
    let running = false;
    const refresh = async () => {
      if (running || document.hidden || controller.signal.aborted) return;
      running = true;
      try {
        const response = await fetch(
          matchId
            ? `/api/events/${encodeURIComponent(matchId)}`
            : "/api/events",
          {
            signal: AbortSignal.any([
              controller.signal,
              AbortSignal.timeout(20000),
            ]),
          },
        );
        if (!response.ok) return;
        const body = await response.json();
        if (matchId) {
          const event = eventSchema.parse(body.data);
          if (event.id !== matchId || event.provenance !== "provider")
            throw new Error("Wrong match");
          if (!controller.signal.aborted)
            setLiveFeed((old) =>
              freshEventFeed({
                ...old,
                data: old.data.some((e) => e.id === event.id)
                  ? old.data.map((e) => (e.id === event.id ? event : e))
                  : [event, ...old.data],
              }),
            );
          return;
        }
        const feed = freshEventFeed(feedSchema.parse(body));
        if (!controller.signal.aborted && feed.edition === "real")
          setLiveFeed(feed);
      } catch {
        if (!controller.signal.aborted)
          setLiveFeed((old) => freshEventFeed(old));
      } finally {
        running = false;
        if (!controller.signal.aborted) setCatalogueLoading(false);
      }
    };
    if (!initialEvents.length || matchId) void refresh();
    const timer = setInterval(() => {
      void refresh();
    }, 30000);
    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, [real, route, initialEvents.length]);
  async function changeEdition() {
    setEditionError("");
    try {
      const response = await fetch("/api/edition", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ edition: real ? "demo" : "real" }),
      });
      if (!response.ok) throw new Error();
      window.location.assign("/");
    } catch {
      setEditionError("Unable to switch edition. Please retry.");
    }
  }
  const [favorites, setFavorites] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  const [theme, setTheme] = useState("system");
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("q") || "");
  const [user, setUser] = useState<AccountUser | null>(null);
  const [accountVersion, setAccountVersion] = useState(0);
  const [syncing, setSyncing] = useState(true);
  const [syncError, setSyncError] = useState("");
  const [following, setFollowing] = useState<Follow[]>([]);
  useEffect(() => {
    let active = true;
    let failed = false;
    setSyncing(true);
    setSyncError("");
    void accountRequest("me")
      .then(async (r) => {
        const saved = await accountRequest("favorites");
        if (!active) return;
        setUser(r.user);
        setFavorites(
          saved.data
            .filter((f: { kind: string }) => f.kind === "event")
            .map((f: { target: string }) => f.target),
        );
        setFollowing(
          saved.data.filter((f: { kind: string }) => f.kind !== "event"),
        );
      })
      .catch((error) => {
        if (active && error.status !== 401) {
          failed = true;
          setSyncError(
            "Saved items are temporarily unavailable. Please try again. Your saved preferences are unchanged.",
          );
          return;
        }
        if (active) {
          setUser(null);
          try {
            const saved = JSON.parse(
              localStorage.getItem("backinit-favorites") || "[]",
            );
            setFavorites(
              Array.isArray(saved)
                ? saved.filter(
                    (x: unknown): x is string => typeof x === "string",
                  )
                : [],
            );
            const follows = JSON.parse(
              localStorage.getItem("backinit-following") || "[]",
            );
            setFollowing(
              Array.isArray(follows)
                ? follows.filter(
                    (f) =>
                      f &&
                      ["team", "athlete", "competition", "sport"].includes(
                        f.kind,
                      ) &&
                      typeof f.target === "string",
                  )
                : [],
            );
          } catch {
            setFavorites([]);
            setFollowing([]);
          }
        }
      })
      .finally(() => {
        if (active) setSyncing(failed);
      });
    return () => {
      active = false;
    };
  }, [accountVersion]);
  const [menu, setMenu] = useState(false);
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    try {
      const saved = JSON.parse(
        localStorage.getItem("backinit-favorites") || "[]",
      );
      if (Array.isArray(saved))
        setFavorites(
          saved.filter((x: unknown): x is string => typeof x === "string"),
        );
      const follows = JSON.parse(
        localStorage.getItem("backinit-following") || "[]",
      );
      if (Array.isArray(follows))
        setFollowing(
          follows.filter(
            (f) =>
              f &&
              ["team", "athlete", "sport", "competition"].includes(f.kind) &&
              typeof f.target === "string",
          ),
        );
      const t = localStorage.getItem("backinit-theme");
      if (t && ["dark", "light", "system"].includes(t)) setTheme(t);
    } catch {}
    setReady(true);
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  useEffect(() => {
    if (!ready || user || syncing) return;
    try {
      localStorage.setItem("backinit-following", JSON.stringify(following));
      localStorage.setItem("backinit-favorites", JSON.stringify(favorites));
    } catch {}
  }, [favorites, following, ready, user, syncing]);
  useEffect(() => {
    if (!ready) return;
    const media = matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      document.documentElement.dataset.theme =
        theme === "system" ? (media.matches ? "dark" : "light") : theme;
    };
    apply();
    try {
      localStorage.setItem("backinit-theme", theme);
    } catch {}
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [theme, ready]);
  async function clearEvents() {
    if (syncing) throw new Error("Wait for favorites to finish syncing.");
    if (user) await accountRequest("saved-events", "DELETE");
    setFavorites([]);
  }
  async function toggle(id: string) {
    if (syncing) return;
    const saved = favorites.includes(id);
    setSyncError("");
    if (user) {
      setSyncing(true);
      try {
        await accountRequest("favorites", saved ? "DELETE" : "POST", {
          kind: "event",
          target: id,
        });
      } catch (error) {
        setSyncError((error as Error).message);
        return;
      } finally {
        setSyncing(false);
      }
    }
    setFavorites((f) => (saved ? f.filter((x) => x !== id) : [...f, id]));
  }
  async function follow(item: Follow) {
    if (syncing) return;
    const saved = following.some(
      (f) => f.kind === item.kind && f.target === item.target,
    );
    setSyncError("");
    if (user) {
      setSyncing(true);
      try {
        await accountRequest("favorites", saved ? "DELETE" : "POST", item);
      } catch (error) {
        setSyncError((error as Error).message);
        return;
      } finally {
        setSyncing(false);
      }
    }
    setFollowing((f) =>
      saved
        ? f.filter((x) => x.kind !== item.kind || x.target !== item.target)
        : [...f, item],
    );
  }
  function favorite(e: SportEvent) {
    return (
      <button
        disabled={!ready || syncing}
        className={`icon-button favorite ${favorites.includes(e.id) ? "selected" : ""}`}
        aria-label={`${favorites.includes(e.id) ? "Remove" : "Save"} ${eventTitle(e)}`}
        aria-pressed={favorites.includes(e.id)}
        onClick={() => toggle(e.id)}
      >
        <Star
          size={17}
          fill={favorites.includes(e.id) ? "currentColor" : "none"}
        />
      </button>
    );
  }
  function row(e: SportEvent) {
    return (
      <div className="match-row" key={e.id}>
        <div className={`match-time ${e.status === "live" ? "live" : ""}`}>
          {real && (
            <time dateTime={e.start}>
              {new Date(e.start).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "short",
                timeZone: "UTC",
              })}
            </time>
          )}
          <span className="match-clock">
            {e.status === "live" && <i />}
            {e.kind === "score"
              ? e.clock
              : e.status === "upcoming"
                ? "Upcoming"
                : e.status === "finished"
                  ? "Final"
                  : e.status}
          </span>
        </div>
        <Link className="match-teams" href={"/match/" + e.id}>
          {e.kind === "score" ? (
            <>
              <span>
                <Crest
                  name={e.home}
                  imageUrl={
                    e.kind === "score" ? e.homeParticipant?.imageUrl : undefined
                  }
                />
                <span className="team-name">{e.home}</span>
                <b>{e.homeScore ?? "–"}</b>
              </span>
              <span>
                <Crest
                  name={e.away}
                  imageUrl={
                    e.kind === "score" ? e.awayParticipant?.imageUrl : undefined
                  }
                />
                <span className="team-name">{e.away}</span>
                <b>{e.awayScore ?? "–"}</b>
              </span>
            </>
          ) : (
            <>
              <strong>{e.title}</strong>
              {e.kind === "card" ? (
                e.bouts.length > 0 && (
                  <small>
                    {e.bouts.length}{" "}
                    {e.bouts.length === 1 ? "match" : "matches"}
                  </small>
                )
              ) : (
                <small>
                  {e.session}
                  {e.laps === null ? "" : ` · ${e.laps} laps`}
                </small>
              )}
            </>
          )}
        </Link>
        <span className="row-sport">
          <SportMark name={e.sport} />
          {e.sport}
        </span>
        {favorite(e)}
        <Link
          className="row-open"
          aria-label={`Open ${eventTitle(e)}`}
          href={"/match/" + e.id}
        >
          <ChevronRight size={17} />
        </Link>
      </div>
    );
  }
  const activeSport = route.startsWith("sport/")
    ? sports.find((s) => sportUrl(s) === "/" + route)
    : undefined;
  const isHome = route === "";
  const match =
    route.startsWith("match/") || route.startsWith("watch/")
      ? events.find((e) => e.id === route.split("/")[1])
      : undefined;
  const filtered = filterEvents(events, {
    sport: activeSport,
    query: route === "search" ? query : undefined,
    live: route === "live",
    ids: route === "favorites" ? favorites : undefined,
  });
  const reference = Date.now();
  const list = filtered.filter((e) => {
    if (!real || route === "search" || route === "favorites") return true;
    if (date) return e.start.slice(0, 10) === date;
    return (
      Date.parse(e.start) >= reference - 7 * 86400000 &&
      Date.parse(e.start) <= reference + 14 * 86400000
    );
  });
  const featuredEvents = real
    ? events
        .filter((e) => e.kind === "score" && e.status === "finished")
        .sort((a, b) => b.start.localeCompare(a.start))
        .slice(0, 3)
    : events.filter((e) => e.status === "live" && e.kind === "score");
  const editorialEvent = real
    ? featuredEvents.find((e) => e.detail?.goals?.length)
    : events.find((e) => e.id === "north-london");
  const title =
    activeSport ||
    (
      {
        live: "Live",
        scores: "Scores",
        fixtures: "Fixtures",
        favorites: "Saved",
        search: "Search",
        watch: "Watch",
        videos: "Replays & highlights",
        playback: "Playback verification",
        news: "News",
      } as Record<string, string>
    )[route] ||
    (real ? "Watch" : "Sport today");
  return (
    <AdvertisingProvider enabled={real} nativeEnabled={nativeAdsEnabled}>
      <a className="skip" href="#main">
        Skip to content
      </a>
      <header className="topbar">
        <Link className="brand" href="/" title="BackInIt home">
          <BrandMark className="brand-mark" />
          back<span>in</span>it<span className="brand-dot">.</span>
        </Link>
        <nav className="desktop-nav" aria-label="Main navigation">
          {[
            ["watch", "Watch"],
            ["fixtures", "Fixtures"],
            ["live", "Live"],
            ["scores", "Scores"],
            ["news", "News"],
          ].map(([path, label]) => (
            <Link
              key={path}
              href={"/" + path}
              className={
                route === path ||
                (path === "watch" && route.startsWith("watch/"))
                  ? "active"
                  : ""
              }
            >
              {label === "Live" && <i className="live-dot" />}
              {label}
            </Link>
          ))}
        </nav>
        <div className="header-actions">
          <Link
            className="search-shortcut"
            href="/search"
            aria-label="Search sport"
          >
            <Search size={17} />
            <span>Search sport</span>
            <kbd>⌕</kbd>
          </Link>
          <Link
            className="icon-button"
            href="/favorites"
            aria-label="Favorites"
          >
            <Star size={19} />
          </Link>
          <Link
            className={`avatar${user ? " avatar-signed-in" : ""}`}
            href="/profile"
            aria-label={user ? "Account profile" : "Guest profile"}
          >
            {user ? (
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                aria-hidden="true"
                focusable="false"
              >
                <circle cx="12" cy="7.5" r="4" fill="currentColor" />
                <path
                  d="M5 20v-1a7 7 0 0 1 14 0v1a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1Z"
                  fill="currentColor"
                />
              </svg>
            ) : (
              <UserRound size={18} aria-hidden="true" />
            )}
          </Link>
          <button
            className="icon-button menu-toggle"
            aria-label="Toggle navigation"
            aria-expanded={menu}
            onClick={() => setMenu(!menu)}
          >
            {menu ? <X /> : <Menu />}
          </button>
        </div>
      </header>
      {menu && (
        <nav className="mobile-menu" aria-label="More navigation">
          {["news", "fixtures", "search", "settings", "profile"].map((p) => (
            <Link onClick={() => setMenu(false)} key={p} href={"/" + p}>
              {p}
            </Link>
          ))}
        </nav>
      )}
      <div className="sports-strip">
        <nav className="sports-nav" aria-label="Sports">
          <Link
            href={isHome || route.startsWith("watch") ? "/watch" : "/scores"}
            className={
              !activeSport && !(route === "watch" && searchParams.get("sport"))
                ? "chosen"
                : ""
            }
          >
            <SportMark name="All sports" />
            All sports
          </Link>
          {sports.map((s) => (
            <Link
              className={
                activeSport === s ||
                (route === "watch" && searchParams.get("sport") === s)
                  ? "chosen"
                  : ""
              }
              href={
                isHome || route.startsWith("watch")
                  ? `/watch?sport=${encodeURIComponent(s)}&range=upcoming`
                  : sportUrl(s)
              }
              key={s}
            >
              <span className="sport-symbol">
                <SportMark name={s} />
              </span>
              {s}
            </Link>
          ))}
        </nav>
        <details className="sports-picker">
          <summary>
            <span>Sports</span>
            <ChevronDown size={15} />
          </summary>
          <nav className="sports-picker-grid" aria-label="Choose sport">
            <Link
              href={isHome || route.startsWith("watch") ? "/watch" : "/scores"}
              onClick={(e) =>
                e.currentTarget.closest("details")?.removeAttribute("open")
              }
            >
              <SportMark name="All sports" />
              All sports
            </Link>
            {sports.map((s) => (
              <Link
                key={s}
                href={
                  isHome || route.startsWith("watch")
                    ? `/watch?sport=${encodeURIComponent(s)}&range=upcoming`
                    : sportUrl(s)
                }
                onClick={(e) =>
                  e.currentTarget.closest("details")?.removeAttribute("open")
                }
              >
                <SportMark name={s} />
                {s}
              </Link>
            ))}
          </nav>
        </details>
      </div>
      {!real && !route.startsWith("watch") && (
        <div className="demo-strip">
          <span>
            <ShieldCheck size={13} />{" "}
            {real ? "REAL DATA · LIMITED COVERAGE" : "DEMO EDITION"}
          </span>
          <button onClick={changeEdition}>
            {real ? "Explore demo edition" : "Use real sports data"}{" "}
            <ArrowUpRight size={13} />
          </button>
        </div>
      )}
      {editionError && <p role="alert">{editionError}</p>}
      {offline && (
        <div className="offline" role="status">
          You’re offline. Displayed content may be outdated; video needs a
          connection.
        </div>
      )}
      <div className="app-layout">
        <main id="main" className="main">
          {syncError &&
            ["favorites", "settings", "profile"].includes(route) && (
              <p className="account-notice" role="alert">
                {syncError}
              </p>
            )}
          {match && route.startsWith("watch/") ? (
            <EventViewing
              event={match}
              events={events}
              favorite={favorite(match)}
            />
          ) : match ? (
            <MatchCentre event={match} favorite={favorite(match)} />
          ) : route === "privacy" ? (
            <Privacy nativeAdsEnabled={nativeAdsEnabled} />
          ) : route === "admin" ? (
            <Admin />
          ) : route === "profile" ? (
            <>
              <div className="page-heading">
                <h1>Account</h1>
              </div>
              <Account onChange={() => setAccountVersion((v) => v + 1)} />
            </>
          ) : ["teams", "athletes", "competitions"].includes(route) ? (
            <Directory
              route={route}
              events={events}
              following={following}
              toggle={follow}
              busy={!ready || syncing}
            />
          ) : [
              "settings",
              "profile",
              "admin",
              "competitions",
              "teams",
              "athletes",
            ].includes(route) ? (
            <Utility
              route={route}
              clear={clearEvents}
              busy={!ready || syncing}
            />
          ) : (
            <>
              {!(route === "watch" || (real && isHome)) && (
                <div className="page-heading">
                  <h1>{title}</h1>
                </div>
              )}
              {route === "watch" ? (
                <>
                  {real && <WeekendMatches initialEvents={events} poll />}
                  <LiveWatch />
                </>
              ) : route === "videos" ? (
                <WatchHub />
              ) : route === "playback" ? (
                <>
                  <section className="panel">
                    <h2>Test feeds only</h2>
                    <p>
                      This page verifies the player with public testing content,
                      including a live DASH simulator. None of these feeds is a
                      sporting broadcast.
                    </p>
                  </section>
                  <Player />
                </>
              ) : route === "news" ? (
                <News feed={news} real={real} />
              ) : (
                <>
                  {isHome && real && (
                    <>
                      <WeekendMatches initialEvents={events} />
                      <LiveWatch preview />
                    </>
                  )}
                  {(isHome || route === "live") &&
                    (!real || (isHome && featuredEvents.length > 0)) && (
                      <>
                        <div className="section-heading">
                          <h2>
                            {!real && <i className="live-dot" />}
                            {real ? "Latest results" : "In play"}{" "}
                            <span className="pill">
                              {real ? "PROVIDER DATA" : "DEMO"}
                            </span>
                          </h2>
                          <Link href={real ? "/scores" : "/live"}>
                            {real ? "All results" : "All live events"}{" "}
                            <ChevronRight size={15} />
                          </Link>
                        </div>
                        <div className="featured-grid">
                          {featuredEvents.map(
                            (e, i) =>
                              e.kind === "score" && (
                                <article
                                  className={`featured featured-${i}`}
                                  key={e.id}
                                >
                                  <div className="featured-top">
                                    <span>
                                      {e.competition.replace(" · Demo", "")}
                                    </span>
                                    <span
                                      className={real ? "pill" : "live-badge"}
                                    >
                                      {!real && <i />}
                                      {e.clock}
                                    </span>
                                  </div>
                                  <Link
                                    className="featured-score"
                                    href={"/match/" + e.id}
                                  >
                                    <div>
                                      <Crest
                                        name={e.home}
                                        imageUrl={
                                          e.kind === "score"
                                            ? e.homeParticipant?.imageUrl
                                            : undefined
                                        }
                                        large
                                      />
                                      <span>{e.home}</span>
                                    </div>
                                    <strong>
                                      {e.homeScore}
                                      <em>:</em>
                                      {e.awayScore}
                                    </strong>
                                    <div>
                                      <Crest
                                        name={e.away}
                                        imageUrl={
                                          e.kind === "score"
                                            ? e.awayParticipant?.imageUrl
                                            : undefined
                                        }
                                        large
                                      />
                                      <span>{e.away}</span>
                                    </div>
                                  </Link>
                                  <div className="featured-bottom">
                                    <Link href={"/match/" + e.id}>
                                      Match centre <ArrowUpRight size={15} />
                                    </Link>
                                    {favorite(e)}
                                  </div>
                                </article>
                              ),
                          )}
                        </div>
                      </>
                    )}
                  {isHome && !real && editorialEvent && (
                    <Link
                      href={"/match/" + editorialEvent.id}
                      className="editorial-banner"
                    >
                      <div>
                        <span className="eyebrow">CLOSER TO EVERY MOMENT</span>
                        <h2>
                          Don’t just follow the score.
                          <br />
                          Follow the story.
                        </h2>
                        <p>
                          {real
                            ? eventTitle(editorialEvent)
                            : "Stats, key moments and the bigger picture."}
                          <br />
                          {real
                            ? "Reported goals, results and the season table."
                            : "Meet your new match centre."}
                        </p>
                        <span className="banner-cta">
                          Explore the match <ArrowUpRight size={17} />
                        </span>
                      </div>
                      <div className="pitch-art" aria-hidden="true">
                        <div className="pitch-outline">
                          <i />
                          <b />
                          <span className="art-ball" />
                        </div>
                        <span className="art-tag">
                          {real ? "GOAL EVENTS" : "67′ · CORNER"}
                        </span>
                      </div>
                    </Link>
                  )}
                  {isHome &&
                    ready &&
                    (favorites.length > 0 || following.length > 0) && (
                      <section className="panel">
                        <div className="section-heading">
                          <h2>Your matchday</h2>
                          <Link href="/favorites">Manage saved events ↗</Link>
                        </div>
                        <p>
                          {following.length} followed teams, athletes or
                          competitions ·{" "}
                          {user ? "Account favorites" : "Saved on this device"}
                        </p>
                        {events
                          .filter(
                            (e) =>
                              favorites.includes(e.id) ||
                              following.some((f) =>
                                f.kind === "competition"
                                  ? f.target === e.competition
                                  : f.kind === "sport"
                                    ? f.target === e.sport
                                    : f.kind === "team"
                                      ? e.kind === "score" &&
                                        [e.home, e.away].includes(f.target)
                                      : e.detail?.goals?.some(
                                          (g) => g.player === f.target,
                                        ) ||
                                        e.detail?.classification?.some(
                                          (r) => r.driver === f.target,
                                        ),
                              ),
                          )
                          .filter(
                            (e) =>
                              !real ||
                              Date.parse(e.start) > Date.now() - 7 * 86400000,
                          )
                          .slice(0, 5)
                          .map(row)}
                      </section>
                    )}
                  <div className="content-columns">
                    <section className="fixtures-panel">
                      <div className="section-heading">
                        <h2>
                          {route === "search"
                            ? "Search events"
                            : route === "favorites"
                              ? "Saved events"
                              : activeSport
                                ? `${activeSport} events`
                                : route === "live"
                                  ? real
                                    ? "Live scores"
                                    : "Live demo scores"
                                  : "The matchday"}
                        </h2>
                        {isHome && (
                          <Link href="/scores">
                            All scores <ChevronRight size={15} />
                          </Link>
                        )}
                      </div>
                      {route === "search" && (
                        <label className="search-input">
                          <Search size={20} />
                          <input
                            autoFocus
                            maxLength={100}
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Team, competition or sport…"
                            aria-label="Search events"
                          />
                        </label>
                      )}
                      {route === "search" && (
                        <nav
                          className="directory-links"
                          aria-label="Explore directories"
                        >
                          <Link href="/teams">Teams</Link>
                          <Link href="/athletes">Athletes</Link>
                          <Link href="/competitions">Competitions</Link>
                        </nav>
                      )}
                      {real && ["fixtures", "scores"].includes(route) && (
                        <label className="calendar-label">
                          Fixture date (UTC)
                          <input
                            type="date"
                            aria-label="Fixture date"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                          />
                          <button onClick={() => setDate("")}>
                            Recent & upcoming
                          </button>
                        </label>
                      )}
                      {route === "fixtures" && !real && (
                        <div className="calendar-label">
                          <CalendarDays size={18} />
                          Monday, 26 October 2026{" "}
                          <span>Fixed demo calendar</span>
                        </div>
                      )}
                      {catalogueLoading && !events.length ? (
                        <EventSkeleton />
                      ) : list.length === 0 ? (
                        <Empty
                          title={
                            route === "favorites"
                              ? "Your favorites start here."
                              : "No events to show."
                          }
                          text={
                            route === "favorites"
                              ? "Tap the star on any event to save it here."
                              : "Try another date, search or sport. Check data coverage for provider availability."
                          }
                        />
                      ) : (
                        <div className="fixture-groups">
                          {Array.from(
                            new Set(list.map((e) => e.competition)),
                          ).map((c) => {
                            const group = list.filter(
                              (e) => e.competition === c,
                            );
                            return (
                              <section className="fixture-group" key={c}>
                                <div className="league-heading">
                                  <SportMark name={group[0]!.sport} />
                                  <h3>{c}</h3>
                                </div>
                                {group
                                  .slice(0, isHome && real ? 6 : undefined)
                                  .map(row)}
                              </section>
                            );
                          })}
                        </div>
                      )}
                    </section>
                    <aside className="right-rail">
                      {real && <AdSlot format="rectangle" />}
                      <div className="section-heading">
                        <h2>{real ? "Match information" : "On the horizon"}</h2>
                        <CalendarDays size={17} />
                      </div>
                      {!real && (
                        <>
                          <Link
                            className="event-poster wrestling"
                            href="/match/wwe-showcase"
                          >
                            <div className="poster-top">
                              <span>WRESTLING</span>
                              <ArrowUpRight size={18} />
                            </div>
                            <div className="poster-monogram" aria-hidden="true">
                              W
                            </div>
                            <h3>
                              Saturday
                              <br />
                              Night Showcase<span>.</span>
                            </h3>
                            <p>Fictional event card · 2 matches</p>
                            <div className="poster-footer">
                              EXPLORE THE CARD <ChevronRight size={15} />
                            </div>
                          </Link>
                          <Link className="race-card" href="/match/grand-prix">
                            <span className="eyebrow">FORMULA 1 · DEMO</span>
                            <h3>
                              Lights out.
                              <br />
                              All eyes on the grid.
                            </h3>
                            <p>
                              Grand Prix weekend <ArrowUpRight size={16} />
                            </p>
                            <div className="racing-lines" aria-hidden="true" />
                          </Link>
                        </>
                      )}
                      {real && (
                        <details className="panel coverage-panel">
                          <summary>Sports data coverage</summary>
                          {coverage.map((c) => (
                            <div
                              className="coverage-item"
                              key={`${c.provider}-${c.sport}-${c.message}`}
                            >
                              <span className="pill">{c.status}</span>
                              <h4>{c.sport}</h4>
                              <p>{c.message}</p>
                              {c.fetchedAt && (
                                <small>
                                  Fetched{" "}
                                  {new Date(c.fetchedAt).toLocaleString(
                                    "en-GB",
                                    { timeZone: "UTC" },
                                  )}{" "}
                                  UTC
                                </small>
                              )}
                            </div>
                          ))}
                        </details>
                      )}
                      {!real && (
                        <div className="rail-note">
                          <Heart size={19} />
                          <h3>Built around your passion.</h3>
                          <p>
                            Save an event to shape your own matchday. No account
                            needed.
                          </p>
                          <Link href="/favorites">
                            Your favorites <ChevronRight size={14} />
                          </Link>
                        </div>
                      )}
                    </aside>
                  </div>
                  {isHome && (!real || Boolean(news?.data.length)) && (
                    <News compact feed={news} real={real} />
                  )}
                </>
              )}
            </>
          )}
          {real &&
            ["", "watch", "live", "scores", "fixtures", "news"].includes(
              route,
            ) && <AdSlot native />}
          <AdPreferences />
          <footer>
            <Link className="footer-brand" href="/">
              <BrandMark />
              <span>backinit.</span>
            </Link>
            <Link href="/settings">Settings</Link>
            <Link href="/privacy">Privacy</Link>
            <a href="/sports/credits.html">Image credits</a>
            <fieldset className="footer-theme">
              <legend>Appearance</legend>
              {["light", "dark", "system"].map((value) => (
                <button
                  key={value}
                  aria-pressed={theme === value}
                  onClick={() => setTheme(value)}
                >
                  {value}
                </button>
              ))}
            </fieldset>
            {real && demoAvailable && (
              <button className="text-button" onClick={changeEdition}>
                Demo edition
              </button>
            )}
            <details className="footer-data">
              <summary>About coverage</summary>
              <small>
                Event coverage and viewing options vary by sport and location.
              </small>
            </details>
          </footer>
        </main>
      </div>
      <nav className="bottom-nav" aria-label="Mobile navigation">
        {[
          ["", "Home", House],
          ["live", "Live", Radio],
          ["watch", "Watch", Play],
          ["scores", "Scores", Activity],
          ["favorites", "Saved", Star],
        ].map(([p, label, Icon]) => {
          const I = Icon as typeof House;
          return (
            <Link
              key={p as string}
              href={"/" + p}
              className={
                route === p || (p === "watch" && route.startsWith("watch/"))
                  ? "active"
                  : ""
              }
            >
              <I size={20} />
              <span>{label as string}</span>
            </Link>
          );
        })}
      </nav>
    </AdvertisingProvider>
  );
}
