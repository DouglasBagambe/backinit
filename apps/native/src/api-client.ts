import type { Broadcast, Catalogue, Video } from "./types";

async function get<T>(bases: string[], path: string): Promise<T> {
  const failures: string[] = [];
  for (const base of bases) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12_000);
    try {
      const response = await fetch(`${base}${path}`, {
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });
      if (!response.ok) {
        failures.push(`${response.status} from ${base}`);
        continue;
      }
      return (await response.json()) as T;
    } catch (reason) {
      failures.push(
        reason instanceof Error
          ? `${base}: ${reason.message}`
          : `${base}: unavailable`,
      );
    } finally {
      clearTimeout(timeout);
    }
  }
  throw new Error(`backinit service unavailable (${failures.join("; ")})`);
}

export async function loadCatalogueFromBases(
  bases: string[],
): Promise<Catalogue> {
  const [broadcasts, videos] = await Promise.allSettled([
    get<{ data: Broadcast[] }>(bases, "/broadcasts"),
    get<{ data: Video[] }>(bases, "/videos"),
  ]);
  if (broadcasts.status === "rejected" && videos.status === "rejected") {
    throw broadcasts.reason;
  }
  return {
    broadcasts:
      broadcasts.status === "fulfilled"
        ? broadcasts.value.data.filter((item) => item.sources.length > 0)
        : [],
    videos: videos.status === "fulfilled" ? videos.value.data : [],
  };
}
