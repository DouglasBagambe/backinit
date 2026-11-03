"use client";
import { EntitySuggestions } from "./entity-suggestions";
import Link from "next/link";
import { useState } from "react";
import { Star } from "lucide-react";
import { Crest } from "./marks";
import { sportsEntities, entityHref, type SportEvent } from "@backinit/domain";
export type Follow = {
  kind: "team" | "athlete" | "competition" | "sport";
  target: string;
};
export function Directory({
  route,
  events,
  following,
  toggle,
  busy,
  loading = false,
}: {
  route: string;
  events: SportEvent[];
  following: Follow[];
  toggle: (item: Follow) => void;
  busy: boolean;
  loading?: boolean;
}) {
  const [query, setQuery] = useState("");
  const kind =
    route === "teams"
      ? "team"
      : route === "athletes"
        ? "athlete"
        : "competition";
  const [limit, setLimit] = useState(48);
  const entries = sportsEntities(events).filter(
    (e) =>
      e.kind === kind &&
      `${e.name} ${e.sport}`.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>{route[0]!.toUpperCase() + route.slice(1)}</h1>
        </div>
      </div>
      <label className="search-input">
        <input
          aria-label={`Search ${route}`}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setLimit(48);
          }}
          placeholder={`Find ${route}…`}
        />
      </label>
      <EntitySuggestions query={query} kind={kind} />
      <div className="directory-grid">
        {entries.slice(0, limit).map((entity) => {
          const name = entity.name;
          const saved = following.some(
            (f) => f.kind === kind && f.target === name,
          );
          return (
            <article className="panel directory-card" key={entity.sport + name}>
              <div>
                <span className="eyebrow">
                  {entity.sport} · {kind}
                </span>
                <h2>
                  {(kind === "team" || kind === "athlete") && (
                    <Crest name={name} imageUrl={entity.image} />
                  )}{" "}
                  {name}
                </h2>
                <Link href={entityHref(kind, name, entity.sport, entity)}>
                  View profile →
                </Link>
              </div>
              <button
                disabled={busy}
                className="icon-button"
                aria-label={`${saved ? "Unfollow" : "Follow"} ${name}`}
                aria-pressed={saved}
                onClick={() => toggle({ kind, target: name })}
              >
                <Star size={18} fill={saved ? "currentColor" : "none"} />
              </button>
            </article>
          );
        })}
      </div>
      {entries.length > limit && (
        <button onClick={() => setLimit((n) => n + 48)}>Show more</button>
      )}
      {entries.length === 0 && query.trim().length < 2 && (
        <section className="panel">
          <p>
            {loading && !events.length
              ? "Loading sport directory…"
              : query
                ? `No matching ${route} in the loaded match catalogue.`
                : `No ${route} in the current catalogue.`}
          </p>
        </section>
      )}
    </>
  );
}
