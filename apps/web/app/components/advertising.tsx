"use client";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import Link from "next/link";

type Preference = "accepted" | "declined" | null;
const storageKey = "backinit-ad-preference-v1";
const Advertising = createContext<{
  enabled: boolean;
  nativeEnabled: boolean;
  preference: Preference;
  choose: (value: Preference) => void;
}>({
  enabled: false,
  nativeEnabled: false,
  preference: null,
  choose: () => {},
});

export function AdvertisingProvider({
  enabled,
  nativeEnabled,
  children,
}: {
  enabled: boolean;
  nativeEnabled: boolean;
  children: React.ReactNode;
}) {
  const [preference, setPreference] = useState<Preference>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const read = () => {
      try {
        const value = localStorage.getItem(storageKey);
        setPreference(
          value === "accepted" || value === "declined" ? value : null,
        );
      } catch {
        setPreference(null);
      }
      setReady(true);
    };
    read();
    window.addEventListener("storage", read);
    return () => window.removeEventListener("storage", read);
  }, []);
  function choose(value: Preference) {
    setPreference(value);
    try {
      if (value) localStorage.setItem(storageKey, value);
      else localStorage.removeItem(storageKey);
    } catch {
      /* The choice still applies for this page when storage is unavailable. */
    }
  }
  return (
    <Advertising.Provider
      value={{ enabled: enabled && ready, nativeEnabled, preference, choose }}
    >
      {children}
    </Advertising.Provider>
  );
}

export function AdPreferences() {
  const { enabled, nativeEnabled, preference, choose } =
    useContext(Advertising);
  if (!enabled || !nativeEnabled) return null;
  return (
    <div className="ad-preferences">
      {preference ? (
        <button className="text-button" onClick={() => choose(null)}>
          Ad preferences
        </button>
      ) : (
        <section className="ad-consent" aria-label="Advertising preferences">
          <div>
            <strong>Support BackInIt with ads</strong>
            <p>
              Allow Adsterra and its advertising partners to use cookies and
              device information to show and measure ads. Your choice won’t
              affect playback. <Link href="/privacy">Privacy</Link>
            </p>
          </div>
          <div className="ad-consent-actions">
            <button onClick={() => choose("declined")}>Decline ads</button>
            <button onClick={() => choose("accepted")}>Allow ads</button>
          </div>
        </section>
      )}
    </div>
  );
}

// Account-issued Native Banner tag, supplied by the publisher. One unit per page.
const nativeKey = "b9e9a122a56fe6638c4236bbf4696b47";
export function AdSlot({
  format = "banner",
  sponsored = false,
  native = false,
}: {
  format?: "banner" | "rectangle";
  sponsored?: boolean;
  native?: boolean;
}) {
  const { enabled, nativeEnabled, preference } = useContext(Advertising);
  return (
    <div className={`ad-slot ad-slot-${format}`}>
      {native && enabled && nativeEnabled && preference === "accepted" && (
        <NativeAdvertising />
      )}
      {(format === "banner" || sponsored) &&
        enabled &&
        (!nativeEnabled || preference === "accepted") && (
          <a
            className={`sponsored-offers${format === "rectangle" ? " sponsored-card" : ""}`}
            href="https://asiafilm.org/4/03e480f030ce8a18c8c3de500ca10b7d"
            target="_blank"
            rel="sponsored noopener noreferrer"
          >
            {format === "rectangle" ? (
              <>
                <small>Sponsored</small>
                <strong>Explore offers ↗</strong>
                <span>Support BackInIt</span>
              </>
            ) : (
              "Sponsored offers ↗"
            )}
          </a>
        )}
    </div>
  );
}

function NativeAdvertising() {
  const host = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const node = host.current;
    if (!node) return;
    let started = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const container = document.createElement("div");
    container.id = `container-${nativeKey}`;
    const script = document.createElement("script");
    script.async = true;
    script.setAttribute("data-cfasync", "false");
    script.src = `https://czernik.org/21/${nativeKey}`;
    const content = new MutationObserver(() => {
      if (container.querySelector("iframe, img, a[href]")) setReady(true);
    });
    content.observe(container, { childList: true, subtree: true });
    const visible = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting || started) return;
        started = true;
        visible.disconnect();
        // Execute the original asynchronous tag directly, without an iframe wrapper.
        node.append(container, script);
        timer = setTimeout(() => {
          if (!container.querySelector("iframe, img, a[href]")) {
            script.remove();
            container.remove();
          }
        }, 12000);
      },
      { rootMargin: "200px" },
    );
    visible.observe(node);
    return () => {
      visible.disconnect();
      content.disconnect();
      clearTimeout(timer);
      script.remove();
      container.remove();
    };
  }, []);
  return (
    <aside
      aria-label="Advertisement"
      className={`ad-placement ad-native${ready ? " ad-ready" : ""}`}
    >
      {ready && <small>Advertisement</small>}
      <div ref={host} className="ad-native-content" />
    </aside>
  );
}
