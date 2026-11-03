"use client";
import { useState, useEffect } from "react";
import { type RemoteEntity } from "../lib/entity-model";
import { useEntitySearch } from "./entity-suggestions";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  eventTitle,
  sportsEntities,
  entityHref,
  isMediaEvent,
  type SportEvent,
  type SportsEntity,
} from "@backinit/domain";
import { Crest } from "./marks";
export function SportsSearch({
  events,
  loading,
}: {
  events: SportEvent[];
  loading: boolean;
}) {
  const params = useSearchParams();
  const router = useRouter();
  const [visible, setVisible] = useState(12);
  const [query, setQuery] = useState(params.get("q") || "");
  const [revision, setRevision] = useState(0);
  const { data: remote, pending, error } = useEntitySearch(query, revision);
  const urlQuery = params.get("q") || "";
  useEffect(() => setQuery(urlQuery), [urlQuery]);
  useEffect(() => {
    setVisible(12);
    const timer = setTimeout(
      () =>
        window.history.replaceState(
          null,
          "",
          query.trim()
            ? `/search?${new URLSearchParams({ q: query.trim().slice(0, 80) })}`
            : "/search",
        ),
      300,
    );
    return () => clearTimeout(timer);
  }, [query]);
  const key = query.trim().toLowerCase();
  const local = sportsEntities(events).filter((e) =>
    e.name.toLowerCase().includes(key),
  );
  const entities: (RemoteEntity | SportsEntity)[] = [
    ...remote,
    ...local.filter(
      (e) =>
        !remote.some(
          (r) =>
            r.kind === e.kind &&
            r.sport === e.sport &&
            r.name.toLowerCase() === e.name.toLowerCase(),
        ),
    ),
  ];
  const matches = events
    .filter(
      (e) =>
        !isMediaEvent(e) &&
        `${eventTitle(e)} ${e.competition}`.toLowerCase().includes(key),
    )
    .sort(
      (a, b) =>
        Number(b.status === "live") - Number(a.status === "live") ||
        b.start.localeCompare(a.start),
    );
  return (
    <section className="sports-search-page">
      <div className="page-heading">
        <h1>Search sport</h1>
      </div>
      <label className="search-input">
        <input
          autoFocus
          aria-label="Search sport"
          placeholder="Teams, players, competitions or matches"
          value={query}
          maxLength={80}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
      {!key ? (
        <div className="panel">
          <h2>Find your sport</h2>
          <p>Search for a team, athlete, competition or match.</p>
          <div className="filter-tabs">
            <Link href="/teams">Teams →</Link>
            <Link href="/athletes">Athletes →</Link>
            <Link href="/competitions">Competitions →</Link>
          </div>
        </div>
      ) : (loading || pending) && !entities.length && !matches.length ? (
        <p role="status">Searching sport…</p>
      ) : (
        <>
          {(
            [
              ["team", "Teams"],
              ["athlete", "Athletes"],
              ["competition", "Competitions"],
            ] as const
          ).map(([kind, label]) => {
            const items = entities.filter((e) => e.kind === kind);
            return (
              items.length > 0 && (
                <section className="panel" key={kind}>
                  <h2>
                    {label} <small>({items.length})</small>
                  </h2>
                  <div className="search-entity-grid">
                    {items.slice(0, visible).map((e) => (
                      <Link
                        key={e.sport + e.name + ("id" in e ? e.id : "")}
                        href={entityHref(e.kind, e.name, e.sport, e)}
                      >
                        <Crest name={e.name} imageUrl={e.image} />
                        <span>
                          <strong>{e.name}</strong>
                          <small>
                            {e.sport}
                            {"league" in e
                              ? ` · ${(e.league || "").toUpperCase()}`
                              : ""}
                          </small>
                        </span>
                      </Link>
                    ))}
                  </div>
                </section>
              )
            );
          })}
          {matches.length > 0 && (
            <section className="panel">
              <h2>Matches ({matches.length})</h2>
              {matches.slice(0, visible * 3).map((e) => (
                <Link
                  className="entity-match"
                  key={e.id}
                  href={`/watch/${e.id}`}
                >
                  <div>
                    <small>
                      {e.sport} · {e.competition}
                    </small>
                    <strong>{eventTitle(e)}</strong>
                  </div>
                  <span>
                    {e.status === "live"
                      ? "Live"
                      : e.status === "finished"
                        ? "Result"
                        : e.status === "upcoming"
                          ? "Upcoming"
                          : e.status === "unknown"
                            ? "Updates pending"
                            : e.status}{" "}
                    →
                  </span>
                </Link>
              ))}
            </section>
          )}
          {(matches.length > visible * 3 ||
            ["team", "athlete", "competition"].some(
              (kind) =>
                entities.filter((e) => e.kind === kind).length > visible,
            )) && (
            <button onClick={() => setVisible((n) => n + 12)}>
              Show more results
            </button>
          )}
          {pending && <p role="status">Searching players and teams…</p>}
          {error && (
            <p role="status">
              {error}{" "}
              <button onClick={() => setRevision((n) => n + 1)}>
                Retry search
              </button>
            </p>
          )}
          {!pending && !error && !entities.length && !matches.length && (
            <div className="panel">
              <h2>No results for “{query}”</h2>
              <p>Try a shorter name or a competition.</p>
            </div>
          )}
        </>
      )}
    </section>
  );
}
