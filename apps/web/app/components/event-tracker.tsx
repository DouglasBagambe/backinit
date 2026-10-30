"use client";
import { eventTitle, type SportEvent } from "@backinit/domain";
import { Crest, SportMark } from "./marks";

/** A diagram and reported events, never simulated possession or ball coordinates. */
export function EventTracker({
  event,
  compact = false,
}: {
  event: SportEvent;
  compact?: boolean;
}) {
  const timeline = event.detail?.timeline || [];
  const goal = event.detail?.goals?.at(-1);
  const latest = timeline.at(-1);
  const sets = event.sport === "Tennis" ? event.detail?.periods || [] : [];
  const currentSet = sets.at(-1);
  const status = event.source?.stale
    ? "Last update"
    : event.status === "live"
      ? event.kind === "score"
        ? event.clock || "Live"
        : "Live"
      : event.status === "finished"
        ? "Full time"
        : event.status === "upcoming"
          ? "Upcoming"
          : "Awaiting updates";
  const report = latest
    ? { clock: latest.clock, text: latest.text }
    : goal
      ? {
          clock: goal.minute === null ? "Goal" : `${goal.minute}′`,
          text: `${goal.player || goal.team || "Goal"} · ${goal.homeScore}–${goal.awayScore}`,
        }
      : null;
  const revision = `${event.status}:${event.kind === "score" ? `${event.homeScore}:${event.awayScore}` : ""}:${report?.text || ""}:${currentSet?.home}:${currentSet?.away}`;
  return (
    <section
      className={`event-tracker${compact ? " tracker-compact" : ""}`}
      aria-label="Match tracker"
    >
      <header className="tracker-heading">
        <span>
          <SportMark name={event.sport} /> Match tracker
        </span>
        <span className="tracker-clock">{status}</span>
      </header>
      <div className="tracker-arena">
        <Arena sport={event.sport} />
        <div className="tracker-scoreboard" key={revision}>
          {event.kind === "score" ? (
            <>
              <div className="tracker-team">
                <Crest
                  name={event.home}
                  imageUrl={event.homeParticipant?.imageUrl}
                />
                <span>{event.home}</span>
              </div>
              <div className="tracker-score-group">
                {currentSet && <small>{currentSet.label} · Games</small>}
                <strong className="tracker-score">
                  {currentSet ? currentSet.home : (event.homeScore ?? "–")}
                  <span>:</span>
                  {currentSet ? currentSet.away : (event.awayScore ?? "–")}
                </strong>
              </div>
              <div className="tracker-team">
                <Crest
                  name={event.away}
                  imageUrl={event.awayParticipant?.imageUrl}
                />
                <span>{event.away}</span>
              </div>
            </>
          ) : (
            <strong className="tracker-event-title">{eventTitle(event)}</strong>
          )}
        </div>
      </div>
      {sets.length > 0 && event.kind === "score" && (
        <div
          className="tracker-sets"
          role="region"
          aria-label="Set scores"
          tabIndex={0}
        >
          <table>
            <thead>
              <tr>
                <th scope="col">Player</th>
                {sets.map((set, i) => (
                  <th scope="col" key={i}>
                    {set.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">{event.home}</th>
                {sets.map((set, i) => (
                  <td key={i}>{set.home}</td>
                ))}
              </tr>
              <tr>
                <th scope="row">{event.away}</th>
                {sets.map((set, i) => (
                  <td key={i}>{set.away}</td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}
      {(!sets.length || report) && (
        <div
          className="tracker-report"
          aria-live="polite"
          aria-atomic="true"
          key={report?.text || "pending"}
        >
          {report ? (
            <>
              <b>{report.clock}</b>
              <span>{report.text}</span>
            </>
          ) : (
            <span>
              {event.status === "upcoming"
                ? "Match updates appear when reported."
                : "No match events reported."}
            </span>
          )}
        </div>
      )}
      {!!event.detail?.statistics?.length && (
        <div className="tracker-stats">
          {event.detail.statistics.slice(0, compact ? 2 : 3).map((row, i) => (
            <div key={`${row.label}-${i}`}>
              <b>{row.home}</b>
              <span>{row.label}</span>
              <b>{row.away}</b>
            </div>
          ))}
        </div>
      )}
      <details className="tracker-information">
        <summary>Data information</summary>
        <p>
          Reported scores and events. Live ball positioning is not supplied for
          this match.
        </p>
        {event.source && (
          <p>
            {event.source.stale ? "Stale snapshot" : "Updated"}{" "}
            <time dateTime={event.source.fetchedAt}>
              {new Date(event.source.fetchedAt).toLocaleTimeString("en-GB", {
                timeZone: "UTC",
              })}{" "}
              UTC
            </time>{" "}
            ·{" "}
            <a href={event.source.url} target="_blank" rel="noreferrer">
              {event.source.provider} ↗
            </a>
          </p>
        )}
      </details>
    </section>
  );
}

function Arena({ sport }: { sport: string }) {
  const court = sport === "Tennis" || sport === "Badminton";
  const ring = sport === "WWE" || sport === "MMA";
  return (
    <svg
      className={`tracker-field field-${sport.toLowerCase().replaceAll(" ", "-")}`}
      viewBox="0 0 600 340"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <rect
        width="600"
        height="340"
        rx="12"
        fill="currentColor"
        stroke="none"
      />
      <g fill="none" stroke="white" strokeWidth="2" opacity=".34">
        {sport === "Formula 1" ? (
          <>
            <rect
              x="70"
              y="55"
              width="460"
              height="230"
              rx="110"
              strokeWidth="12"
            />
            <rect x="95" y="80" width="410" height="180" rx="85" />
            <path d="M300 45v45" strokeDasharray="5 5" strokeWidth="10" />
          </>
        ) : ring ? (
          <>
            <rect
              x="100"
              y="45"
              width="400"
              height="250"
              rx={sport === "MMA" ? 85 : 0}
            />
            <rect
              x="112"
              y="57"
              width="376"
              height="226"
              rx={sport === "MMA" ? 75 : 0}
            />
          </>
        ) : sport === "Baseball" ? (
          <>
            <path d="M300 290 140 130Q300-30 460 130Z" />
            <path d="m300 275-90-90 90-90 90 90Z" />
            <circle cx="300" cy="185" r="12" />
          </>
        ) : sport === "Cricket" ? (
          <>
            <ellipse cx="300" cy="170" rx="265" ry="145" />
            <path d="M270 115h60v110h-60zM260 130h80M260 210h80" />
          </>
        ) : (
          <>
            <rect
              x="28"
              y="24"
              width="544"
              height="292"
              rx={sport === "Ice hockey" ? 65 : 0}
            />
            <path d="M300 24v292" />
            {court ? (
              <>
                <path d="M28 62h544M28 278h544M164 62v216M436 62v216M164 170h272" />
                <path d="M300 20v300" strokeDasharray="4 4" strokeWidth="4" />
              </>
            ) : sport === "Basketball" ? (
              <>
                <circle cx="300" cy="170" r="42" />
                <path d="M28 102h98v136H28M572 102h-98v136h98M28 57a130 130 0 0 1 0 226M572 57a130 130 0 0 0 0 226" />
                <circle cx="62" cy="170" r="9" />
                <circle cx="538" cy="170" r="9" />
              </>
            ) : sport === "Ice hockey" ? (
              <>
                <circle cx="300" cy="170" r="43" />
                <path d="M180 24v292M420 24v292" />
                <circle cx="110" cy="95" r="28" />
                <circle cx="490" cy="245" r="28" />
              </>
            ) : sport === "American football" || sport === "Rugby" ? (
              <>
                <path
                  d="M90 24v292M150 24v292M210 24v292M390 24v292M450 24v292M510 24v292"
                  strokeDasharray={sport === "Rugby" ? "8 8" : undefined}
                />
              </>
            ) : (
              <>
                <circle cx="300" cy="170" r="48" />
                <path d="M28 88h88v164H28M572 88h-88v164h88M28 128h34v84H28M572 128h-34v84h34" />
                <circle cx="300" cy="170" r="3" fill="white" />
              </>
            )}
          </>
        )}
      </g>
    </svg>
  );
}
