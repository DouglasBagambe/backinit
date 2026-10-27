import { streamSourceSchema } from "@backinit/domain";
import { z } from "zod";
export async function GET() {
  try {
    const response = await fetch(
      `${process.env.API_URL || "http://127.0.0.1:4000"}/watch`,
      { cache: "no-store", signal: AbortSignal.timeout(20000) },
    );
    if (!response.ok) throw new Error();
    const body = z
      .object({
        data: z.array(streamSourceSchema),
        coverage: z.array(
          z.object({
            publisher: z.string(),
            sport: z.string(),
            status: z.string(),
            message: z.string(),
          }),
        ),
      })
      .parse(await response.json());
    return Response.json(body, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json(
      {
        data: [],
        coverage: [],
        message:
          "Official video catalog is temporarily unavailable. Retry shortly.",
      },
      { status: 503 },
    );
  }
}
