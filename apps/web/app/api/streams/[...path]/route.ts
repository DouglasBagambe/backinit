import { apiUrl } from "../../../lib/api-url";
import { NextRequest } from "next/server";
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  if (
    path.length !== 2 ||
    path[1] !== "health" ||
    !/^[a-z0-9-]{1,80}$/.test(path[0]!)
  )
    return new Response("Not found", { status: 404 });
  try {
    const response = await fetch(apiUrl(`/streams/${path[0]}/health`), {
      cache: "no-store",
      signal: AbortSignal.timeout(6000),
    });
    return Response.json(await response.json(), {
      status: response.status,
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return Response.json({
      status: "unknown",
      message: "Availability check failed. You may still try playback.",
    });
  }
}
