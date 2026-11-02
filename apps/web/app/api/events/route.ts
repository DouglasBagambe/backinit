import { sportSchema } from "@backinit/domain";
import { cookies } from "next/headers";
import { loadEvents } from "../../lib/feed";
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const sport = params.get("sport") || undefined;
  const date = params.get("date") || undefined;
  if (
    (sport && !sportSchema.safeParse(sport).success) ||
    (date &&
      (!/^20\d{2}-\d{2}-\d{2}$/.test(date) ||
        !Number.isFinite(Date.parse(`${date}T12:00:00Z`)) ||
        new Date(`${date}T12:00:00Z`).toISOString().slice(0, 10) !== date))
  )
    return Response.json({ message: "Invalid event filters" }, { status: 400 });
  const selected = (await cookies()).get("backinit-edition")?.value;
  const feed = await loadEvents(
    selected === "demo" ? "demo" : selected === "real" ? "real" : undefined,
    12000,
    { sport, date },
  );
  const unavailable = feed.coverage.some(
    (c) => c.provider === "Sports API" && c.status === "unavailable",
  );
  return Response.json(feed, {
    status: unavailable ? 503 : 200,
    headers: { "Cache-Control": "no-store" },
  });
}
