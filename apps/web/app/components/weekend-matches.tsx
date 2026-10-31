"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronRight } from "lucide-react";
import { feedSchema, type SportEvent } from "@backinit/domain";
import { useSearchParams } from "next/navigation";
import { Crest } from "./marks";
import { localDay, localStart, useViewingZone } from "../lib/viewing-time";

const pick = "espn-soccer-eng-1-401879248";
export function weekendMatches(
  events: SportEvent[],
  now: number,
  zone: string,
) {
  const today = localDay(new Date(now).toISOString(), zone);
  const day = new Date(`${today}T12:00:00Z`).getUTCDay();
  const saturday = new Date(`${today}T12:00:00Z`);
  saturday.setUTCDate(saturday.getUTCDate() + (day === 0 ? -1 : 6 - day));
  const from = saturday.toISOString().slice(0, 10);
  saturday.setUTCDate(saturday.getUTCDate() + 1);
  const to = saturday.toISOString().slice(0, 10);
  return events
    .filter((event) => {
      const date = localDay(event.start, zone);
      return (
        event.kind === "score" &&
        event.sport === "Football" &&
        event.provenance === "provider" &&
        ["upcoming", "live"].includes(event.status) &&
        date >= from &&
        date <= to &&
        (event.status === "live" || Date.parse(event.start) >= now) &&
        !event.source?.stale
      );
    })
    .sort(
      (a, b) =>
        Number(b.id === pick) - Number(a.id === pick) ||
        Number(b.status === "live") - Number(a.status === "live") ||
        a.start.localeCompare(b.start),
    );
}

export function WeekendMatches({
  initialEvents,
  poll = false,
}: {
  initialEvents: SportEvent[];
  poll?: boolean;
}) {
  const [events, setEvents] = useState(initialEvents);
  const [now, setNow] = useState(() => Date.now());
  const { zone } = useViewingZone();
  const params = useSearchParams();
  useEffect(() => setEvents(initialEvents), [initialEvents]);
  useEffect(() => {
    const controller = new AbortController();
    let running = false;
    const refresh = async () => {
      setNow(Date.now());
      if (!poll || running || document.hidden) return;
      running = true;
      try {
        const response = await fetch("/api/events", {
          signal: AbortSignal.any([
            controller.signal,
            AbortSignal.timeout(25000),
          ]),
        });
        if (!response.ok) return;
        const feed = feedSchema.parse(await response.json());
        if (!controller.signal.aborted && feed.edition === "real")
          setEvents(feed.data);
      } catch {
        /* Preserve the last confirmed fixture snapshot during a short outage. */
      } finally {
        running = false;
      }
    };
    const timer = setInterval(() => void refresh(), 30000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      controller.abort();
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [poll]);
  const sport = params.get("sport");
  if (
    (sport && sport !== "Football" && sport !== "All sports") ||
    params.get("date") ||
    params.get("q") ||
    params.get("range") === "live"
  )
    return null;
  const matches = weekendMatches(events, now, zone);
  if (!matches.length) return null;
  return (
    <section className="weekend-matches" aria-label="Weekend football">
      <div className="section-heading">
        <h2>This weekend</h2>
        <Link href="/sport/football">
          All football <ChevronRight size={14} />
        </Link>
      </div>
      <div className="weekend-match-grid">
        {matches.slice(0, 4).map(
          (event) =>
            event.kind === "score" && (
              <Link
                href={`/watch/${event.id}`}
                key={event.id}
                className={`weekend-match${event.id === pick ? " weekend-match-pick" : ""}`}
              >
                <div className="weekend-match-heading">
                  <span>
                    {event.id === pick ? "Match of the day" : event.competition}
                  </span>
                  <span>
                    {event.status === "live"
                      ? "LIVE"
                      : localStart(event.start, zone)}
                  </span>
                </div>
                <div className="weekend-match-team">
                  <Crest
                    name={event.home}
                    imageUrl={event.homeParticipant?.imageUrl}
                  />
                  <strong>{event.home}</strong>
                  <b>{event.homeScore ?? ""}</b>
                </div>
                <div className="weekend-match-team">
                  <Crest
                    name={event.away}
                    imageUrl={event.awayParticipant?.imageUrl}
                  />
                  <strong>{event.away}</strong>
                  <b>{event.awayScore ?? ""}</b>
                </div>
                <div className="weekend-match-footer">
                  <span>Match centre & viewing options</span>
                  <ChevronRight size={15} />
                </div>
              </Link>
            ),
        )}
      </div>
      <p className="weekend-match-note">
        {matches.length} upcoming or live football matches · {zone}
      </p>
    </section>
  );
}
