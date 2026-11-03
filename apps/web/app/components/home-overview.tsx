"use client";
import Link from "next/link";
import {
  eventTitle,
  eventScore,
  isMediaEvent,
  type SportEvent,
  type NewsFeed,
} from "@backinit/domain";
import { HomeBroadcasts } from "./broadcasts";
import { News } from "./news";
import { AdSlot } from "./advertising";
import { localStart, useViewingZone } from "../lib/viewing-time";
export function HomeOverview({
  events,
  news,
  loading,
}: {
  events: SportEvent[];
  news: NewsFeed | null;
  loading: boolean;
}) {
  const { zone } = useViewingZone();
  const live = events
    .filter((e) => !isMediaEvent(e) && e.status === "live")
    .slice(0, 6);
  const results = events
    .filter((e) => !isMediaEvent(e) && e.status === "finished")
    .sort((a, b) => b.start.localeCompare(a.start))
    .slice(0, 6);
  return (
    <div className="home-overview">
      <header className="home-welcome">
        <div>
          <span className="eyebrow">Every moment matters</span>
          <h1>
            Your sport.
            <br />
            All in one place.
          </h1>
          <p>
            Live streams, scores and match centres. Follow the action your way.
          </p>
        </div>
        <Link className="primary-button" href="/watch">
          Explore Watch →
        </Link>
      </header>
      <HomeBroadcasts />
      {live.length > 0 && (
        <section>
          <div className="section-heading">
            <h2>Live now</h2>
            <Link href="/live">All live sport →</Link>
          </div>
          <div className="home-match-grid">
            {live.map((e) => (
              <Link className="panel" href={`/watch/${e.id}`} key={e.id}>
                <small>
                  {e.sport} · {e.competition}
                </small>
                <h3>{eventTitle(e)}</h3>
                <strong className="live">
                  {e.kind === "score"
                    ? `${eventScore(e, "home")} – ${eventScore(e, "away")}`
                    : "Live"}
                </strong>
              </Link>
            ))}
          </div>
        </section>
      )}
      <AdSlot native />
      {loading && !events.length && <p role="status">Loading sport…</p>}
      {results.length > 0 && (
        <section>
          <div className="section-heading">
            <h2>Latest results</h2>
            <Link href="/scores">All scores →</Link>
          </div>
          <div className="home-match-grid">
            {results.map((e) => (
              <Link className="panel" key={e.id} href={`/watch/${e.id}`}>
                <small>
                  {e.competition} · {localStart(e.start, zone)}
                </small>
                <h3>{eventTitle(e)}</h3>
                {e.kind === "score" && (
                  <strong>
                    {eventScore(e, "home")} – {eventScore(e, "away")}
                  </strong>
                )}
              </Link>
            ))}
          </div>
        </section>
      )}
      <div className="section-heading">
        <h2>Sports news</h2>
        <Link href="/news">All news →</Link>
      </div>
      <News compact real feed={news} />
    </div>
  );
}
