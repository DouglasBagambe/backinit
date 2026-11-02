"use client";
import { adStartDelay } from "../lib/playback-priority";
import { useEffect, useRef, useState } from "react";
import { useAdvertising } from "./advertising";

const units = {
  wide: { key: "208c83c78501d240404891d74ed085e2", width: 728, height: 90 },
  medium: { key: "3252a86563bbe1fb22b0eea6f0cb2f75", width: 468, height: 60 },
  mobile: { key: "576edab930bc072648fb2ebc5443a5db", width: 320, height: 50 },
  rectangle: {
    key: "8012e7c6a2ca269c4f61b668b5547ea1",
    width: 300,
    height: 250,
  },
  short: { key: "276f42212b068ca265798bba87f19179", width: 160, height: 300 },
  tall: { key: "603c1aba716e2c6791970e0bb779b9ce", width: 160, height: 600 },
};
type Unit = (typeof units)[keyof typeof units];
// Legacy banners share atOptions. Finish each tag before assigning the next
// unit's settings, even when the header and sidebar approach the viewport together.
let queue = Promise.resolve();

export function DisplayAdvertising({
  placement = "leaderboard",
}: {
  placement?: "leaderboard" | "rectangle" | "skyscraper";
}) {
  const { enabled, nativeEnabled, preference } = useAdvertising();
  const host = useRef<HTMLDivElement>(null);
  const [unit, setUnit] = useState<Unit | null>(null);
  useEffect(() => {
    const node = host.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => {
      const width = entry.contentRect.width;
      const choices =
        placement === "leaderboard"
          ? [units.wide, units.medium, units.mobile]
          : placement === "skyscraper" && innerWidth >= 1100
            ? [units.tall]
            : [units.rectangle, units.short];
      const fitting = choices.find((item) => item.width <= width) || null;
      // Keep the current creative on growth. Never reload ads just to fill space.
      setUnit((old) => (old && old.width <= width ? old : fitting));
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [placement]);
  const allowed = enabled && nativeEnabled && preference === "accepted";
  return (
    <div ref={host} className={`display-ad-host display-ad-${placement}`}>
      {allowed && unit && <Banner key={unit.key} unit={unit} />}
    </div>
  );
}

function Banner({ unit }: { unit: Unit }) {
  const host = useRef<HTMLDivElement>(null);
  const [filled, setFilled] = useState(false);
  useEffect(() => {
    const node = host.current;
    if (!node) return;
    let cancelled = false;
    let started = false;
    const script = document.createElement("script");
    script.src = `https://czernik.org/22/${unit.key}`;
    const mutations = new MutationObserver(() => {
      if (node.querySelector("iframe,img,a[href]")) setFilled(true);
    });
    mutations.observe(node, { childList: true, subtree: true });
    const visible = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        visible.disconnect();
        queue = queue
          .catch(() => {})
          .then(
            () =>
              new Promise<void>((resolve) => {
                const begin = () => {
                  if (cancelled) return resolve();
                  started = true;
                  (window as Window & { atOptions?: unknown }).atOptions = {
                    key: unit.key,
                    format: "iframe",
                    height: unit.height,
                    width: unit.width,
                    params: {},
                  };
                  script.onload = script.onerror = () => {
                    if (cancelled) node.replaceChildren();
                    resolve();
                  };
                  // Original direct tag; the ad network creates its own creative iframe.
                  node.append(script);
                };
                const wait = () => {
                  if (cancelled) return resolve();
                  const delay = adStartDelay();
                  if (delay) setTimeout(wait, delay);
                  else begin();
                };
                wait();
              }),
          );
      },
      { rootMargin: "200px" },
    );
    visible.observe(node);
    return () => {
      cancelled = true;
      visible.disconnect();
      mutations.disconnect();
      // Removing a downloading script does not reliably cancel its execution.
      // Keep its options until load/error, even after this host is detached.
      // A stalled ad can delay other display tags, never application navigation.
      if (!started) node.replaceChildren();
    };
  }, [unit]);
  return (
    <aside
      aria-label="Advertisement"
      className={`ad-placement ad-display${filled ? " ad-ready" : ""}`}
    >
      {filled && <small>Advertisement</small>}
      <div ref={host} style={{ width: unit.width, maxWidth: "100%" }} />
    </aside>
  );
}
