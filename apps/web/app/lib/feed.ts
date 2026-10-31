import { apiUrl } from "./api-url";
import {
  DemoProvider,
  feedSchema,
  eventSchema,
  freshEventFeed,
  type EventFeed,
} from "@backinit/domain";
import { resolveEdition } from "./edition";
export async function loadEvents(
  edition: "real" | "demo" = resolveEdition(),
  timeout = 20000,
): Promise<EventFeed> {
  edition = resolveEdition(edition);
  try {
    const response = await fetch(apiUrl(`/events?edition=${edition}`), {
      signal: AbortSignal.timeout(timeout),
      cache: "force-cache",
      next: { revalidate: 10 },
    });
    if (!response.ok) throw new Error("Provider unavailable");
    const body = feedSchema.parse(await response.json());
    if (
      body.edition !== edition ||
      body.data.some(
        (e) => e.provenance !== (edition === "real" ? "provider" : "demo"),
      )
    )
      throw new Error("Mismatched provenance");
    return freshEventFeed(body);
  } catch {
    return edition === "demo"
      ? {
          data: await new DemoProvider().getEvents(),
          source: "Local demo fallback · API unavailable",
          edition,
          coverage: [],
        }
      : {
          data: [],
          source: "Sports API unavailable · no demo substitution",
          edition,
          coverage: [
            {
              provider: "Sports API",
              sport: "All",
              status: "unavailable",
              message: "Cannot reach the sports API. Try again shortly.",
              fetchedAt: null,
            },
          ],
        };
  }
}
export async function loadEvent(id: string, edition: "real" | "demo") {
  edition = resolveEdition(edition);
  try {
    const response = await fetch(
      apiUrl(`/events/${encodeURIComponent(id)}?edition=${edition}`),
      {
        signal: AbortSignal.timeout(20000),
        cache: "force-cache",
        next: { revalidate: 10 },
      },
    );
    if (!response.ok) return null;
    const event = eventSchema.parse(await response.json());
    return event.provenance === (edition === "real" ? "provider" : "demo")
      ? freshEventFeed({
          data: [event],
          edition,
          source: "Public match",
          coverage: [],
        }).data[0]!
      : null;
  } catch {
    return null;
  }
}
