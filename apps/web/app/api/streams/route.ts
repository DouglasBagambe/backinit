import { streamSourceSchema } from "@backinit/domain";
import { NextRequest } from "next/server";
import { z } from "zod";
export async function GET(request: NextRequest) {
  const event = request.nextUrl.searchParams.get("event");
  const library = request.nextUrl.searchParams.get("library") === "1";
  if (event && !/^[a-z0-9-]{1,80}$/.test(event))
    return new Response("Invalid event", { status: 400 });
  try {
    const upstream = await fetch(
      `${process.env.API_URL || "http://127.0.0.1:4000"}/streams${event ? `?event=${event}` : library ? "?library=1" : ""}`,
      { cache: "no-store", signal: AbortSignal.timeout(2000) },
    );
    if (!upstream.ok) throw new Error();
    return Response.json(
      z
        .object({ data: z.array(streamSourceSchema) })
        .parse(await upstream.json()),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      { data: [], message: "Source registry unavailable" },
      { status: 503 },
    );
  }
}
