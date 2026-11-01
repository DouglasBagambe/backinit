import { completeAfterResponse } from "../../lib/background";
import { apiUrl } from "../../lib/api-url";
import { newsFeedSchema } from "@backinit/domain";
import { NewsService } from "@backinit/news";
const news = new NewsService();
export async function GET() {
  try {
    // The web host has an independent egress route. Keep it independent of a
    // backend-provider network outage, using the same source validation rules.
    const direct = await news.feed();
    if (direct.data.length) {
      if (direct.status === "stale")
        completeAfterResponse(async () => {
          await news.feed({ waitForRefresh: true });
        });
      return Response.json(newsFeedSchema.parse(direct), {
        headers: {
          "Cache-Control":
            direct.status === "available"
              ? "public, s-maxage=300, stale-while-revalidate=60"
              : "no-store",
        },
      });
    }
    const response = await fetch(apiUrl("/news"), {
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error();
    const feed = newsFeedSchema.parse(await response.json());
    return Response.json(feed, {
      headers: {
        "Cache-Control":
          feed.data.length && feed.status === "available"
            ? "public, s-maxage=300, stale-while-revalidate=60"
            : "no-store",
      },
    });
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
