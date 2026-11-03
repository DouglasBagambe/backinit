"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { z } from "zod";
import { standingSchema, entityHref, type SportEvent } from "@backinit/domain";
const schema = z.object({
  value: z.object({
    rows: z.array(standingSchema.extend({ rank: z.number() })),
    season: z.string().optional(),
    provider: z.string(),
    url: z.string().url(),
  }),
  fetchedAt: z.string(),
  stale: z.boolean(),
});
export function useLeagueStandings(events: SportEvent[]) {
  const league = events
    .map(
      (e) =>
        e.source?.provider.match(
          /^ESPN:soccer\/(eng\.1|esp\.1|ger\.1|ita\.1|fra\.1|ned\.1|por\.1)$/,
        )?.[1],
    )
    .find(Boolean);
  const [data, setData] = useState<z.infer<typeof schema> | null>(null);
  useEffect(() => {
    setData(null);
    if (!league) return;
    const c = new AbortController();
    fetch(`/api/standings?league=${league}`, {
      signal: AbortSignal.any([c.signal, AbortSignal.timeout(12000)]),
    })
      .then((r) => {
        if (!r.ok) throw Error();
        return r.json();
      })
      .then((raw) => {
        const next = schema.parse(raw);
        if (!c.signal.aborted) setData(next);
      })
      .catch(() => {});
    return () => c.abort();
  }, [league]);
  return data;
}
export function LeagueStandings({
  data,
  highlight = [],
}: {
  data: NonNullable<ReturnType<typeof useLeagueStandings>>;
  highlight?: string[];
}) {
  return (
    <section className="panel">
      <div className="section-heading">
        <h2>League standings</h2>
        {data.value.season && <small>{data.value.season}</small>}
      </div>
      <div
        className="table-scroll"
        role="region"
        aria-label="League standings"
        tabIndex={0}
      >
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Team</th>
              <th>P</th>
              <th>W</th>
              <th>D</th>
              <th>L</th>
              <th>GD</th>
              <th>Pts</th>
            </tr>
          </thead>
          <tbody>
            {data.value.rows.map((t) => (
              <tr
                className={highlight.includes(t.team) ? "highlight-row" : ""}
                key={t.team}
              >
                <td>{t.rank}</td>
                <th scope="row">
                  <Link href={entityHref("team", t.team, "Football")}>
                    {t.team}
                  </Link>
                </th>
                <td>{t.played}</td>
                <td>{t.won}</td>
                <td>{t.drawn}</td>
                <td>{t.lost}</td>
                <td>{t.goalsFor - t.goalsAgainst}</td>
                <td>
                  <b>{t.points}</b>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <small className="fine">
        {data.stale ? "Last available table" : "Updated table"} ·{" "}
        <a href={data.value.url} target="_blank" rel="noreferrer">
          {data.value.provider} ↗
        </a>
      </small>
    </section>
  );
}
