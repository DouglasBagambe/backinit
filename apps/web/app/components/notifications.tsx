"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { localStart, useViewingZone } from "../lib/viewing-time";
import { accountRequest } from "../lib/account-client";
type Update = {
  id: number;
  eventId: string;
  title: string;
  message: string;
  provider: string;
  sourceUrl: string;
  reportedAt: string;
  read: number;
};
export function Notifications() {
  const [enabled, setEnabled] = useState(false);
  const [updates, setUpdates] = useState<Update[]>([]);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(true);
  const { zone } = useViewingZone();
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [retry, setRetry] = useState(0);
  const inFlight = useRef<symbol | null>(null);
  useEffect(() => {
    let active = true;
    let requestToken: symbol | null = null;
    async function load() {
      if (inFlight.current) return;
      const token = Symbol();
      requestToken = token;
      inFlight.current = token;
      if (active) setPending(true);
      try {
        const result = await accountRequest("notifications");
        if (active) {
          setReady(true);
          setLoadError(false);
          setEnabled(result.enabled);
          setUpdates(result.data);
          setMessage("");
        }
      } catch (error) {
        if (active) {
          setLoadError(true);
          setMessage((error as Error).message);
        }
      } finally {
        if (inFlight.current === token) inFlight.current = null;
        if (active) setPending(false);
      }
    }
    void load();
    const timer = setInterval(() => {
      if (!document.hidden) void load();
    }, 60000);
    return () => {
      active = false;
      if (inFlight.current === requestToken) inFlight.current = null;
      clearInterval(timer);
    };
  }, [retry]);
  return (
    <section className="panel notification-panel">
      <div className="section-heading">
        <h2>Your updates</h2>
        <span className="pill">
          {ready
            ? `${updates.filter((u) => !u.read).length} UNREAD`
            : loadError
              ? "Updates"
              : "Loading updates"}
        </span>
      </div>
      <p>
        Get match updates in BackInIt for saved events and the sport you follow.
        Updates reflect the latest reported scores.
      </p>
      <label className="check-label">
        <input
          type="checkbox"
          checked={enabled}
          disabled={pending || !ready}
          onChange={async (e) => {
            if (inFlight.current) return;
            inFlight.current = Symbol();
            const value = e.target.checked;
            setEnabled(value);
            setPending(true);
            try {
              await accountRequest("notification-preferences", "POST", {
                enabled: value,
              });
              setEnabled(value);
              setMessage(
                value ? "Match updates enabled." : "Match updates disabled.",
              );
            } catch (error) {
              setEnabled(!value);
              setMessage((error as Error).message);
            } finally {
              inFlight.current = null;
              setPending(false);
            }
          }}
        />
        Notify me in BackInIt about my saved sport
      </label>
      {updates.length > 0 && (
        <button
          disabled={pending || !ready}
          onClick={async () => {
            if (inFlight.current) return;
            inFlight.current = Symbol();
            setPending(true);
            try {
              await accountRequest("notification-read", "POST", {});
              setUpdates((v) => v.map((u) => ({ ...u, read: 1 })));
            } catch (error) {
              setMessage((error as Error).message);
            } finally {
              inFlight.current = null;
              setPending(false);
            }
          }}
        >
          Mark all as read
        </button>
      )}
      {ready && !loadError && !pending && updates.length === 0 && (
        <p>
          No match updates yet. New changes appear here after you enable updates
          and save an event or follow a participant.
        </p>
      )}
      {updates.map((update) => (
        <article className="notification-item" key={update.id}>
          <h3>
            <Link href={`/watch/${update.eventId}`}>{update.title}</Link>
            {!update.read && <span className="pill">NEW</span>}
          </h3>
          <p>{update.message}</p>
          <small>
            <a href={update.sourceUrl} target="_blank" rel="noreferrer">
              {update.provider} ↗
            </a>{" "}
            · Reported{" "}
            <time dateTime={update.reportedAt}>
              {localStart(update.reportedAt, zone)}
            </time>{" "}
            {zone}
          </small>
        </article>
      ))}
      {message && <p role="status">{message}</p>}
      {loadError && (
        <button
          disabled={pending}
          onClick={() => {
            setPending(true);
            setRetry((v) => v + 1);
          }}
        >
          Retry updates
        </button>
      )}
    </section>
  );
}
