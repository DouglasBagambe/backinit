import { apiUrl } from "../../lib/api-url";
import { broadcastFeedSchema } from "@backinit/domain";
export async function GET() {
  try {
    const response = await fetch(apiUrl("/broadcasts"), {
      next: { revalidate: 60 },
      signal: AbortSignal.timeout(9000),
    });
    if (!response.ok) throw Error();
    const feed = broadcastFeedSchema.parse(await response.json());
    return Response.json(feed, {
      status: feed.updatedAt ? 200 : 503,
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    });
  } catch {
    return Response.json(
      {
        data: [],
        updatedAt: null,
        stale: true,
        message:
          "Broadcast catalogue is temporarily unavailable. Retry shortly.",
      },
      { status: 503 },
    );
  }
}
