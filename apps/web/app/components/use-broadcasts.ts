"use client";
import { useState, useEffect } from "react";
import { publicData } from "../lib/public-data-client";
import {
  broadcastFeedSchema,
  type BroadcastFeed,
} from "../lib/broadcast-types";
export function useBroadcasts() {
  const [feed, setFeed] = useState<BroadcastFeed>({
    data: [],
    updatedAt: null,
    stale: false,
  });
  const [loading, setLoading] = useState(true);
  const [attempt, retry] = useState(0);
  useEffect(() => {
    const c = new AbortController();
    let busy = false;
    const load = async () => {
      if (busy || document.hidden) return;
      busy = true;
      try {
        const next = broadcastFeedSchema.parse(
          await publicData.read("/api/broadcasts", c.signal),
        );
        if (!c.signal.aborted)
          setFeed((old) =>
            next.updatedAt
              ? next
              : { ...old, stale: true, message: next.message },
          );
      } catch {
        if (!c.signal.aborted)
          setFeed((old) => ({
            ...old,
            stale: true,
            message: "Broadcast catalogue unavailable. Try again.",
          }));
      } finally {
        busy = false;
        if (!c.signal.aborted) setLoading(false);
      }
    };
    void load();
    const timer = setInterval(load, 60000);
    document.addEventListener("visibilitychange", load);
    return () => {
      c.abort();
      clearInterval(timer);
      document.removeEventListener("visibilitychange", load);
    };
  }, [attempt]);
  return { feed, loading, retry: () => retry((x) => x + 1) };
}
