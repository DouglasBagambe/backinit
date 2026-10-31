/** Screens that own their data must not wait for the all-sport catalogue. */
export function usesCatalogue(route: string) {
  return ![
    "news",
    "privacy",
    "settings",
    "profile",
    "admin",
    "videos",
    "playback",
  ].includes(route);
}
export function catalogueRenderBudget(route: string) {
  return route === "watch" ||
    route.startsWith("watch/") ||
    route.startsWith("match/")
    ? 300
    : 1500;
}
