import { cookies } from "next/headers";
import { loadEvents } from "../../lib/feed";
export async function GET() {
  const selected = (await cookies()).get("backinit-edition")?.value;
  const feed = await loadEvents(
    selected === "demo" ? "demo" : selected === "real" ? "real" : undefined,
  );
  const unavailable = feed.coverage.some(
    (c) => c.provider === "Sports API" && c.status === "unavailable",
  );
  return Response.json(feed, {
    status: unavailable ? 503 : 200,
    headers: { "Cache-Control": "no-store" },
  });
}
