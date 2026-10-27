"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  ChevronRight,
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
} from "lucide-react";
import {
  sports,
  eventTitle,
  filterEvents,
  type SportEvent,
  type Coverage,
  type NewsFeed,
} from "@backinit/domain";
import { LazyPlayer as Player } from "./lazy-player";
import { Crest, Empty } from "./primitives";
import { MatchCentre } from "./match-centre";
import { News } from "./news";
import { Utility } from "./utility";
import { Account, accountRequest, type AccountUser } from "./account";
import { Admin } from "./admin";
import { Directory, type Follow } from "./directory";
const sportIcons: Record<string, string> = {
  Football: "◉",
  Basketball: "◈",
  Tennis: "◒",
  WWE: "W",
  "Formula 1": "F1",
  Cricket: "╱",
  MMA: "◇",
  "American football": "⬭",
  Baseball: "◉",
  Rugby: "⬭",
};
const sportUrl = (s: string) =>
  "/sport/" + s.toLowerCase().replaceAll(" ", "-");
export function Experience({
  route,
  initialEvents,
  feedSource,
  edition,
  coverage,
  news,
}: {
  route: string;
  initialEvents: SportEvent[];
  feedSource: string;
  edition: "real" | "demo";
  coverage: Coverage[];
  news: NewsFeed | null;
}) {
  const events = initialEvents;
  const router = useRouter();
  const real = edition === "real";
  const [editionError, setEditionError] = useState("");
  const [date, setDate] = useState("");
  useEffect(() => {
    if (!real) return;
    const timer = setInterval(() => {
      if (!document.hidden) router.refresh();
    }, 60000);
    return () => clearInterval(timer);
  }, [real, router]);
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
            "Account sync is unavailable. Reload to retry; saved preferences have not changed.",
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
          {e.status === "live" && <i />}
          {e.kind === "score"
            ? e.clock
            : e.status === "upcoming"
              ? "Upcoming"
              : "Final"}
        </div>
        <Link className="match-teams" href={"/match/" + e.id}>
          {e.kind === "score" ? (
            <>
              <span>
                <Crest name={e.home} />
                {e.home}
                <b>{e.homeScore ?? "–"}</b>
              </span>
              <span>
                <Crest name={e.away} />
                {e.away}
                <b>{e.awayScore ?? "–"}</b>
              </span>
            </>
          ) : (
            <>
              <strong>{e.title}</strong>
              <small>
                {e.kind === "card"
                  ? `${e.bouts.length} matches · Event card`
                  : `${e.session}${e.laps === null ? "" : ` · ${e.laps} laps`}`}
              </small>
            </>
          )}
        </Link>
        <span className="row-sport">{e.sport}</span>
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
  const match = route.startsWith("match/")
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
        live: "In the moment.",
        scores: "Every score. One place.",
        fixtures: "Make time for the game.",
        favorites: "Your side of sport.",
        search: "Find your next obsession.",
        watch: "The best seat is yours.",
        news: "Beyond the score.",
      } as Record<string, string>
    )[route] ||
    "Your daily dose of sport.";
  return (
    <>
      <a className="skip" href="#main">
        Skip to content
      </a>
      <header className="topbar">
        <Link className="brand" href="/" title="BackInIt home">
          <span className="brand-mark" aria-hidden="true">
            b<span>↗</span>
          </span>
          back<span>in</span>it<span className="brand-dot">.</span>
        </Link>
        <nav className="desktop-nav" aria-label="Main navigation">
          {[
            ["", "Discover"],
            ["live", "Live"],
            ["watch", "Watch"],
            ["scores", "Scores"],
            ["news", "News"],
          ].map(([path, label]) => (
            <Link
              key={path}
              href={"/" + path}
              className={route === path ? "active" : ""}
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
            className="avatar"
            href="/profile"
            aria-label={user ? "Account profile" : "Guest profile"}
          >
            {user ? user.email[0]?.toUpperCase() : "G"}
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
      <nav className="sports-nav" aria-label="Sports">
        <Link href="/scores" className={!activeSport ? "chosen" : ""}>
          <Globe2 size={16} />
          All sports
        </Link>
        {sports.map((s) => (
          <Link
            className={activeSport === s ? "chosen" : ""}
            href={sportUrl(s)}
            key={s}
          >
            <span className="sport-symbol">{sportIcons[s]}</span>
            {s}
          </Link>
        ))}
      </nav>
      <div className="demo-strip">
        <span>
          <ShieldCheck size={13} />{" "}
          {real ? "REAL DATA · LIMITED COVERAGE" : "DEMO EDITION"}
        </span>
        <p>
          {real
            ? "Bundesliga fixtures, results and goals · F1 schedule and latest classification. No live clocks or broadcasts."
            : "Explore the experience. Scores, fixtures and event cards are illustrative."}
        </p>
        <button onClick={changeEdition}>
          {real ? "Explore demo edition" : "Use real sports data"}{" "}
          <ArrowUpRight size={13} />
        </button>
      </div>
      {editionError && <p role="alert">{editionError}</p>}
      {offline && (
        <div className="offline" role="status">
          You’re offline. Displayed content may be outdated; video needs a
          connection.
        </div>
      )}
      <div className="app-layout">
        <aside className="sidebar">
          <span className="eyebrow">YOUR SPORT, CLOSER</span>
          <nav aria-label="Explore">
            <Link className={isHome ? "side-active" : ""} href="/">
              <House size={18} />
              Overview
            </Link>
            <Link
              className={route === "live" ? "side-active" : ""}
              href="/live"
            >
              <Radio size={18} />
              Live now{" "}
              <span className="count">
                {events.filter((e) => e.status === "live").length}
              </span>
            </Link>
            <Link
              className={route === "fixtures" ? "side-active" : ""}
              href="/fixtures"
            >
              <CalendarDays size={18} />
              Fixtures & calendar
            </Link>
            <Link
              className={route === "favorites" ? "side-active" : ""}
              href="/favorites"
            >
              <Star size={18} />
              My favorites{" "}
              {ready && favorites.length > 0 && (
                <span className="count">{favorites.length}</span>
              )}
            </Link>
          </nav>
          <div className="sidebar-rule" />
          <span className="eyebrow">EXPLORE SPORTS</span>
          <nav>
            {sports.slice(0, 7).map((s) => (
              <Link href={sportUrl(s)} key={s}>
                <span className="sport-symbol">{sportIcons[s]}</span>
                {s}
              </Link>
            ))}
          </nav>
          <div className="sidebar-note">
            <span className="tiny-brand">b↗</span>
            <h3>More than a result.</h3>
            <p>
              The moments. The rivalries.
              <br />
              The reason you’re a fan.
            </p>
            <Link href="/favorites">
              Make it yours <ArrowUpRight size={14} />
            </Link>
          </div>
          <Link className="settings-link" href="/settings">
            <Settings size={16} />
            Settings & preferences
          </Link>
        </aside>
        <main id="main" className="main">
          {syncError && <p role="alert">{syncError}</p>}
          {match ? (
            <MatchCentre event={match} favorite={favorite(match)} />
          ) : route === "admin" ? (
            <Admin />
          ) : route === "profile" ? (
            <>
              <div className="page-heading">
                <h1>Your game. Your space.</h1>
              </div>
              <Account onChange={() => setAccountVersion((v) => v + 1)} />
            </>
          ) : ["teams", "athletes", "competitions"].includes(route) ? (
            <Directory
              route={route}
              events={events}
              following={following}
              toggle={follow}
            />
          ) : [
              "settings",
              "profile",
              "admin",
              "competitions",
              "teams",
              "athletes",
            ].includes(route) ? (
            <Utility route={route} clear={clearEvents} />
          ) : (
            <>
              <div className="page-heading">
                <div>
                  <div className="eyebrow">
                    {route === "live"
                      ? real
                        ? "PROVIDER SNAPSHOTS"
                        : "DEMO MATCHDAY"
                      : route === "favorites"
                        ? "MADE FOR YOU"
                        : "THE WORLD OF SPORT, IN ONE PLACE"}
                  </div>
                  <h1>{title}</h1>
                  <p>
                    {route === "favorites"
                      ? user
                        ? "Your saved events, synced to your account."
                        : "Keep the events you care about close. Saved on this device."
                      : route === "watch"
                        ? "An integrated player. A seamless matchday."
                        : activeSport
                          ? `Follow the moments that matter in ${activeSport.toLowerCase()}.`
                          : "From the first whistle to the final moment. Stay in it."}
                  </p>
                </div>
                <Link className="date-chip" href="/fixtures">
                  <CalendarDays size={16} />
                  <span>
                    {real ? "Your matchday" : "Demo matchday"}
                    <small>
                      {real
                        ? "Schedules & results · UTC"
                        : "26 October 2026 · UTC"}
                    </small>
                  </span>
                </Link>
              </div>
              {route === "watch" ? (
                <>
                  <Player />
                  <div className="section-heading">
                    <h2>Sports broadcasts</h2>
                    <span className="muted">Source availability</span>
                  </div>
                  <Empty
                    title="The stage is set. Rights come first."
                    text="No authorized sports streams are configured yet. Match scores and event details are still available."
                  />
                </>
              ) : route === "news" ? (
                <News feed={news} real={real} />
              ) : (
                <>
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
                                      <Crest name={e.home} large />
                                      <span>{e.home}</span>
                                    </div>
                                    <strong>
                                      {e.homeScore}
                                      <em>:</em>
                                      {e.awayScore}
                                    </strong>
                                    <div>
                                      <Crest name={e.away} large />
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
                  {isHome && editorialEvent && (
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
                      {list.length === 0 ? (
                        <Empty
                          title={
                            route === "favorites"
                              ? "Your favorites start here."
                              : "No events to show."
                          }
                          text={
                            route === "favorites"
                              ? "Tap the star on any event to save it here."
                              : "Try another date, search or sport. Real coverage is currently limited to Bundesliga and Formula 1."
                          }
                        />
                      ) : (
                        <div className="fixture-groups">
                          {Array.from(
                            new Set(list.map((e) => e.competition)),
                          ).map((c) => (
                            <section className="fixture-group" key={c}>
                              <div className="league-heading">
                                <Trophy size={15} />
                                <h3>{c}</h3>
                              </div>
                              {list
                                .filter((e) => e.competition === c)
                                .slice(0, isHome && real ? 6 : undefined)
                                .map(row)}
                            </section>
                          ))}
                        </div>
                      )}
                    </section>
                    <aside className="right-rail">
                      <div className="section-heading">
                        <h2>On the horizon</h2>
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
                        <section className="panel">
                          <h3>Coverage, honestly.</h3>
                          {coverage.map((c) => (
                            <div className="coverage-item" key={c.provider}>
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
                        </section>
                      )}
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
                    </aside>
                  </div>
                  {isHome && <News compact feed={news} real={real} />}
                </>
              )}
            </>
          )}
          <footer>
            <Link className="footer-brand" href="/">
              backinit.
            </Link>
            <span>Every moment matters.</span>
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
            <small>{feedSource} · No sports broadcasts configured</small>
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
              className={route === p ? "active" : ""}
            >
              <I size={20} />
              <span>{label as string}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
