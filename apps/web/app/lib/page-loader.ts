import { isBroadcastId } from "@backinit/domain";
import { loadEvents, loadEvent } from "./feed";
import { loadNews } from "./news";
import { sports } from "@backinit/domain";
import { resolveEdition } from "./edition";
import { usesCatalogue, catalogueRenderBudget } from "./page-data";

export async function loadPageData(
  route: string,
  requestedEdition?: "real" | "demo",
) {
  const parts = route.split("/");
  const ppv =
    route.startsWith("watch/") && isBroadcastId(route.split("/")[1] || "");
  const detail =
    !ppv && ["match", "watch"].includes(parts[0] || "") && parts.length === 2;
  const [snapshot, news] = await Promise.all([
    usesCatalogue(route) &&
    resolveEdition(requestedEdition) === "demo" &&
    route !== "watch" &&
    !ppv &&
    !detail
      ? loadEvents(requestedEdition, catalogueRenderBudget(route), {
          sport:
            parts[0] === "sport"
              ? sports.find(
                  (s) => s.toLowerCase().replaceAll(" ", "-") === parts[1],
                )
              : undefined,
        })
      : Promise.resolve({
          data: [],
          source: "",
          edition: resolveEdition(requestedEdition),
          coverage: [],
        }),
    route === "" || route === "news" ? loadNews() : Promise.resolve(null),
  ]);
  // Detail routes request only their fixture, never the all-sport feed first.
  const match = detail
    ? await loadEvent(parts[1]!, resolveEdition(requestedEdition), true)
    : null;
  const feed = match
    ? {
        ...snapshot,
        // Related broadcasts load independently. Never serialize hundreds of
        // unrelated fixtures into an individual game's document.
        data: [match],
      }
    : snapshot;
  return { feed, news };
}
