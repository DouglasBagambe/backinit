"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  ChevronRight,
  Search,
  Star,
  Sun,
  Moon,
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
} from "@backinit/domain";
import { LazyPlayer as Player } from "./lazy-player";
import { Crest, Empty } from "./primitives";
import { MatchCentre } from "./match-centre";
import { News } from "./news";
import { Utility } from "./utility";
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
}: {
  route: string;
  initialEvents: SportEvent[];
  feedSource: string;
}) {
  const events = initialEvents;
  const [favorites, setFavorites] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  const [theme, setTheme] = useState("system");
  const [query, setQuery] = useState("");
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
    if (!ready) return;
    try {
      localStorage.setItem("backinit-favorites", JSON.stringify(favorites));
    } catch {}
  }, [favorites, ready]);
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
  function toggle(id: string) {
    setFavorites((f) =>
      f.includes(id) ? f.filter((x) => x !== id) : [...f, id],
    );
  }
  function favorite(e: SportEvent) {
    return (
      <button
        disabled={!ready}
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
                  : `${e.session} · ${e.laps} laps`}
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
  const list = filterEvents(events, {
    sport: activeSport,
    query: route === "search" ? query : undefined,
    live: route === "live",
    ids: route === "favorites" ? favorites : undefined,
  });
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
          <button
            className="icon-button"
            onClick={() =>
              setTheme(
                document.documentElement.dataset.theme === "dark"
                  ? "light"
                  : "dark",
              )
            }
            aria-label="Toggle color theme"
          >
            <Sun size={19} />
          </button>
          <Link className="avatar" href="/profile" aria-label="Guest profile">
            G
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
          <ShieldCheck size={13} /> DEMO EDITION
        </span>
        <p>
          Explore the experience. Scores, fixtures and event cards are
          illustrative.
        </p>
        <Link href="/settings">
          About this preview <ArrowUpRight size={13} />
        </Link>
      </div>
      {offline && (
        <div className="offline" role="status">
          You’re offline. Demo content remains available on this page; video
          needs a connection.
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
          {match ? (
            <MatchCentre event={match} favorite={favorite(match)} />
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
              theme={theme}
              setTheme={setTheme}
              clear={() => setFavorites([])}
            />
          ) : (
            <>
              <div className="page-heading">
                <div>
                  <div className="eyebrow">
                    {route === "live"
                      ? "DEMO MATCHDAY"
                      : route === "favorites"
                        ? "MADE FOR YOU"
                        : "THE WORLD OF SPORT, IN ONE PLACE"}
                  </div>
                  <h1>{title}</h1>
                  <p>
                    {route === "favorites"
                      ? "Keep the events you care about close. Saved on this device."
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
                    Demo matchday<small>26 October 2026 · UTC</small>
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
                <News />
              ) : (
                <>
                  {(isHome || route === "live") && (
                    <>
                      <div className="section-heading">
                        <h2>
                          <i className="live-dot" />
                          In play <span className="pill">DEMO</span>
                        </h2>
                        <Link href="/live">
                          All live events <ChevronRight size={15} />
                        </Link>
                      </div>
                      <div className="featured-grid">
                        {events
                          .filter(
                            (e) => e.status === "live" && e.kind === "score",
                          )
                          .map(
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
                                    <span className="live-badge">
                                      <i />
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
                  {isHome && (
                    <Link
                      href="/match/north-london"
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
                          Stats, key moments and the bigger picture.
                          <br />
                          Meet your new match centre.
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
                        <span className="art-tag">67′ &nbsp; CORNER</span>
                      </div>
                    </Link>
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
                                  ? "Live demo scores"
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
                      {route === "fixtures" && (
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
                              : "Try another search or explore a different sport. No provider is connected for this feed yet."
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
                              {list.filter((e) => e.competition === c).map(row)}
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
                  {isHome && <News compact />}
                </>
              )}
            </>
          )}
          <footer>
            <Link className="footer-brand" href="/">
              backinit.
            </Link>
            <span>Every moment matters.</span>
            <small>{feedSource} · No real live data or sports broadcasts</small>
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
