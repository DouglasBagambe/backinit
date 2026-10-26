import Link from "next/link";
import { ArrowUpRight, Globe2 } from "lucide-react";
export function News({ compact = false }: { compact?: boolean }) {
  return (
    <section className="news-section">
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
            body: "Explore event replay and a statistical snapshot in our demo Match Centre.",
            href: "/match/north-london",
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
      {!compact && (
        <div className="availability">
          <Globe2 />
          <p>
            News ingestion is not connected yet. These are product guides, not
            sports reporting. Future news includes source attribution,
            publication dates and original links.
          </p>
        </div>
      )}
    </section>
  );
}
