import { loadEvent } from "../../../lib/feed";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!/^[a-z0-9-]{1,80}$/.test(id))
    return new Response("Invalid event", { status: 400 });
  const event = await loadEvent(id, "real");
  return Response.json(
    event ? { data: event } : { message: "Match updates unavailable" },
    {
      status: event ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
