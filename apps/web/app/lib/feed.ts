import { DemoProvider, eventSchema } from "@backinit/domain";
import { z } from "zod";
export async function loadEvents() {
  try {
    const response = await fetch(
      `${process.env.API_URL || "http://127.0.0.1:4000"}/events`,
      { signal: AbortSignal.timeout(1500), cache: "no-store" },
    );
    if (!response.ok) throw new Error("Provider unavailable");
    const body = z
      .object({ data: z.array(eventSchema) })
      .parse(await response.json());
    return { data: body.data, source: "Demo API connected" };
  } catch {
    return {
      data: await new DemoProvider().getEvents(),
      source: "Local demo fallback · API unavailable",
    };
  }
}
