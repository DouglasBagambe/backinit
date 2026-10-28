import { watchFeedSchema } from "@backinit/domain";
export async function GET(request: Request) {
  const date = new URL(request.url).searchParams.get("date");
  if (date && !/^20\d{2}-\d{2}-\d{2}$/.test(date))
    return Response.json({ message: "Invalid date" }, { status: 400 });
  try {
    const response = await fetch(
      `${process.env.API_URL || "http://127.0.0.1:4000"}/watch${date ? `?date=${encodeURIComponent(date)}` : ""}`,
      { cache: "no-store", signal: AbortSignal.timeout(15000) },
    );
    if (!response.ok) throw new Error();
    return Response.json(watchFeedSchema.parse(await response.json()), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return Response.json(
      {
        data: [],
        coverage: [],
        generatedAt: new Date().toISOString(),
        message: "Event discovery is temporarily unavailable. Please retry.",
      },
      { status: 503 },
    );
  }
}
