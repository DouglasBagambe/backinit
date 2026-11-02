"use client";
import { useEffect, useRef, useState } from "react";
import { eventSchema, type SportEvent } from "@backinit/domain";
import type { Broadcast } from "../lib/broadcast-types";
export function useBroadcastMatch(item: Broadcast | undefined) {
  const [event, setEvent] = useState<SportEvent | null>(null);
  const [checking, setChecking] = useState(false);
  const identity = useRef<string | null>(null);
  useEffect(() => {
    identity.current = null;
    setEvent(null);
    if (!item || item.channel) {
      setChecking(false);
      return;
    }
    const controller = new AbortController();
    let running = false;
    const load = async () => {
      if (running || controller.signal.aborted || document.hidden) return;
      running = true;
      setChecking(!identity.current);
      try {
        const response = await fetch(
          identity.current
            ? `/api/events/${identity.current}`
            : `/api/broadcasts/${item.id}/event`,
          {
            signal: AbortSignal.any([
              controller.signal,
              AbortSignal.timeout(15000),
            ]),
          },
        );
        if (!response.ok) throw Error();
        const body = await response.json();
        const next = body.data === null ? null : eventSchema.parse(body.data);
        if (next?.provenance !== "provider" && next !== null) throw Error();
        if (identity.current && next?.id !== identity.current) throw Error();
        if (!controller.signal.aborted) {
          identity.current = next?.id || null;
          setEvent(next);
        }
      } catch {
        if (!controller.signal.aborted)
          setEvent((old) =>
            old
              ? {
                  ...old,
                  ...(old.status === "live"
                    ? { status: "unknown" as const }
                    : {}),
                  ...(old.source
                    ? { source: { ...old.source, stale: true } }
                    : {}),
                }
              : null,
          );
      } finally {
        running = false;
        if (!controller.signal.aborted) setChecking(false);
      }
    };
    void load();
    const timer = setInterval(load, 30000);
    document.addEventListener("visibilitychange", load);
    return () => {
      controller.abort();
      clearInterval(timer);
      document.removeEventListener("visibilitychange", load);
    };
  }, [item?.id, item?.channel]);
  return { event, checking };
}
