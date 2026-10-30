"use client";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import Link from "next/link";

type Preference = "accepted" | "declined" | null;
const storageKey = "backinit-ad-preference-v1";
const Advertising = createContext<{
  enabled: boolean;
  preference: Preference;
  choose: (value: Preference) => void;
}>({ enabled: false, preference: null, choose: () => {} });

export function AdvertisingProvider({
  enabled,
  children,
}: {
  enabled: boolean;
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
      value={{ enabled: enabled && ready, preference, choose }}
    >
      {children}
    </Advertising.Provider>
  );
}

export function AdPreferences() {
  const { enabled, preference, choose } = useContext(Advertising);
  if (!enabled) return null;
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

// Publisher-issued public placement IDs. Never put account credentials in these tags.
const units = {
  rectangle: {
    key: "8012e7c6a2ca269c4f61b668b5547ea1",
    width: 300,
    height: 250,
  },
  mobile: { key: "576edab930bc072648fb2ebc5443a5db", width: 320, height: 50 },
  desktop: { key: "208c83c78501d240404891d74ed085e2", width: 728, height: 90 },
};
export function AdSlot({
  format = "banner",
}: {
  format?: "banner" | "rectangle";
}) {
  const { enabled, preference } = useContext(Advertising);
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [near, setNear] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const resize = new ResizeObserver(([entry]) =>
      setWidth(entry!.contentRect.width),
    );
    const visible = new IntersectionObserver(
      ([entry]) => {
        if (entry!.isIntersecting) setNear(true);
      },
      { rootMargin: "200px" },
    );
    resize.observe(node);
    visible.observe(node);
    return () => {
      resize.disconnect();
      visible.disconnect();
    };
  }, []);
  const unit =
    format === "rectangle"
      ? width >= 300
        ? units.rectangle
        : null
      : width >= 728
        ? units.desktop
        : width >= 320
          ? units.mobile
          : null;
  const show = enabled && preference === "accepted" && unit;
  return (
    <div ref={ref} className={`ad-slot ad-slot-${format}`}>
      {show && near && <AdvertisingFrame key={unit.key} unit={unit} />}
    </div>
  );
}

function AdvertisingFrame({
  unit,
}: {
  unit: (typeof units)[keyof typeof units];
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "empty">(
    "loading",
  );
  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (
        event.source === frame.current?.contentWindow &&
        event.data === "backinit-ad-content"
      )
        setStatus("ready");
    };
    window.addEventListener("message", receive);
    const timer = setTimeout(
      () => setStatus((value) => (value === "ready" ? value : "empty")),
      12000,
    );
    return () => {
      window.removeEventListener("message", receive);
      clearTimeout(timer);
    };
  }, []);
  // Opaque-origin frame isolates ads from account cookies and the application DOM.
  // Top navigation and downloads are forbidden; advertiser links open separately.
  const html = `<!doctype html><html><head><meta name="referrer" content="strict-origin-when-cross-origin"><style>html,body{margin:0;padding:0;overflow:hidden;background:transparent}</style></head><body><script>var atOptions=${JSON.stringify({ key: unit.key, format: "iframe", height: unit.height, width: unit.width, params: {} })};new MutationObserver(function(){if(document.querySelector('iframe[src],img[src],a[href]'))parent.postMessage('backinit-ad-content','*');}).observe(document.body,{childList:true,subtree:true});</script><script src="https://czernik.org/22/${unit.key}"></script></body></html>`;
  if (status === "empty") return null;
  return (
    <aside aria-label="Advertisement" className={`ad-placement ad-${status}`}>
      {status === "ready" && <small>Advertisement</small>}
      <iframe
        ref={frame}
        title="Advertisement"
        width={unit.width}
        height={unit.height}
        srcDoc={html}
        sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"
        referrerPolicy="strict-origin-when-cross-origin"
      />
    </aside>
  );
}
