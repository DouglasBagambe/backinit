import { loadEvents } from "../../lib/feed";
export async function GET() {
  return Response.json(await loadEvents(), {
    headers: { "Cache-Control": "no-store" },
  });
}
