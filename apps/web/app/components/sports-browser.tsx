"use client";
import { EntitySuggestions } from "./entity-suggestions";
import Link from "next/link";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  eventTitle,
  eventScore,
  isMediaEvent,
  sports,
  type SportEvent,
} from "@backinit/domain";
import { Crest, SportMark } from "./marks";
import { localDay, localStart, useViewingZone } from "../lib/viewing-time";
export function SportsBrowser({
  route,
  events,
  loading,
  favorite,
}: {
  route: string;
  events: SportEvent[];
  loading: boolean;
  favorite: (e: SportEvent) => React.ReactNode;
}) {
  const params = useSearchParams();
  const router = useRouter();
  const { zone } = useViewingZone();
  const [limit, setLimit] = useState(60);
  const today = localDay(new Date().toISOString(), zone);
  const date = params.get("date") || today;
  const status =
    params.get("status") ||
    (route === "live" ? "live" : route === "scores" ? "finished" : "all");
  const sport = route.startsWith("sport/")
    ? sports.find(
        (s) => s.toLowerCase().replaceAll(" ", "-") === route.slice(6),
      ) || ""
    : params.get("sport") || "";
  const query = params.get("q") || "";
  function change(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    value ? next.set(key, value) : next.delete(key);
    setLimit(60);
    router.replace(`/${route}?${next}`, { scroll: false });
  }
  const filtered = events
    .filter(
      (e) =>
        !isMediaEvent(e) &&
        (!sport || e.sport === sport) &&
        (status === "all" || e.status === status) &&
        (status === "live" || localDay(e.start, zone) === date) &&
        `${eventTitle(e)} ${e.competition}`
          .toLowerCase()
          .includes(query.toLowerCase()),
    )
    .sort(
      (a, b) =>
        Number(b.status === "live") - Number(a.status === "live") ||
        a.start.localeCompare(b.start),
    );
  const groups = new Map<string, SportEvent[]>();
  for (const e of filtered.slice(0, limit)) {
    const key = `${e.sport} · ${e.competition}`;
    groups.set(key, [...(groups.get(key) || []), e]);
  }
  return (
    <section className="sports-browser">
      <header className="page-heading">
        <div>
          <span className="eyebrow">Your matchday</span>
          <h1>
            {route === "live"
              ? "Live sport"
              : route === "scores"
                ? "Scores"
                : route === "fixtures"
                  ? "Fixtures"
                  : sport}
          </h1>
        </div>
        <Link
          className="primary-button"
          href={`/watch${sport ? `?sport=${encodeURIComponent(sport)}` : ""}`}
        >
          Watch →
        </Link>
      </header>
      <div className="sports-browser-toolbar">
        <label>
          Date
          <input
            type="date"
            value={date}
            onChange={(e) => change("date", e.target.value)}
          />
        </label>
        {!route.startsWith("sport/") && (
          <label>
            Sport
            <select
              value={sport}
              onChange={(e) => change("sport", e.target.value)}
            >
              <option value="">All sports</option>
              {sports.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
        )}
        <label className="sports-search">
          Search
          <input
            value={query}
            placeholder="Filter matches or find a team or player"
            onChange={(e) => change("q", e.target.value)}
          />
        </label>
      </div>
      <div className="filter-tabs" role="group" aria-label="Match status">
        {[
          ["all", "All"],
          ["live", "Live now"],
          ["upcoming", "Upcoming"],
          ["finished", "Results"],
        ].map(([value, label]) => (
          <button
            key={value}
            aria-pressed={status === value}
            onClick={() => change("status", value!)}
          >
            {label}
          </button>
        ))}
      </div>
      <EntitySuggestions query={query} sport={sport} />
      <p className="fine">
        {filtered.length} matches · {zone}
      </p>
      {loading && !filtered.length ? (
        <p role="status">Loading matches…</p>
      ) : !filtered.length ? (
        <div className="panel">
          <h2>
            {query
              ? "No matching games on this date"
              : "No matches in this view"}
          </h2>
          <p>Try another date, sport or match status.</p>
          <Link
            href={`/watch${sport ? `?sport=${encodeURIComponent(sport)}` : ""}`}
          >
            Browse streams & trackers →
          </Link>
        </div>
      ) : (
        [...groups].map(([name, matches]) => (
          <section className="sports-competition panel" key={name}>
            <h2>
              <SportMark name={matches[0]!.sport} />
              {name}
            </h2>
            {matches.map((e) => (
              <div className="match-row" key={e.id}>
                <div
                  className={`match-time ${e.status === "live" ? "live" : ""}`}
                >
                  <time dateTime={e.start}>
                    {localStart(e.start, zone, false)}
                  </time>
                  <small>
                    {e.status === "finished"
                      ? "FT"
                      : e.status === "live"
                        ? e.kind === "score"
                          ? e.clock
                          : "Live"
                        : e.status === "upcoming"
                          ? "Scheduled"
                          : e.status}
                  </small>
                </div>
                <Link className="match-teams" href={`/watch/${e.id}`}>
                  {e.kind === "score" ? (
                    <>
                      {(["home", "away"] as const).map((side) => (
                        <span key={side}>
                          <Crest
                            name={e[side]}
                            imageUrl={
                              side === "home"
                                ? e.homeParticipant?.imageUrl
                                : e.awayParticipant?.imageUrl
                            }
                          />
                          <span className="team-name">{e[side]}</span>
                          <b>{eventScore(e, side)}</b>
                        </span>
                      ))}
                    </>
                  ) : (
                    <strong>{eventTitle(e)}</strong>
                  )}
                </Link>
                {favorite(e)}
              </div>
            ))}
          </section>
        ))
      )}
      {filtered.length > limit && (
        <button onClick={() => setLimit((n) => n + 60)}>
          Show more matches
        </button>
      )}
    </section>
  );
}
