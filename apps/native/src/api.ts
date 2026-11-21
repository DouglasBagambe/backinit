import Constants from "expo-constants";
import type { Broadcast, Catalogue, Video } from "./types";

const base = String(
  Constants.expoConfig?.extra?.apiBaseUrl || "https://db.backinit.live/api",
).replace(/\/$/, "");

async function get<T>(path: string): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  const response = await fetch(`${base}${path}`, {
    headers: { Accept: "application/json" },
    signal: controller.signal,
  }).finally(() => clearTimeout(timeout));
  if (!response.ok) throw new Error(`backinit service returned ${response.status}`);
  return response.json() as Promise<T>;
}

export async function loadCatalogue(): Promise<Catalogue> {
  const [broadcasts, videos] = await Promise.allSettled([
    get<{ data: Broadcast[] }>("/broadcasts"),
    get<{ data: Video[] }>("/videos"),
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
