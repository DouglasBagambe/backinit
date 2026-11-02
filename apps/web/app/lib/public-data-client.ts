"use client";
import { sports } from "@backinit/domain";
/** Only public feeds. Short-lived memory survives soft navigation, never sign-ins. */
export function createPublicDataClient() {
  const snapshots = new Map<string, { body: unknown; at: number }>();
  const pending = new Map<string, Promise<unknown>>();
  async function read(
    url: string,
    signal?: AbortSignal,
    ttl = 10000,
  ): Promise<unknown> {
    if (
      !/^\/api\/(?:events(?:\/[a-z0-9-]+)?|broadcasts|watch)(?:\?|$)/.test(url)
    )
      throw Error("Not a public feed");
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    const cached = snapshots.get(url);
    let task =
      cached && Date.now() - cached.at < ttl
        ? Promise.resolve(cached.body)
        : pending.get(url);
    if (!task) {
      const start = performance.now();
      task = fetch(url, { signal: AbortSignal.timeout(15000) }).then(
        async (response) => {
          if (!response.ok) throw Error("Feed request failed");
          const body: unknown = await response.json();
          if (snapshots.size >= 16 && !snapshots.has(url))
            snapshots.delete(snapshots.keys().next().value!);
          snapshots.set(url, { body, at: Date.now() });
          performance.measure?.("backinit:public-data", {
            start,
            duration: performance.now() - start,
            detail: { url },
          });
          return body;
        },
      );
      pending.set(url, task);
      void task.finally(() => pending.delete(url)).catch(() => {});
    }
    if (!signal) return task;
    return new Promise((resolve, reject) => {
      const abort = () => reject(new DOMException("Aborted", "AbortError"));
      signal.addEventListener("abort", abort, { once: true });
      task!
        .then((value) => (signal.aborted ? abort() : resolve(value)), reject)
        .finally(() => signal.removeEventListener("abort", abort));
    });
  }
  return { read };
}
export const publicData = createPublicDataClient();
export function eventsUrl(route: string) {
  const slug = route.startsWith("sport/") ? route.slice(6) : "";
  const sport = sports.find(
    (s) => s.toLowerCase().replaceAll(" ", "-") === slug,
  );
  return `/api/events${sport ? `?sport=${encodeURIComponent(sport)}` : ""}`;
}
