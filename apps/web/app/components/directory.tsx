"use client";
import Link from "next/link";
import { useState } from "react";
import { Star } from "lucide-react";
import type { SportEvent } from "@backinit/domain";
export type Follow = {
  kind: "team" | "athlete" | "competition" | "sport";
  target: string;
};
export function Directory({
  route,
  events,
  following,
  toggle,
}: {
  route: string;
  events: SportEvent[];
  following: Follow[];
  toggle: (item: Follow) => void;
}) {
  const [query, setQuery] = useState("");
  const kind =
    route === "teams"
      ? "team"
      : route === "athletes"
        ? "athlete"
        : "competition";
  const names = Array.from(
    new Set(
      events.flatMap((e) =>
        kind === "competition"
          ? [e.competition]
          : kind === "team"
            ? e.kind === "score"
              ? [e.home, e.away]
              : (e.detail?.classification || []).map((r) => r.team)
            : [
                ...(e.detail?.goals || []).flatMap((g) =>
                  g.player ? [g.player] : [],
                ),
                ...(e.detail?.classification || []).map((r) => r.driver),
                ...(e.kind === "card"
                  ? e.bouts.flatMap((b) => b.performers)
                  : []),
              ],
      ),
    ),
  ).sort();
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">YOUR WORLD OF SPORT</span>
          <h1>Explore {route}.</h1>
          <p>
            Participants and competitions reported by the selected feed.
            Profiles and career statistics are not yet available.
          </p>
        </div>
      </div>
      <label className="search-input">
        <input
          aria-label={`Search ${route}`}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Find ${route}…`}
        />
      </label>
      <div className="directory-grid">
        {names
          .filter((n) => n.toLowerCase().includes(query.toLowerCase()))
          .map((name) => {
            const saved = following.some(
              (f) => f.kind === kind && f.target === name,
            );
            return (
              <article className="panel directory-card" key={name}>
                <div>
                  <span className="eyebrow">{kind}</span>
                  <h2>{name}</h2>
                  <Link href={`/search?q=${encodeURIComponent(name)}`}>
                    Related events ↗
                  </Link>
                </div>
                <button
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
      {names.length === 0 && (
        <section className="panel">
          <p>No verified {route} are available in this feed.</p>
        </section>
      )}
    </>
  );
}
