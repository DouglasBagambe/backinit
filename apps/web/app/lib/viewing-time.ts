"use client";
import { useEffect, useState } from "react";
export function useViewingZone() {
  const [zone, setZone] = useState("UTC");
  useEffect(() => {
    try {
      const saved = localStorage.getItem("backinit-timezone");
      const next = saved || Intl.DateTimeFormat().resolvedOptions().timeZone;
      new Intl.DateTimeFormat("en", { timeZone: next }).format();
      setZone(next);
    } catch {}
  }, []);
  function choose(next: string) {
    try {
      new Intl.DateTimeFormat("en", { timeZone: next }).format();
      localStorage.setItem("backinit-timezone", next);
      setZone(next);
    } catch {}
  }
  return { zone, choose };
}
export function localDay(iso: string, zone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(iso));
  return ["year", "month", "day"]
    .map((key) => parts.find((p) => p.type === key)?.value)
    .join("-");
}
export function localStart(iso: string, zone: string, date = true) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: zone,
    ...(date
      ? ({ weekday: "short", day: "numeric", month: "short" } as const)
      : {}),
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(iso));
}
