"use client";
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useAdvertising } from "./advertising";
const key = "backinit-sports-offer-v1";
/** A labelled, optional publisher creative for the existing approved Smartlink. */
export function SportsSponsoredBadge({ page }: { page: string }) {
  const { enabled, nativeEnabled, preference } = useAdvertising();
  const allowed =
    enabled &&
    nativeEnabled &&
    preference === "accepted" &&
    /^watch\/[a-z0-9-]+$/.test(page);
  const [shown, setShown] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  useEffect(() => {
    setShown(false);
    if (!allowed) return;
    const timer = setTimeout(() => {
      if (document.hidden || innerWidth < 1001) return;
      try {
        const previous = Number(localStorage.getItem(key));
        if (previous && Date.now() - previous < 6 * 3600000) return;
        localStorage.setItem(key, String(Date.now()));
        setShown(true);
      } catch {}
    }, 12000);
    return () => clearTimeout(timer);
  }, [allowed, page]);
  useEffect(() => {
    const read = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", read);
    return () => document.removeEventListener("fullscreenchange", read);
  }, []);
  if (!allowed || !shown || fullscreen) return null;
  return (
    <aside className="sports-sponsored-badge" aria-label="Sponsored offers">
      <button
        aria-label="Dismiss sponsored offers"
        onClick={() => setShown(false)}
      >
        <X size={14} />
      </button>
      <a
        href="https://asiafilm.org/4/03e480f030ce8a18c8c3de500ca10b7d"
        target="_blank"
        rel="sponsored nofollow noopener noreferrer"
        aria-label="Explore sponsored offers (opens a new tab)"
      >
        <svg
          className="sponsored-football"
          viewBox="0 0 100 64"
          aria-hidden="true"
        >
          <defs>
            <radialGradient id="offer-ball">
              <stop offset="0" stopColor="#ce8958" />
              <stop offset=".6" stopColor="#8b472b" />
              <stop offset="1" stopColor="#4d281b" />
            </radialGradient>
          </defs>
          <path
            d="M3 32Q18 1 50 2Q82 1 97 32Q82 63 50 62Q18 63 3 32Z"
            fill="url(#offer-ball)"
          />
          <path
            d="M20 10Q32 32 20 54M80 10Q68 32 80 54"
            fill="none"
            stroke="#fff8e8"
            strokeWidth="5"
          />
          <path
            d="M36 32H64M40 26V38M47 26V38M54 26V38M61 26V38"
            stroke="#fff8e8"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </svg>
        <span>Sponsored</span>
      </a>
    </aside>
  );
}
