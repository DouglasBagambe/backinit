"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { WatchHub } from "./watch-hub";
import { ArrowUpRight, Globe2 } from "lucide-react";
import { newsFeedSchema, type NewsFeed } from "@backinit/domain";
export function News({
  compact = false,
  feed: initialFeed,
  real = false,
}: {
  compact?: boolean;
  feed?: NewsFeed | null;
  real?: boolean;
}) {
  const [feed, setFeed] = useState(initialFeed);
  const [loading, setLoading] = useState(false);
  const [attempt, retry] = useState(0);
  useEffect(
    () =>
      setFeed((old) =>
        !old?.data.length ||
        (initialFeed?.data.length &&
          Date.parse(initialFeed.fetchedAt || "") >
            Date.parse(old.fetchedAt || ""))
          ? initialFeed
          : old,
      ),
    [initialFeed],
  );
  useEffect(() => {
    if (!real) return;
    const controller = new AbortController();
    let running = false;
    const refresh = async () => {
      if (running || document.hidden) return;
      running = true;
      setLoading(true);
      try {
        const response = await fetch("/api/news", {
          signal: AbortSignal.any([
            controller.signal,
            AbortSignal.timeout(12000),
          ]),
        });
        if (!response.ok) throw new Error();
        const next = newsFeedSchema.parse(await response.json());
        if (!controller.signal.aborted) setFeed(next);
      } catch {
        /* Keep the most recent readable snapshot during a transient failure. */
      } finally {
        running = false;
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    void refresh();
    const timer = setInterval(() => void refresh(), 300000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      controller.abort();
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [real, attempt]);
  return (
    <section className="news-section">
      {real && !feed?.data.length && loading && (
        <div
          className="news-grid"
          role="status"
          aria-label="Loading sports news"
          aria-busy="true"
        >
          {[1, 2, 3].map((n) => (
            <div className="panel news-card" key={n}>
              <div className="skeleton-copy" aria-hidden="true" />
              <div className="skeleton-copy" aria-hidden="true" />
            </div>
          ))}
        </div>
      )}
      {real && !compact && !feed?.data.length && !loading && (
        <div className="panel">
          <p>{feed?.message || "News updates are temporarily unavailable."}</p>
          <button onClick={() => retry((n) => n + 1)}>Retry news</button>
        </div>
      )}
      {feed && (!real || feed.data.length > 0) && (
        <>
          <div className="section-heading">
            <h2>Latest news</h2>
            <span className="pill">
              {feed.status === "stale" ? "Updates delayed" : "Updated"}
            </span>
          </div>
          <details>
            <summary>News coverage</summary>
            <p>{feed.message}</p>
            {feed.attribution && (
              <p>
                News index:{" "}
                <a href={feed.attribution.url} target="_blank" rel="noreferrer">
                  {feed.attribution.name} ↗
                </a>
              </p>
            )}
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
                    {item.dateKind === "indexed" ? "Indexed " : ""}
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
      {real && !compact && <WatchHub preview />}
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
