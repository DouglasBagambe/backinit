"use client";
import Link from "next/link";
import { useState } from "react";
import { Monitor, Sun, Moon, Globe2, Star, ShieldCheck } from "lucide-react";
import { useViewingZone } from "../lib/viewing-time";
import { AdPreferences } from "./advertising";
export function Utility({
  clear,
  busy,
  theme,
  setTheme,
  savedCount,
  signedIn,
  syncError,
  retrySync,
}: {
  route: string;
  clear: () => Promise<void>;
  busy: boolean;
  theme: string;
  setTheme: (value: string) => void;
  savedCount: number;
  signedIn: boolean;
  syncError: string;
  retrySync: () => void;
}) {
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const { zone, choose } = useViewingZone();
  const zones = Array.from(
    new Set([
      zone,
      "Africa/Kampala",
      "UTC",
      "Europe/London",
      "America/New_York",
      "Asia/Tokyo",
    ]),
  );
  return (
    <section className="settings-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">MAKE IT YOURS</span>
          <h1>Settings</h1>
          <p>Your matchday, your way.</p>
        </div>
      </div>
      <div className="settings-grid">
        <section className="panel settings-card">
          <Monitor size={22} />
          <h2>Appearance</h2>
          <p>Choose the look that suits you.</p>
          <div
            className="settings-theme"
            role="group"
            aria-label="Choose appearance"
          >
            {[
              ["light", "Light", Sun],
              ["dark", "Dark", Moon],
              ["system", "System", Monitor],
            ].map(([value, label, Icon]) => {
              const I = Icon as typeof Sun;
              return (
                <button
                  key={value as string}
                  aria-pressed={theme === value}
                  onClick={() => setTheme(value as string)}
                >
                  <I size={18} />
                  {label as string}
                </button>
              );
            })}
          </div>
        </section>
        <section className="panel settings-card">
          <Globe2 size={22} />
          <h2>Match times</h2>
          <p>Schedules and match dates use this timezone.</p>
          <label htmlFor="viewing-timezone">Timezone</label>
          <select
            id="viewing-timezone"
            value={zone}
            onChange={(event) => choose(event.target.value)}
          >
            {zones.map((value) => (
              <option key={value} value={value}>
                {value.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </section>
        <section className="panel settings-card">
          <Star size={22} />
          <h2>Saved events</h2>
          <p>
            {savedCount} saved {savedCount === 1 ? "event" : "events"} ·{" "}
            {signedIn ? "Synced with your account" : "Stored on this device"}
          </p>
          {syncError && (
            <div className="settings-sync" role="status">
              <p>
                Couldn’t sync saved items. Your saved preferences are unchanged.
              </p>
              <button onClick={retrySync}>Retry sync</button>
            </div>
          )}
          <div className="settings-actions">
            <Link href="/favorites">View saved events ↗</Link>
            {savedCount > 0 && (
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
                {pending ? "Clearing…" : "Clear saved events"}
              </button>
            )}
          </div>
          {message && <p role="status">{message}</p>}
        </section>
        <section className="panel settings-card">
          <ShieldCheck size={22} />
          <h2>Privacy & account</h2>
          <p>Manage your cookie choice and account details.</p>
          <div className="settings-actions">
            <AdPreferences controlsOnly />
            <Link href="/profile">
              {signedIn ? "Manage account" : "Sign in or create an account"} ↗
            </Link>
            <Link href="/privacy">Privacy policy ↗</Link>
          </div>
        </section>
      </div>
    </section>
  );
}
