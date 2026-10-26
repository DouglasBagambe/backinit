"use client";
import Link from "next/link";
import { useState, useEffect } from "react";
import { ArrowLeft, Play, Activity, ShieldCheck } from "lucide-react";
import { timeline, stats, type SportEvent } from "@backinit/domain";
import { Crest, Empty } from "./primitives";
import { LazyPlayer as Player } from "./lazy-player";
export function MatchCentre({
  event: e,
  favorite,
}: {
  event: SportEvent;
  favorite: React.ReactNode;
}) {
  const [tab, setTab] = useState("Overview");
  const [index, setIndex] = useState(timeline.length - 1);
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    if (!playing) return;
    const t = setInterval(
      () => setIndex((i) => (i + 1) % timeline.length),
      2400,
    );
    return () => clearInterval(t);
  }, [playing]);
  const detail = e.id === "north-london";
  const current = timeline[index]!;
  return (
    <>
      <Link href="/scores" className="back-link">
        <ArrowLeft size={16} />
        All scores
      </Link>
      <div className="match-header">
        <div className="match-meta">
          {e.competition}
          <span>ILLUSTRATIVE EVENT</span>
        </div>
        {e.kind === "score" ? (
          <div className="scoreboard">
            <div>
              <Crest name={e.home} large />
              <h1>{e.home}</h1>
            </div>
            <div className="score-main">
              <span className={e.status === "live" ? "live-badge" : "pill"}>
                {e.clock}
              </span>
              <strong>
                {e.homeScore ?? "–"}
                <em>:</em>
                {e.awayScore ?? "–"}
              </strong>
              <small>
                {e.status === "live" ? "Simulated match state" : "Demo fixture"}
              </small>
            </div>
            <div>
              <Crest name={e.away} large />
              <h1>{e.away}</h1>
            </div>
          </div>
        ) : (
          <div className="event-title">
            <span className="eyebrow">{e.sport} · UPCOMING DEMO</span>
            <h1>{e.title}</h1>
            <p>
              {e.kind === "card"
                ? `${e.bouts.length} matches on the card`
                : `${e.session} · ${e.laps} laps`}
            </p>
          </div>
        )}
        <div className="match-bottom">
          <span>
            {detail
              ? "London · Demo stadium · Matchweek 9"
              : "26 October 2026 · Illustrative schedule"}
          </span>
          {favorite}
        </div>
      </div>
      {e.kind === "card" ? (
        <section className="panel">
          <h2>The match card</h2>
          <p className="muted">
            Fictional performers and bookings for interface demonstration.
          </p>
          {e.bouts.map((b) => (
            <div className="bout" key={b.stipulation}>
              <span className="eyebrow">{b.stipulation}</span>
              <h3>{b.performers.join(" vs ")}</h3>
              <span>Result pending</span>
            </div>
          ))}
        </section>
      ) : e.kind === "race" ? (
        <section className="panel">
          <h2>Race weekend</h2>
          <p>
            Timing, classification and circuit visualization await a motorsport
            provider.
          </p>
          <div className="availability">
            <Activity />
            <span>No timing feed connected. This demo is a schedule card.</span>
          </div>
        </section>
      ) : (
        <>
          <div
            className="match-tabs"
            role="tablist"
            aria-label="Match sections"
          >
            {[
              "Overview",
              "Tracker",
              "Statistics",
              "Timeline",
              "Lineups",
              "Watch",
            ].map((t) => (
              <button
                role="tab"
                id={`tab-${t}`}
                aria-controls="match-tab-panel"
                aria-selected={tab === t}
                tabIndex={tab === t ? 0 : -1}
                onKeyDown={(event) => {
                  const tabs = [
                    "Overview",
                    "Tracker",
                    "Statistics",
                    "Timeline",
                    "Lineups",
                    "Watch",
                  ];
                  const position = tabs.indexOf(t);
                  const next =
                    event.key === "ArrowRight"
                      ? (position + 1) % tabs.length
                      : event.key === "ArrowLeft"
                        ? (position + tabs.length - 1) % tabs.length
                        : event.key === "Home"
                          ? 0
                          : event.key === "End"
                            ? tabs.length - 1
                            : null;
                  if (next !== null) {
                    event.preventDefault();
                    const label = tabs[next]!;
                    setTab(label);
                    document.getElementById(`tab-${label}`)?.focus();
                  }
                }}
                key={t}
                className={tab === t ? "active" : ""}
                onClick={() => setTab(t)}
              >
                {t}
              </button>
            ))}
          </div>
          <div
            role="tabpanel"
            id="match-tab-panel"
            aria-labelledby={`tab-${tab}`}
          >
            {tab === "Watch" ? (
              <>
                <div className="availability">
                  <Play />
                  <div>
                    <strong>No broadcast configured for this event.</strong>
                    <p>
                      The player below is a separate test film, not footage of
                      this match.
                    </p>
                  </div>
                </div>
                <Player />
              </>
            ) : !detail ? (
              <Empty
                title="More detail is on the way."
                text="This event has a demo score only. Statistics, lineups and event tracking await a data provider."
              />
            ) : (
              <>
                {(tab === "Overview" || tab === "Tracker") && (
                  <div className="match-detail-grid">
                    <section className="tracker panel">
                      <div className="section-heading">
                        <h2>Match tracker</h2>
                        <span className="pill">EVENT REPLAY</span>
                      </div>
                      <div className="tracker-pitch">
                        <svg
                          viewBox="0 0 600 340"
                          role="img"
                          aria-label="Football pitch event visualization; no ball coordinates are available"
                        >
                          <defs>
                            <pattern
                              id="grass"
                              width="120"
                              height="340"
                              patternUnits="userSpaceOnUse"
                            >
                              <rect
                                width="60"
                                height="340"
                                fill="white"
                                opacity=".025"
                              />
                            </pattern>
                          </defs>
                          <rect width="600" height="340" fill="url(#grass)" />
                          <g
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            opacity=".45"
                          >
                            <rect x="24" y="24" width="552" height="292" />
                            <path d="M300 24v292" />
                            <circle cx="300" cy="170" r="48" />
                            <path d="M24 94h85v152H24 M576 94h-85v152h85 M24 132h32v76H24 M576 132h-32v76h32" />
                          </g>
                          <circle
                            cx="300"
                            cy="170"
                            r="4"
                            fill="currentColor"
                            opacity=".5"
                          />
                        </svg>
                        <div className="tracker-event" key={index}>
                          <span>
                            {current.minute}′ · {current.type.toUpperCase()}
                          </span>
                          <strong>{current.team}</strong>
                          <small>{current.text}</small>
                        </div>
                        <span className="pitch-caption">
                          Event visualization · not positional tracking
                        </span>
                      </div>
                      <div className="replay-controls">
                        <button
                          onClick={() => {
                            setPlaying(false);
                            setIndex(
                              (i) =>
                                (i + timeline.length - 1) % timeline.length,
                            );
                          }}
                          aria-label="Previous event"
                        >
                          ←
                        </button>
                        <button
                          className="primary"
                          onClick={() => setPlaying(!playing)}
                        >
                          {playing ? "Pause replay" : "Play event replay"}
                        </button>
                        <button
                          onClick={() => {
                            setPlaying(false);
                            setIndex((i) => (i + 1) % timeline.length);
                          }}
                          aria-label="Next event"
                        >
                          →
                        </button>
                      </div>
                      <p className="fine">
                        Curated demo events. No live ball position or attack
                        direction is inferred.
                      </p>
                    </section>
                    <section className="panel key-moments">
                      <div className="section-heading">
                        <h2>Key moments</h2>
                        <span className="pill">DEMO</span>
                      </div>
                      {[...timeline].reverse().map((t) => (
                        <button
                          className={`moment ${current.minute === t.minute ? "current" : ""}`}
                          key={t.minute}
                          onClick={() => {
                            setPlaying(false);
                            setIndex(timeline.indexOf(t));
                          }}
                        >
                          <b>{t.minute}′</b>
                          <span className={`event-dot ${t.type}`} />
                          <span>
                            <strong>{t.text}</strong>
                            <small>
                              {t.type === "goal" ? t.score : "Match event"}
                            </small>
                          </span>
                        </button>
                      ))}
                    </section>
                  </div>
                )}
                {(tab === "Overview" || tab === "Statistics") && (
                  <section className="panel statistics">
                    <div className="section-heading">
                      <h2>Match statistics</h2>
                      <span className="pill">DEMO SNAPSHOT · 67′</span>
                    </div>
                    {stats.map(([name, a, b]) => (
                      <div className="stat" key={name}>
                        <div>
                          <strong>
                            {a}
                            {name === "Possession" ? "%" : ""}
                          </strong>
                          <span>{name}</span>
                          <strong>
                            {b}
                            {name === "Possession" ? "%" : ""}
                          </strong>
                        </div>
                        <div className="stat-bars">
                          <span style={{ width: `${(a / (a + b)) * 100}%` }} />
                          <span style={{ width: `${(b / (a + b)) * 100}%` }} />
                        </div>
                      </div>
                    ))}
                    <p className="fine">
                      Arsenal in green · Liverpool in slate. Illustrative
                      values, not provider measurements.
                    </p>
                  </section>
                )}
                {tab === "Timeline" && (
                  <section className="panel">
                    <h2>Match timeline</h2>
                    {timeline.map((t) => (
                      <div className="timeline-row" key={t.minute}>
                        <strong>{t.minute}′</strong>
                        <span>{t.text}</span>
                        <b>{t.score}</b>
                      </div>
                    ))}
                  </section>
                )}
                {tab === "Lineups" && (
                  <Empty
                    title="Lineups aren’t available for this demo."
                    text="Confirmed starters, substitutions and formations will appear when supplied by a licensed provider."
                  />
                )}
              </>
            )}
          </div>
        </>
      )}
      <div className="availability">
        <ShieldCheck size={20} />
        <p>
          All event details on this page are demo content. No connection to a
          real live fixture is implied.
        </p>
      </div>
    </>
  );
}
