import Link from "next/link";
import { WatchHub } from "./watch-hub";
import { ArrowUpRight, Globe2 } from "lucide-react";
import type { NewsFeed } from "@backinit/domain";
export function News({
  compact = false,
  feed,
  real = false,
}: {
  compact?: boolean;
  feed?: NewsFeed | null;
  real?: boolean;
}) {
  return (
    <section className="news-section">
      {real && !compact && <WatchHub preview />}
      {real && !compact && !feed?.data.length && <p>No articles available.</p>}
      {feed && (!real || feed.data.length > 0) && (
        <>
          <div className="section-heading">
            <h2>Latest news</h2>
            <span className="pill">{feed.status}</span>
          </div>
          <details>
            <summary>News coverage</summary>
            <p>{feed.message}</p>
          </details>
          {feed.data.length > 0 && (
            <div className="news-grid">
              {feed.data.slice(0, compact ? 3 : 24).map((item) => (
                <a
                  className="news-card panel"
                  key={item.url}
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  <span className="eyebrow">
                    {item.category} ·{" "}
                    {feed.status === "stale" ? "STALE SNAPSHOT" : "NEWS"}
                  </span>
                  <h3>{item.title}</h3>
                  <p>
                    {item.source} ·{" "}
                    <time dateTime={item.publishedAt}>
                      {new Date(item.publishedAt).toLocaleString("en-GB", {
                        timeZone: "UTC",
                      })}{" "}
                      UTC
                    </time>
                  </p>
                  <small>Read original reporting ↗</small>
                </a>
              ))}
            </div>
          )}
        </>
      )}
      {!real && (
        <>
          <div className="section-heading">
            <h2>{compact ? "Inside the experience" : "The reading room"}</h2>
            <span className="pill">BACKINIT GUIDES</span>
          </div>
          <div className="news-grid">
            {[
              {
                n: "01",
                tag: "MATCHDAY",
                title: "The story behind the scoreboard",
                body: real
                  ? "Explore reported goals and results in the Match Centre."
                  : "Explore event replay and a statistical snapshot in our demo Match Centre.",
                href: real ? "/scores" : "/match/north-london",
              },
              {
                n: "02",
                tag: "WATCH",
                title: "Your screen. Your front row.",
                body: "Try integrated HLS playback with a clearly labeled open-movie test source.",
                href: "/watch",
              },
              {
                n: "03",
                tag: "YOUR WORLD",
                title: "Sport feels better when it’s yours.",
                body: "Keep favorite events close, with no account required.",
                href: "/favorites",
              },
            ].map((a) => (
              <Link href={a.href} className="news-card" key={a.n}>
                <div className="news-graphic" aria-hidden="true">
                  <span>{a.n}</span>
                  <ArrowUpRight size={25} />
                </div>
                <span className="eyebrow">{a.tag}</span>
                <h3>{a.title}</h3>
                <p>{a.body}</p>
                <small>BackInIt · Product guide</small>
              </Link>
            ))}
          </div>
        </>
      )}
      {!compact && !real && (
        <div className="availability">
          <Globe2 />
          <p>
            These BackInIt guides explain the product. Publisher headlines, when
            licensed and configured, appear separately with attribution and
            original links.
          </p>
        </div>
      )}
    </section>
  );
}
