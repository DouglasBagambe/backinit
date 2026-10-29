"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
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
  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const result = await accountRequest("notifications");
        if (active) {
          setEnabled(result.enabled);
          setUpdates(result.data);
          setMessage("");
        }
      } catch (error) {
        if (active) setMessage((error as Error).message);
      } finally {
        if (active) setPending(false);
      }
    }
    void load();
    const timer = setInterval(() => {
      if (!document.hidden) void load();
    }, 60000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);
  return (
    <section className="panel notification-panel">
      <div className="section-heading">
        <h2>Your updates</h2>
        <span className="pill">
          {updates.filter((u) => !u.read).length} UNREAD
        </span>
      </div>
      <p>
        Get updates here for saved events and the sport you follow. Updates may
        be delayed. Email and push notifications aren’t available.
      </p>
      <label className="check-label">
        <input
          type="checkbox"
          checked={enabled}
          disabled={pending}
          onChange={async (e) => {
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
              setPending(false);
            }
          }}
        />
        Notify me in BackInIt about my saved sport
      </label>
      {updates.length > 0 && (
        <button
          disabled={pending}
          onClick={async () => {
            setPending(true);
            try {
              await accountRequest("notification-read", "POST", {});
              setUpdates((v) => v.map((u) => ({ ...u, read: 1 })));
            } catch (error) {
              setMessage((error as Error).message);
            } finally {
              setPending(false);
            }
          }}
        >
          Mark all as read
        </button>
      )}
      {!pending && updates.length === 0 && (
        <p>
          No match updates yet. New changes appear here after you enable updates
          and save an event or follow a participant.
        </p>
      )}
      {updates.map((update) => (
        <article className="notification-item" key={update.id}>
          <h3>
            <Link href={`/match/${update.eventId}`}>{update.title}</Link>
            {!update.read && <span className="pill">NEW</span>}
          </h3>
          <p>{update.message}</p>
          <small>
            <a href={update.sourceUrl} target="_blank" rel="noreferrer">
              {update.provider} ↗
            </a>{" "}
            · Reported{" "}
            {new Date(update.reportedAt).toLocaleString("en-GB", {
              timeZone: "UTC",
            })}{" "}
            UTC
          </small>
        </article>
      ))}
      {message && <p role="status">{message}</p>}
    </section>
  );
}
