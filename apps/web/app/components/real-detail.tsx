"use client";
import { useState } from "react";
import Link from "next/link";
import { entityHref, formationLines, type SportEvent } from "@backinit/domain";
import { LazyPlayer as Player } from "./lazy-player";
import { localStart, useViewingZone } from "../lib/viewing-time";
import { Crest } from "./marks";
import { Empty } from "./primitives";
export function RealDetail({
  event,
  tab = "Overview",
  hidePlayer = false,
}: {
  event: SportEvent;
  tab?: string;
  hidePlayer?: boolean;
}) {
  const { zone } = useViewingZone();
  const goals = event.detail?.goals || [];
  const [index, setIndex] = useState(0);
  const current = goals[index];
  const detail = event.detail;
  const rows = tab === "Statistics" ? detail?.statistics : detail?.periods;
  if (tab === "Form")
    return (
      <section className="panel">
        <h2>Recent form</h2>
        <div className="lineup-grid">
          {detail?.form?.map((team) => (
            <article key={team.team}>
              <h3>{team.team}</h3>
              {[...team.matches]
                .sort((a, b) => b.date.localeCompare(a.date))
                .map((m) => (
                  <div className="form-match" key={m.id}>
                    <span className={`form-result form-${m.result}`}>
                      {m.result}
                    </span>
                    <div>
                      <strong>{m.opponent}</strong>
                      <small>{localStart(m.date, zone)}</small>
                    </div>
                    <b>{m.score}</b>
                  </div>
                ))}
            </article>
          ))}
        </div>
      </section>
    );
  if (tab === "Head to head")
    return (
      <section className="panel">
        <h2>Head to head</h2>
        {detail?.headToHead?.map((m) => (
          <div className="entity-match" key={m.id}>
            <div>
              <small>
                {localStart(m.date, zone)} · {m.competition}
              </small>
              <strong>
                {m.home} vs {m.away}
              </strong>
            </div>
            <b>
              {m.homeScore} – {m.awayScore}
            </b>
          </div>
        ))}
      </section>
    );
  if (
    tab === "Statistics" ||
    (event.kind === "score" &&
      event.sport !== "Football" &&
      tab === "Overview" &&
      rows?.length)
  )
    return rows?.length ? (
      <section className="panel">
        <h2>{tab === "Statistics" ? "Statistics" : "Score by period"}</h2>
        <div
          className="table-scroll"
          role="region"
          aria-label="Match statistics"
          tabIndex={0}
        >
          <table>
            <thead>
              <tr>
                <th scope="col">Statistic</th>
                <th scope="col">
                  {event.kind === "score" ? event.home : "Home"}
                </th>
                <th scope="col">
                  {event.kind === "score" ? event.away : "Away"}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={`${row.label}-${i}`}>
                  <th scope="row">{row.label}</th>
                  <td>{row.home}</td>
                  <td>{row.away}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    ) : (
      <Empty
        title="Statistics unavailable for this feed."
        text="No data available."
      />
    );
  if (tab === "Lineups")
    return detail?.lineups?.length ? (
      <section className="panel">
        <h2>Lineups</h2>
        <div className="lineup-grid">
          {detail.lineups.map((team) => {
            const lines =
              event.sport === "Football" ? formationLines(team) : null;
            const canDraw = Boolean(lines);
            return (
              <article key={team.team} className="lineup-team">
                <header>
                  <h3>{team.team}</h3>
                  {team.formation && (
                    <span className="pill">{team.formation}</span>
                  )}
                </header>
                {canDraw && (
                  <div
                    className="formation-pitch"
                    aria-label={`${team.team} formation ${team.formation}`}
                  >
                    {lines?.map((line, i) => (
                      <div className="formation-line" key={i}>
                        {line.map((p) => (
                          <div className="formation-player" key={p.name}>
                            <span className="lineup-portrait">
                              <Crest name={p.name} imageUrl={p.imageUrl} />
                              <b>{p.jersey || "•"}</b>
                            </span>
                            <Link
                              href={entityHref("athlete", p.name, event.sport, {
                                id: p.id,
                                providerSport: event.source?.provider
                                  .split(":")[1]
                                  ?.split("/")[0],
                                league: event.source?.provider.split("/")[1],
                              })}
                            >
                              {p.name}
                            </Link>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
                {[
                  {
                    label: "Starting lineup",
                    players: team.players.filter((p) => p.starter === true),
                  },
                  {
                    label: "Substitutes",
                    players: team.players.filter((p) => p.starter === false),
                  },
                  {
                    label: "Squad",
                    players: team.players.filter(
                      (p) => p.starter === undefined,
                    ),
                  },
                ]
                  .filter((group) => group.players.length)
                  .map((group) => (
                    <div key={group.label}>
                      <h4>{group.label}</h4>
                      <ul className="lineup-list">
                        {group.players.map((p, i) => (
                          <li key={p.name + i}>
                            <span className="lineup-portrait">
                              <Crest name={p.name} imageUrl={p.imageUrl} />
                              <b>{p.jersey || "–"}</b>
                            </span>
                            <Link
                              href={entityHref("athlete", p.name, event.sport, {
                                id: p.id,
                                providerSport: event.source?.provider
                                  .split(":")[1]
                                  ?.split("/")[0],
                                league: event.source?.provider.split("/")[1],
                              })}
                            >
                              {p.name}
                            </Link>
                            <small>{p.position}</small>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
              </article>
            );
          })}
        </div>
      </section>
    ) : (
      <Empty
        title="Lineups unavailable for this feed."
        text="No data available."
      />
    );
  if ((tab === "Timeline" || tab === "Tracker") && detail?.timeline?.length)
    return (
      <section className="panel">
        <h2>Play by play</h2>
        {detail.timeline.map((p, i) => (
          <div className="moment" key={`${p.id}-${i}`}>
            <b>{p.clock}</b>
            <span>
              {p.text}
              {p.team ? <small>{p.team}</small> : null}
            </span>
          </div>
        ))}
      </section>
    );
  if (event.kind === "card")
    return (
      <section className="panel">
        <h2>
          {["WWE", "MMA"].includes(event.sport)
            ? "Event card"
            : "Event schedule"}
        </h2>
        {event.detail?.round && <p>{event.detail.round}</p>}
        {event.bouts.length ? (
          event.bouts.map((b) => (
            <div
              className="bout"
              key={`${b.performers.join("-")}-${b.stipulation}`}
            >
              <strong>{b.performers.join(" vs ")}</strong>
              <p>{b.stipulation}</p>
            </div>
          ))
        ) : (
          <p>
            {["WWE", "MMA"].includes(event.sport)
              ? "Card not announced."
              : "Order of play unavailable."}
          </p>
        )}
      </section>
    );
  if (event.kind === "score" && event.sport !== "Football")
    return (
      <section className="panel">
        <h2>{event.sport} event information</h2>
        <p>
          {event.detail?.round} · {event.detail?.venue}
        </p>
      </section>
    );
  if (event.scheduleOnly && tab !== "Overview")
    return (
      <Empty
        title={`${tab} unavailable`}
        text="Check back closer to the event."
      />
    );
  if (event.kind === "race")
    return (
      <section className="panel">
        <h2>
          {event.detail?.classification?.length
            ? "Race classification"
            : "Race weekend"}
        </h2>
        <p>
          {event.detail?.venue} · {event.detail?.round}
        </p>
        {event.detail?.classification?.length ? (
          <div
            className="table-scroll"
            tabIndex={0}
            role="region"
            aria-label="Scrollable data table"
          >
            <table>
              <thead>
                <tr>
                  <th scope="col">Pos</th>
                  <th scope="col">Driver</th>
                  <th scope="col">Team</th>
                  <th scope="col">Laps</th>
                  <th scope="col">Time / status</th>
                  <th scope="col">Pts</th>
                </tr>
              </thead>
              <tbody>
                {event.detail.classification.map((r) => (
                  <tr key={r.position}>
                    <td>{r.position}</td>
                    <th scope="row">{r.driver}</th>
                    <td>{r.team}</td>
                    <td>{r.laps}</td>
                    <td>{r.time || r.status}</td>
                    <td>{r.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p>
            Scheduled start:{" "}
            <time dateTime={event.start}>
              {new Date(event.start).toLocaleString("en-GB", {
                timeZone: "UTC",
              })}{" "}
              UTC
            </time>
            . Live timing is not available.
          </p>
        )}
      </section>
    );
  return (
    <>
      <div className={tab === "Overview" ? "real-viewing-grid" : undefined}>
        {tab === "Overview" && !hidePlayer && <Player eventId={event.id} />}
        {(tab === "Overview" || tab === "Tracker") && goals.length > 0 && (
          <section className="panel real-tracker">
            <div className="section-heading">
              <h2>Goal event replay</h2>
              <span className="pill">PROVIDER EVENTS</span>
            </div>
            {current ? (
              <>
                <div className="event-replay" aria-live="polite">
                  <span className="eyebrow">
                    {current.minute === null
                      ? "Minute unavailable"
                      : `${current.minute}′`}{" "}
                    · GOAL{current.penalty ? " · PENALTY" : ""}
                    {current.ownGoal ? " · OWN GOAL" : ""}
                  </span>
                  <strong>
                    {current.homeScore} : {current.awayScore}
                  </strong>
                  <h3>{current.player || "Scorer unavailable"}</h3>
                  <p>{current.team}</p>
                </div>
                <div className="replay-controls">
                  <button
                    disabled={index === 0}
                    onClick={() => setIndex((i) => i - 1)}
                  >
                    Previous goal
                  </button>
                  <span>
                    {index + 1} / {goals.length}
                  </span>
                  <button
                    disabled={index === goals.length - 1}
                    onClick={() => setIndex((i) => i + 1)}
                  >
                    Next goal
                  </button>
                </div>
              </>
            ) : (
              <p>No goal events have been reported for this fixture.</p>
            )}
            <p className="fine">
              Goal events only. Live positioning unavailable.
            </p>
          </section>
        )}
      </div>
      {(tab === "Overview" || tab === "Timeline") && goals.length > 0 && (
        <section className="panel">
          <h2>Goal timeline</h2>
          {goals.length ? (
            goals.map((g) => (
              <div className="moment" key={g.id}>
                <b>{g.minute ?? "–"}′</b>
                <span>
                  <strong>
                    {g.player || "Scorer unavailable"}
                    {g.ownGoal ? " (OG)" : g.penalty ? " (P)" : ""}
                  </strong>
                  <small>
                    {g.team || "Team unavailable"} · {g.homeScore}–{g.awayScore}
                  </small>
                </span>
              </div>
            ))
          ) : (
            <p>
              No goal events reported. Other match events are not supplied by
              this feed.
            </p>
          )}
        </section>
      )}
      {tab === "Overview" && event.detail?.standings && (
        <section className="panel">
          <h2>Bundesliga standings</h2>
          <p>Current season table · OpenLigaDB</p>
          <div
            className="table-scroll"
            tabIndex={0}
            role="region"
            aria-label="Scrollable data table"
          >
            <table>
              <thead>
                <tr>
                  <th scope="col">#</th>
                  <th scope="col">Team</th>
                  <th scope="col">P</th>
                  <th scope="col">W</th>
                  <th scope="col">D</th>
                  <th scope="col">L</th>
                  <th scope="col">GF</th>
                  <th scope="col">GA</th>
                  <th scope="col">Pts</th>
                </tr>
              </thead>
              <tbody>
                {event.detail.standings.map((t, i) => (
                  <tr
                    key={t.team}
                    className={
                      event.kind === "score" &&
                      [event.home, event.away].includes(t.team)
                        ? "highlight-row"
                        : ""
                    }
                  >
                    <td>{i + 1}</td>
                    <th scope="row">{t.team}</th>
                    <td>{t.played}</td>
                    <td>{t.won}</td>
                    <td>{t.drawn}</td>
                    <td>{t.lost}</td>
                    <td>{t.goalsFor}</td>
                    <td>{t.goalsAgainst}</td>
                    <td>
                      <b>{t.points}</b>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}
