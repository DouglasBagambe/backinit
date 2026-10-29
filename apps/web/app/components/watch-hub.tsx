"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Play, ArrowUpRight, RefreshCw } from "lucide-react";
import { streamSourceSchema, type StreamSource } from "@backinit/domain";
import { z } from "zod";
import { SportMark } from "./marks";
import { LazyPlayer as Player } from "./lazy-player";
export function WatchHub({ preview = false }: { preview?: boolean }) {
  const [videos, setVideos] = useState<StreamSource[]>([]);
  const [selected, setSelected] = useState<StreamSource | null>(null);
  const params = useSearchParams();
  const selectedSport = params.get("sport") || "All sports";
  const [sport, setSport] = useState(selectedSport);
  useEffect(() => setSport(selectedSport), [selectedSport]);
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("Loading official sports videos…");
  const [attempt, setAttempt] = useState(0);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    void fetch("/api/videos", { signal: controller.signal })
      .then(async (r) => {
        if (!r.ok) throw new Error();
        return z
          .object({ data: z.array(streamSourceSchema) })
          .parse(await r.json());
      })
      .then(({ data }) => {
        setVideos(data);
        setMessage(data.length ? "" : "No videos available.");
        const requested = new URLSearchParams(location.search).get("video");
        if (!preview)
          setSelected(
            data.find((v) => v.id === requested) ||
              data.find((v) => v.catalog?.category.startsWith("Full")) ||
              data[0] ||
              null,
          );
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setMessage("Videos unavailable. Try again.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [attempt, preview]);
  useEffect(() => {
    if (
      !preview &&
      sport !== "All sports" &&
      selected?.catalog?.sport !== sport
    )
      setSelected(videos.find((v) => v.catalog?.sport === sport) || null);
  }, [sport, preview, videos, selected]);
  const available = videos.filter(
    (v) =>
      (sport === "All sports" || v.catalog?.sport === sport) &&
      `${v.name} ${v.catalog?.publisher}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  return (
    <section className="watch-hub" aria-label="Official sports viewing">
      <div className="section-heading">
        <h2>{preview ? "Featured" : "Browse videos"}</h2>
        {preview && (
          <Link href="/watch">
            Live events <ArrowUpRight size={16} />
          </Link>
        )}
      </div>
      {!preview && <p>Replays & highlights · Regional availability varies.</p>}
      {!preview && selected && (
        <div id="watch-player" className="watch-feature">
          <div className="section-heading">
            <div>
              <span className="eyebrow">
                {selected.catalog?.publisher} · {selected.catalog?.category}
              </span>
              <h2>{selected.name}</h2>
            </div>
          </div>
          <Player key={selected.id} sourceId={selected.id} />
        </div>
      )}
      {!preview && (
        <div className="watch-filters">
          <label>
            Search videos
            <input
              aria-label="Search videos"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="WWE, free fights, full matches…"
            />
          </label>
          <label>
            Sport
            <select
              aria-label="Filter videos by sport"
              value={sport}
              onChange={(e) => setSport(e.target.value)}
            >
              {[
                "All sports",
                ...new Set(
                  videos
                    .map((v) => v.catalog?.sport)
                    .filter((v): v is NonNullable<typeof v> => Boolean(v)),
                ),
              ].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
        </div>
      )}
      {loading && (
        <div className="watch-grid" aria-busy="true" role="status">
          <span className="sr-only">Loading videos</span>
          {[1, 2, 3].map((i) => (
            <div key={i} className="watch-skeleton">
              <div />
              <div className="skeleton-copy" aria-hidden="true" />
            </div>
          ))}
        </div>
      )}
      {!loading && message && <p role="status">{message}</p>}
      {!loading && (
        <div className="watch-grid">
          {(preview
            ? available
                .filter(
                  (v, i, a) =>
                    a.findIndex(
                      (x) => x.catalog?.sport === v.catalog?.sport,
                    ) === i,
                )
                .slice(0, 3)
            : available
          ).map((video) => (
            <article className="watch-card" key={video.id}>
              <Link
                className="watch-poster"
                href={preview ? `/videos?video=${video.id}` : "#watch-player"}
                onClick={() => {
                  if (!preview) setSelected(video);
                }}
                aria-label={`Watch ${video.catalog?.category}: ${video.name}`}
              >
                <img
                  src={video.catalog?.thumbnail}
                  alt=""
                  loading="lazy"
                  referrerPolicy="no-referrer"
                />
                <span className="watch-play">
                  <Play size={24} fill="currentColor" />
                </span>
                <span className="watch-kind">{video.catalog?.category}</span>
              </Link>
              <div className="watch-card-body">
                <span className="eyebrow">
                  {[
                    "WWE",
                    "WWE Vault",
                    "UFC",
                    "NBA",
                    "FIFA",
                    "FORMULA 1",
                  ].includes(video.catalog?.publisher || "") && (
                    <SportMark
                      name={
                        video.catalog?.publisher === "UFC"
                          ? "MMA"
                          : video.catalog?.publisher || ""
                      }
                    />
                  )}
                  {video.catalog?.sport} · {video.catalog?.publisher}
                </span>
                <h3>{video.name}</h3>
                <a href={video.rightsEvidence} target="_blank" rel="noreferrer">
                  Official source ↗
                </a>
              </div>
            </article>
          ))}
        </div>
      )}
      {!loading && !available.length && !message && (
        <p>No videos match that search. Try another sport or title.</p>
      )}
      {!preview && (
        <>
          <button onClick={() => setAttempt((a) => a + 1)} disabled={loading}>
            <RefreshCw size={15} /> Check sources again
          </button>
          <details className="viewing-notes">
            <summary>Live broadcasts & viewing information</summary>
            <p>
              Live event viewing and source availability are listed in Watch.
              This library contains replays and highlights. The official player
              controls region, age, sign-in and embedding restrictions.
              Availability can change. If an embed fails, use its official
              source link.
            </p>
            <p>
              Find free official coverage on{" "}
              <a
                href="https://www.fiba.basketball/en/news/watch-live-on-the-fiba-youtube-channel-this-week"
                target="_blank"
                rel="noreferrer"
              >
                FIBA’s live schedule
              </a>
              ,{" "}
              <a
                href="https://www.fifa.com/en/watch"
                target="_blank"
                rel="noreferrer"
              >
                FIFA+
              </a>{" "}
              or{" "}
              <a
                href="https://www.icc-cricket.com/icc-tv"
                target="_blank"
                rel="noreferrer"
              >
                ICC.tv
              </a>
              . Each provider decides availability in your country. Their viewer
              access does not grant us redistribution rights.
            </p>
            <p>
              BBC news and sports data feeds do not grant broadcasting rights.
              Licensed HLS/DASH sources can be added by an administrator after
              rights review.
            </p>
          </details>
        </>
      )}
    </section>
  );
}
