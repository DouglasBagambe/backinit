"use client";
import { useEffect } from "react";
import { useAdvertising } from "./advertising";

let externalLoaded = false;
const protectedPath = /^\/(?:profile|admin|settings|favorites|privacy)(?:\/|$)/;
const publicPages = new Set([
  "",
  "watch",
  "fixtures",
  "live",
  "scores",
  "news",
  "videos",
]);

/** Only original account-issued tags. Loading limits are separate from the
 * network's creative/impression caps; never simulate an ad click or open. */
export function GlobalAdvertising({ page }: { page: string }) {
  const { enabled, nativeEnabled, preference } = useAdvertising();
  const allowed = enabled && nativeEnabled && preference === "accepted";
  useEffect(() => {
    if (!externalLoaded) return;
    if (!allowed || !publicPages.has(page)) location.reload();
  }, [allowed, page]);
  useEffect(() => {
    const navigation = (event: MouseEvent) => {
      if (
        !externalLoaded ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      const anchor = (event.target as Element)?.closest?.(
        "a[href]",
      ) as HTMLAnchorElement | null;
      if (!anchor || anchor.target === "_blank") return;
      const url = new URL(anchor.href, location.href);
      if (url.origin !== location.origin || url.pathname === location.pathname)
        return;
      if (protectedPath.test(url.pathname)) {
        event.preventDefault();
        event.stopImmediatePropagation();
        location.assign(url.href);
      } else {
        // Leave the document containing third-party handlers when navigating away.
        // A match/player page never inherits that handler from Watch discovery.
        event.preventDefault();
        setTimeout(() => location.assign(url.href), 0);
      }
    };
    document.addEventListener("click", navigation, true);
    return () => document.removeEventListener("click", navigation, true);
  }, []);
  useEffect(() => {
    if (!allowed || !publicPages.has(page) || externalLoaded) return;
    const pop = page === "watch";
    const key = pop ? "backinit-pop-tag-v1" : "backinit-social-tag-v1";
    const interval = pop ? 24 * 60 * 60 * 1000 : 6 * 60 * 60 * 1000;
    const now = Date.now();
    try {
      const previous = Number(localStorage.getItem(key));
      if (previous && now - previous < interval) return;
    } catch {
      return;
    } // No storage means we cannot apply the loading limit.
    let script: HTMLScriptElement | undefined;
    const timer = setTimeout(
      () => {
        if (document.hidden) return;
        const stamp = String(Date.now());
        try {
          const previous = Number(localStorage.getItem(key));
          if (previous && Date.now() - previous < interval) return;
          localStorage.setItem(key, stamp);
        } catch {
          return;
        }
        script = document.createElement("script");
        script.setAttribute("data-cfasync", "false");
        script.dataset.backinitAdFormat = pop ? "popunder" : "social-bar";
        script.src = pop
          ? "https://capitalhospitals.org/1/548b0877b7f514cfb8326cf26dbd7fe2"
          : "https://czernik.org/14/1ed8358b832d318983f90d4b83b1eb73";
        script.onerror = () => {
          try {
            if (localStorage.getItem(key) === stamp)
              localStorage.removeItem(key);
          } catch {}
        };
        externalLoaded = true;
        (pop ? document.head : document.body).append(script);
      },
      pop ? 30000 : 15000,
    );
    return () => {
      clearTimeout(timer);
      script?.remove();
    };
  }, [allowed, page]);
  return null;
}
