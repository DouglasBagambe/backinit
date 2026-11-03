"use client";
import { ExternalLink } from "lucide-react";
const archive = [
  {
    title: "ONE Samurai 1",
    category: "MMA",
    date: "29 Apr 2026",
    url: "https://ppv.rw/vod/one-samurai-1",
  },
  {
    title: "East vs West 25: Batumi",
    category: "Arm wrestling",
    date: "1 Aug 2026",
    url: "https://ppv.rw/vod/east-vs-west-25-batumi",
  },
  {
    title: "East vs West 25: Extended Pass",
    category: "Arm wrestling",
    date: "2 Aug 2026",
    url: "https://ppv.rw/vod/east-vs-west-25-extended-pass",
  },
  {
    title: "East vs West 23: Germany",
    category: "Arm wrestling",
    date: "18 Apr 2026",
    url: "https://ppv.rw/vod/east-vs-west-23",
  },
];
export const replaySports = [...new Set(archive.map((v) => v.category))];
export function BroadcastArchive({
  sport = "All sports",
  query = "",
  kind = "All videos",
}: {
  sport?: string;
  query?: string;
  kind?: string;
}) {
  const filtered = archive.filter(
    (v) =>
      kind !== "Highlights" &&
      (sport === "All sports" || sport === v.category) &&
      `${v.title} ${v.category}`
        .toLowerCase()
        .includes(query.trim().toLowerCase()),
  );
  if (!filtered.length) return null;
  return (
    <section className="broadcast-archive">
      <div className="section-heading">
        <h2>More sports replays</h2>
        <a href="https://ppv.rw/vods" target="_blank" rel="noreferrer">
          Full replay archive ↗
        </a>
      </div>
      <p>Full-event replays. These open in a separate viewing site.</p>
      <div className="broadcast-grid">
        {filtered.map((v) => (
          <a
            className="broadcast-card broadcast-archive-card"
            href={v.url}
            target="_blank"
            rel="noreferrer"
            key={v.url}
          >
            <small>
              {v.category} · {v.date}
            </small>
            <h3>{v.title}</h3>
            <span>
              Watch replay <ExternalLink size={15} />
            </span>
          </a>
        ))}
      </div>
    </section>
  );
}
