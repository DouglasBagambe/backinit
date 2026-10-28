"use client";
import Link from "next/link";
import { useState } from "react";
import { Heart, ShieldCheck } from "lucide-react";
import { Empty } from "./primitives";
export function Utility({
  route,
  clear,
  busy,
}: {
  route: string;
  clear: () => Promise<void>;
  busy: boolean;
}) {
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>
            {route === "settings"
              ? "Settings"
              : route === "profile"
                ? "Account"
                : route === "admin"
                  ? "Operations"
                  : `Explore ${route}`}
          </h1>
        </div>
      </div>
      {route === "settings" ? (
        <div className="panel settings-panel">
          <p>Appearance: choose a theme in the footer.</p>
          <h2>Local preferences</h2>
          <p>Guest favorites stay on this device. Sign in to sync.</p>
          <button
            disabled={pending || busy}
            onClick={async () => {
              setPending(true);
              try {
                await clear();
                setMessage("Saved events cleared.");
              } catch (error) {
                setMessage((error as Error).message);
              } finally {
                setPending(false);
              }
            }}
          >
            Clear saved events
          </button>
          {message && <p role="status">{message}</p>}
          <details>
            <summary>Data & viewing availability</summary>
            <p>
              Coverage varies by sport. Schedule-only events have no connected
              live scores. Streams require a permitted source; listings do not
              guarantee availability.
            </p>
          </details>
        </div>
      ) : route === "profile" ? (
        <div className="panel">
          <Heart size={32} />
          <h2>Welcome, sports fan.</h2>
          <p>
            Browse freely and save events on this device. Account registration
            and cross-device sync are planned for the personalization milestone.
          </p>
          <Link className="primary" href="/favorites">
            Open your favorites
          </Link>
        </div>
      ) : route === "admin" ? (
        <div className="panel">
          <ShieldCheck size={32} />
          <h2>Administrative access is not enabled.</h2>
          <p>
            No privileged data or mutation controls are exposed. Role-based
            authentication and audit logging are required before source
            management is activated.
          </p>
        </div>
      ) : (
        <Empty
          title={`${route.charAt(0).toUpperCase() + route.slice(1)} directory is not connected.`}
          text="Explore the event feed while verified profiles and competition data are being integrated."
        />
      )}
    </>
  );
}
