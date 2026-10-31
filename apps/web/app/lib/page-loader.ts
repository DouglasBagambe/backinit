import { loadEvents, loadEvent } from "./feed";
import { loadNews } from "./news";
import { resolveEdition } from "./edition";
import { usesCatalogue, catalogueRenderBudget } from "./page-data";

export async function loadPageData(
  route: string,
  requestedEdition?: "real" | "demo",
) {
  const parts = route.split("/");
  const detail =
    ["match", "watch"].includes(parts[0] || "") && parts.length === 2;
  const [snapshot, news] = await Promise.all([
    usesCatalogue(route) && route !== "watch"
      ? loadEvents(requestedEdition, catalogueRenderBudget(route))
      : Promise.resolve({
          data: [],
          source: "",
          edition: resolveEdition(requestedEdition),
          coverage: [],
        }),
    route === "" || route === "news" ? loadNews() : Promise.resolve(null),
  ]);
  // A known fixture can paint immediately; the viewing page refreshes its
  // detailed stats separately instead of holding the whole navigation.
  const known = detail
    ? snapshot.data.find((event) => event.id === parts[1])
    : null;
  const match = detail
    ? known || (await loadEvent(parts[1]!, resolveEdition(requestedEdition)))
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
