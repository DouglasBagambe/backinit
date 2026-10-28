"use client";
import { useState } from "react";
import type { SportEvent } from "@backinit/domain";
import { LazyPlayer as Player } from "./lazy-player";
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
  const goals = event.detail?.goals || [];
  const [index, setIndex] = useState(0);
  const current = goals[index];
  const detail = event.detail;
  const rows = tab === "Statistics" ? detail?.statistics : detail?.periods;
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
        {detail.lineups.map((team) => (
          <div key={team.team}>
            <h3>{team.team}</h3>
            {team.players.map((p, i) => (
              <p key={`${p.name}-${i}`}>
                {p.name}
                {p.position ? ` · ${p.position}` : ""}
                {p.starter === true ? " · Starter" : ""}
              </p>
            ))}
          </div>
        ))}
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
        <p>{event.detail?.round || "Detailed event data is not connected."}</p>
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
        <p>Detailed match data unavailable.</p>
      </section>
    );
  if (event.scheduleOnly && tab !== "Overview")
    return (
      <Empty
        title={`${tab} not connected for this fixture.`}
        text="Schedule only."
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
        {(tab === "Overview" || tab === "Tracker") && (
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
      {(tab === "Overview" || tab === "Timeline") && (
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
