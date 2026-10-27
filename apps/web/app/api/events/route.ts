import { cookies } from "next/headers";
import { loadEvents } from "../../lib/feed";
export async function GET() {
  const selected = (await cookies()).get("backinit-edition")?.value;
  return Response.json(
    await loadEvents(
      selected === "demo" ? "demo" : selected === "real" ? "real" : undefined,
    ),
    { headers: { "Cache-Control": "no-store" } },
  );
}
