import { isBroadcastId } from "@backinit/domain";
import { apiUrl } from "../../../../lib/api-url";
import { eventSchema } from "@backinit/domain";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!isBroadcastId(id)) return Response.json({ data: null }, { status: 400 });
  try {
    const response = await fetch(apiUrl(`/broadcasts/${id}/event`), {
      next: { revalidate: 30 },
      signal: AbortSignal.timeout(14000),
    });
    if (!response.ok) throw Error();
    const body = await response.json();
    return Response.json({
      data: body.data === null ? null : eventSchema.parse(body.data),
    });
  } catch {
    return Response.json(
      { data: null, message: "Match tracking is temporarily unavailable." },
      { status: 503 },
    );
  }
}
