"use client";
import { useEntitySearch } from "./entity-suggestions";
import { LeagueStandings, useLeagueStandings } from "./league-standings";
import { z } from "zod";
import Link from "next/link";
import { athleteProfileSchema } from "../lib/entity-model";
import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import {
  eventTitle,
  eventScore,
  participantKey,
  entityHref,
  eventSchema,
  freshEventFeed,
  type SportEvent,
} from "@backinit/domain";
import { Crest, SportMark } from "./marks";
import { localStart, useViewingZone } from "../lib/viewing-time";
import type { Follow } from "./directory";
export function EntityProfile({
  kind,
  events,
  loading,
  following,
  toggle,
  busy,
}: {
  kind: Follow["kind"];
  events: SportEvent[];
  loading: boolean;
  following: Follow[];
  toggle: (f: Follow) => void;
  busy: boolean;
}) {
  const params = useSearchParams();
  const name = (params.get("name") || "").slice(0, 180);
  const requestedSport = params.get("sport") || "";
  const { zone } = useViewingZone();
  const [retry, setRetry] = useState(0);
  const [profileError, setProfileError] = useState("");
  const [bio, setBio] = useState<ReturnType<
    typeof athleteProfileSchema.parse
  > | null>(null);
  const suppliedId = params.get("pid"),
    suppliedSport = params.get("psport"),
    suppliedLeague = params.get("league");
  const lookup = useEntitySearch(
    (kind === "team" || kind === "athlete") &&
      !(suppliedId && suppliedSport && suppliedLeague)
      ? name
      : "",
    retry,
  );
  const identities = lookup.data.filter(
    (e) =>
      e.kind === kind &&
      (!requestedSport || e.sport === requestedSport) &&
      participantKey(e.name) === participantKey(name),
  );
  const identity = identities.length === 1 ? identities[0] : undefined;
  const sport = requestedSport || identity?.sport || "";
  const pid = suppliedId || identity?.id,
    psport = suppliedSport || identity?.providerSport,
    league = suppliedLeague || identity?.league;
  useEffect(() => {
    setBio(null);
    setProfileError("");
    if (kind !== "athlete" || !name) return;
    const c = new AbortController();
    const load = async () => {
      try {
        if (!pid || !psport || !league) return;
        const r = await fetch(
          `/api/athlete-profile?${new URLSearchParams({ id: pid, sport: psport, league })}`,
          { signal: AbortSignal.any([c.signal, AbortSignal.timeout(12000)]) },
        );
        if (!r.ok) throw Error();
        const next = athleteProfileSchema.parse(await r.json());
        if (participantKey(next.value.name) !== participantKey(name)) return;
        if (!c.signal.aborted) setBio(next);
      } catch {
        if (!c.signal.aborted)
          setProfileError("Player details could not load.");
      }
    };
    void load();
    return () => c.abort();
  }, [name, sport, kind, pid, psport, league, retry]);
  const [tab, setTab] = useState("Overview");
  useEffect(() => setTab("Overview"), [name, kind]);
  const same = (value: string) =>
    participantKey(value) === participantKey(name);
  const relevant = events.filter(
    (e) =>
      (!sport || e.sport === sport) &&
      (kind === "competition"
        ? same(e.competition)
        : (e.kind === "score" && (same(e.home) || same(e.away))) ||
          e.detail?.lineups?.some((t) => t.players.some((p) => same(p.name))) ||
          e.detail?.classification?.some(
            (r) => same(r.driver) || same(r.team),
          ) ||
          (e.kind === "card" && e.bouts.some((b) => b.performers.some(same)))),
  );
  const scheduleTeam =
    kind === "team"
      ? pid && psport && league
        ? { id: pid, providerSport: psport, league, name }
        : null
      : kind === "athlete" && bio?.value.team && psport && league
        ? {
            id: bio.value.team.id,
            providerSport: psport,
            league,
            name: bio.value.team.displayName,
          }
        : null;
  const scheduleTeamId = scheduleTeam?.id;
  const scheduleSport = scheduleTeam?.providerSport;
  const scheduleLeague = scheduleTeam?.league;
  const scheduleName = scheduleTeam?.name;
  const [teamData, setTeamData] = useState<{
    data: SportEvent[];
    players: { id: string; name: string; position?: string; jersey?: string }[];
  } | null>(null);
  useEffect(() => {
    setTeamData(null);
    if (!scheduleTeamId || !scheduleSport || !scheduleLeague) return;
    const c = new AbortController();
    fetch(
      `/api/team-profile?${new URLSearchParams({ id: scheduleTeamId, sport: scheduleSport, league: scheduleLeague })}`,
      { signal: AbortSignal.any([c.signal, AbortSignal.timeout(15000)]) },
    )
      .then((r) => {
        if (!r.ok) throw Error();
        return r.json();
      })
      .then((raw) => {
        const d = z
          .object({
            name: z.string().optional(),
            data: z.array(eventSchema),
            players: z.array(
              z.object({
                id: z.string(),
                name: z.string(),
                position: z.string().optional(),
                jersey: z.string().optional(),
              }),
            ),
          })
          .parse(raw);
        if (
          d.name &&
          participantKey(d.name) !== participantKey(scheduleName || "")
        )
          return;
        if (!c.signal.aborted)
          setTeamData({
            ...d,
            data: freshEventFeed({
              data: d.data,
              edition: "real",
              source: "ESPN",
              coverage: [],
            }).data,
          });
      })
      .catch(() => {
        if (!c.signal.aborted) setProfileError("Team details could not load.");
      });
    return () => c.abort();
  }, [scheduleTeamId, scheduleSport, scheduleLeague, scheduleName, retry]);
  const profileMatches =
    kind === "team" && teamData?.data.length ? teamData.data : relevant;
  const teamFixtures =
    kind === "athlete"
      ? (teamData?.data || [])
          .filter((e) => e.status === "upcoming" || e.status === "live")
          .sort((a, b) => a.start.localeCompare(b.start))
      : [];
  const scheduled = profileMatches
    .filter((e) => e.status === "upcoming" || e.status === "live")
    .sort((a, b) => a.start.localeCompare(b.start));
  const results = profileMatches
    .filter((e) => e.status === "finished")
    .sort((a, b) => b.start.localeCompare(a.start));
  const leagueTable = useLeagueStandings(profileMatches);
  const standings = relevant.find((e) => e.detail?.standings?.length)?.detail
    ?.standings;
  const squad = new Map<string, string>();
  for (const e of relevant)
    for (const t of e.detail?.lineups || [])
      if (same(t.team))
        for (const p of t.players) squad.set(p.name, p.position || "");
  for (const p of teamData?.players || []) squad.set(p.name, p.position || "");
  const tabs = [
    "Overview",
    "Matches",
    ...(leagueTable || standings?.length ? ["Standings"] : []),
    ...(kind === "team" && squad.size ? ["Squad"] : []),
  ];
  const appearances = bio?.value.appearances || [];
  const rows = (items: SportEvent[]) =>
    items.map((e) => (
      <Link className="entity-match" key={e.id} href={`/watch/${e.id}`}>
        <div>
          <small>
            {e.competition} · {localStart(e.start, zone)}
          </small>
          <strong>{eventTitle(e)}</strong>
        </div>
        <b>
          {e.kind === "score" && e.status !== "upcoming"
            ? `${eventScore(e, "home")} – ${eventScore(e, "away")}`
            : e.status === "live"
              ? "Live"
              : "Match centre →"}
        </b>
      </Link>
    ));
  return (
    <section>
      <Link
        className="back-link"
        href={`/${kind === "team" ? "teams" : kind === "athlete" ? "athletes" : "competitions"}`}
      >
        ← Browse{" "}
        {kind === "team"
          ? "teams"
          : kind === "athlete"
            ? "athletes"
            : "competitions"}
      </Link>
      <header className="entity-header panel">
        {bio?.value.image ? (
          <Crest name={name} imageUrl={bio.value.image} />
        ) : (
          <SportMark name={sport} />
        )}
        <div>
          <span className="eyebrow">
            {sport} · {kind}
          </span>
          <h1>{name || "Sport profile"}</h1>
        </div>
        <button
          className="primary-button"
          disabled={busy || !name}
          aria-pressed={following.some(
            (f) => f.kind === kind && f.target === name,
          )}
          onClick={() => toggle({ kind, target: name })}
        >
          {busy
            ? "Loading saved status…"
            : following.some((f) => f.kind === kind && f.target === name)
              ? "Following ✓"
              : "Follow"}
        </button>
      </header>
      <nav className="filter-tabs" aria-label="Profile sections">
        {tabs.map((t) => (
          <button aria-pressed={tab === t} key={t} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </nav>
      {(profileError || lookup.error) && (
        <p role="status">
          {profileError || lookup.error}{" "}
          <button onClick={() => setRetry((n) => n + 1)}>Retry profile</button>
        </p>
      )}
      {bio && (
        <section className="panel athlete-bio">
          <dl>
            {[
              ["Team", bio.value.team?.displayName],
              ["Position", bio.value.position],
              ["Country", bio.value.country],
              ["Age", bio.value.age],
              ["Shirt", bio.value.jersey],
              ["Height", bio.value.height],
              ["Weight", bio.value.weight],
            ]
              .filter(([, value]) => value !== undefined && value !== "")
              .map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>
                    {label === "Team" && bio.value.team ? (
                      <Link
                        href={entityHref(
                          "team",
                          bio.value.team.displayName,
                          sport,
                          {
                            id: bio.value.team.id,
                            providerSport: psport || undefined,
                            league: league || undefined,
                          },
                        )}
                      >
                        {value} →
                      </Link>
                    ) : (
                      value
                    )}
                  </dd>
                </div>
              ))}
          </dl>
          {bio.value.statistics && (
            <>
              <h2>{bio.value.statistics.displayName}</h2>
              <dl>
                {bio.value.statistics.statistics.map((stat) => (
                  <div key={stat.displayName}>
                    <dt>{stat.displayName}</dt>
                    <dd>{stat.displayValue}</dd>
                  </div>
                ))}
              </dl>
            </>
          )}
          <p className="fine">
            {bio.stale ? "Last available profile" : "Player profile"} · ESPN
          </p>
        </section>
      )}
      {kind === "athlete" &&
        teamFixtures.length > 0 &&
        (tab === "Overview" || tab === "Matches") && (
          <section className="panel">
            <h2>{scheduleName} fixtures</h2>
            <p className="fine">
              Team schedule · player participation is confirmed when lineups are
              announced.
            </p>
            {rows(teamFixtures.slice(0, 5))}
          </section>
        )}
      {kind === "athlete" &&
        appearances.length > 0 &&
        (tab === "Overview" || tab === "Matches") && (
          <section className="panel">
            <h2>Recent appearances</h2>
            {appearances.slice(0, tab === "Overview" ? 5 : 50).map((a) => (
              <div key={a.id}>
                <Link className="entity-match" href={`/watch/${a.id}`}>
                  <div>
                    <small>{localStart(a.date, zone)}</small>
                    <strong>
                      {a.team} {a.atVs} {a.opponent}
                    </strong>
                  </div>
                  <b>
                    {a.score} {a.result}
                  </b>
                </Link>
                <p className="fine">
                  {a.statistics
                    .slice(0, 4)
                    .map((s) => `${s.label}: ${s.value}`)
                    .join(" · ")}
                </p>
              </div>
            ))}
          </section>
        )}
      {loading && !relevant.length && !teamData && !bio ? (
        <p role="status">Loading profile…</p>
      ) : (
        <>
          {tab === "Overview" &&
            !(kind === "athlete" && appearances.length > 0) && (
              <>
                <section className="panel">
                  <h2>
                    {kind === "athlete"
                      ? "Upcoming confirmed appearances"
                      : "Next matches"}
                  </h2>
                  {scheduled.length ? (
                    rows(scheduled.slice(0, 5))
                  ) : (
                    <p>No upcoming matches in the current catalogue.</p>
                  )}
                </section>
                <section className="panel">
                  <h2>
                    {kind === "athlete"
                      ? "Recent confirmed appearances"
                      : "Recent results"}
                  </h2>
                  {results.length ? (
                    rows(results.slice(0, 5))
                  ) : (
                    <p>No results in the current catalogue.</p>
                  )}
                </section>
              </>
            )}
          {tab === "Matches" &&
            !(kind === "athlete" && appearances.length > 0) && (
              <section className="panel">
                <h2>
                  {kind === "athlete" ? "Confirmed appearances" : "Matches"}
                </h2>
                {rows([
                  ...scheduled,
                  ...results,
                  ...profileMatches.filter(
                    (e) => !["upcoming", "live", "finished"].includes(e.status),
                  ),
                ])}
                {!profileMatches.length && (
                  <p>No matches in the current catalogue.</p>
                )}
              </section>
            )}
          {tab === "Squad" && (
            <section className="panel">
              <h2>
                {teamData?.players.length
                  ? "Squad"
                  : "Players in reported lineups"}
              </h2>
              <div className="directory-grid">
                {[...squad].map(([player, position]) => (
                  <Link
                    key={player}
                    href={entityHref("athlete", player, sport, {
                      id: teamData?.players.find((p) => p.name === player)?.id,
                      providerSport: psport || undefined,
                      league: league || undefined,
                    })}
                  >
                    <strong>{player}</strong>
                    <small>{position}</small>
                  </Link>
                ))}
              </div>
            </section>
          )}
          {tab === "Standings" && leagueTable && (
            <LeagueStandings data={leagueTable} highlight={[name]} />
          )}
          {tab === "Standings" && !leagueTable && standings && (
            <section className="panel">
              <h2>Standings</h2>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Team</th>
                      <th>P</th>
                      <th>W</th>
                      <th>D</th>
                      <th>L</th>
                      <th>Pts</th>
                    </tr>
                  </thead>
                  <tbody>
                    {standings.map((t, i) => (
                      <tr key={t.team}>
                        <td>{i + 1}</td>
                        <th>{t.team}</th>
                        <td>{t.played}</td>
                        <td>{t.won}</td>
                        <td>{t.drawn}</td>
                        <td>{t.lost}</td>
                        <td>{t.points}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
          <p className="fine">Based on reported match and profile data.</p>
        </>
      )}
    </section>
  );
}
