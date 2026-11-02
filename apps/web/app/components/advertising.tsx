"use client";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import Link from "next/link";

type Preference = "accepted" | "declined" | null;
const storageKey = "backinit-ad-preference-v3";
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
    // A fresh document cancels pending vendor scripts as well as their handlers.
    if (preference === "accepted" && value !== "accepted") location.reload();
  }
  return (
    <Advertising.Provider
      value={{ enabled: enabled && ready, nativeEnabled, preference, choose }}
    >
      {children}
    </Advertising.Provider>
  );
}

export function useAdvertising() {
  return useContext(Advertising);
}

export function AdPreferences({
  promptOnly = false,
  controlsOnly = false,
}: {
  promptOnly?: boolean;
  controlsOnly?: boolean;
}) {
  const { enabled, nativeEnabled, preference, choose } =
    useContext(Advertising);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (enabled && nativeEnabled && !preference && !controlsOnly)
      dialog.current?.showModal();
    else dialog.current?.close();
  }, [enabled, nativeEnabled, preference, controlsOnly]);
  if (
    !enabled ||
    !nativeEnabled ||
    (promptOnly && preference) ||
    (controlsOnly && !preference)
  )
    return null;
  return (
    <div className="ad-preferences">
      {preference ? (
        <button className="text-button" onClick={() => choose(null)}>
          Cookie settings
        </button>
      ) : (
        <dialog
          ref={dialog}
          className="ad-consent"
          aria-label="Cookie preferences"
          onCancel={(event) => event.preventDefault()}
        >
          <div>
            <span className="eyebrow">YOUR PRIVACY</span>
            <h2>Your choice, before kickoff.</h2>
            <p>
              Advertising helps keep BackInIt free. Accept all to allow
              Adsterra, HilltopAds and their partners to use cookies and device
              information to show and measure ads. Essential only keeps
              advertising tracking off. You can change this later in content Settings.{" "}
              <Link href="/privacy" target="_blank">
                Privacy policy ↗
              </Link>
            </p>
          </div>
          <div className="ad-consent-actions">
            <button onClick={() => choose("accepted")}>Essential only</button>
            <button onClick={() => choose("accepted")}>Accept all</button>
          </div>
        </dialog>
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
      {(format === "banner" || sponsored) && enabled && (
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

export function PlaybackAdNotice() {
  const { enabled, nativeEnabled, preference } = useAdvertising();
  return enabled && nativeEnabled && preference === "accepted" ? (
    <p className="playback-ad-notice">Play may open a sponsored tab.</p>
  ) : null;
}
