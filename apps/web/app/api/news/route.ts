import { apiUrl } from "../../lib/api-url";
import { newsFeedSchema } from "@backinit/domain";
export async function GET() {
  try {
    const response = await fetch(apiUrl("/news"), {
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error();
    const feed = newsFeedSchema.parse(await response.json());
    return Response.json(feed, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json(
      {
        data: [],
        status: "unavailable",
        message:
          "News updates are temporarily unavailable. Please retry shortly.",
        fetchedAt: null,
      },
      { status: 503 },
    );
  }
}
