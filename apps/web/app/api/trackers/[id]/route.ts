import { apiUrl } from "../../../lib/api-url";
import { trackerSourceSchema } from "@backinit/domain";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!/^[a-z0-9-]{1,80}$/.test(id))
    return new Response("Invalid event", { status: 400 });
  try {
    const response = await fetch(apiUrl(`/trackers/${id}`), {
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error();
    const body = await response.json();
    const data =
      body.data === null ? null : trackerSourceSchema.parse(body.data);
    if (data && data.eventId !== id) throw new Error();
    return Response.json(
      { data },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json({ data: null }, { status: 503 });
  }
}
