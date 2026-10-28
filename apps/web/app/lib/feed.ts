import {
  DemoProvider,
  feedSchema,
  eventSchema,
  type EventFeed,
} from "@backinit/domain";
export async function loadEvents(
  edition: "real" | "demo" = process.env.SPORTS_DATA_MODE === "demo"
    ? "demo"
    : "real",
): Promise<EventFeed> {
  try {
    const response = await fetch(
      `${process.env.API_URL || "http://127.0.0.1:4000"}/events?edition=${edition}`,
      { signal: AbortSignal.timeout(10000), cache: "no-store" },
    );
    if (!response.ok) throw new Error("Provider unavailable");
    const body = feedSchema.parse(await response.json());
    if (
      body.edition !== edition ||
      body.data.some(
        (e) => e.provenance !== (edition === "real" ? "provider" : "demo"),
      )
    )
      throw new Error("Mismatched provenance");
    return body;
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
  try {
    const response = await fetch(
      `${process.env.API_URL || "http://127.0.0.1:4000"}/events/${encodeURIComponent(id)}?edition=${edition}`,
      { signal: AbortSignal.timeout(10000), cache: "no-store" },
    );
    if (!response.ok) return null;
    const event = eventSchema.parse(await response.json());
    return event.provenance === (edition === "real" ? "provider" : "demo")
      ? event
      : null;
  } catch {
    return null;
  }
}
