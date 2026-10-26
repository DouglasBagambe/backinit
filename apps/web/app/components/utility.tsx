"use client";
import Link from "next/link";
import { useState } from "react";
import { Moon, Sun, Heart, ShieldCheck } from "lucide-react";
import { Empty } from "./primitives";
export function Utility({
  route,
  theme,
  setTheme,
  clear,
}: {
  route: string;
  theme: string;
  setTheme: (t: string) => void;
  clear: () => void;
}) {
  const [cleared, setCleared] = useState(false);
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">BACKINIT</span>
          <h1>
            {route === "settings"
              ? "Make yourself at home."
              : route === "profile"
                ? "Your game. Your space."
                : route === "admin"
                  ? "Operations"
                  : `Explore ${route}`}
          </h1>
        </div>
      </div>
      {route === "settings" ? (
        <div className="panel settings-panel">
          <h2>Appearance</h2>
          <p>Choose a theme, or follow your device.</p>
          <div className="theme-options">
            {["system", "light", "dark"].map((t) => (
              <button
                className={theme === t ? "selected" : ""}
                aria-pressed={theme === t}
                key={t}
                onClick={() => setTheme(t)}
              >
                {t === "dark" ? <Moon size={20} /> : <Sun size={20} />} {t}
              </button>
            ))}
          </div>
          <h2>Local preferences</h2>
          <p>
            Favorites are saved in this browser. Cloud sync and notifications
            are not connected yet.
          </p>
          <button
            onClick={() => {
              clear();
              setCleared(true);
            }}
          >
            Clear saved events
          </button>
          {cleared && <p role="status">Saved events cleared.</p>}
          <h2>About this preview</h2>
          <p>
            This is a functional demo. Fixtures and scores are illustrative. The
            video player uses an open film test stream. No sports broadcast
            rights or real-time data feeds are configured.
          </p>
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
