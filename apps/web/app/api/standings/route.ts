import { apiUrl } from "../../lib/api-url";
export async function GET(request: Request) {
  const league = new URL(request.url).searchParams.get("league") || "";
  if (
    !["eng.1", "esp.1", "ger.1", "ita.1", "fra.1", "ned.1", "por.1"].includes(
      league,
    )
  )
    return Response.json({ message: "Unsupported league" }, { status: 400 });
  try {
    const response = await fetch(apiUrl(`/standings?league=${league}`), {
      signal: AbortSignal.timeout(10000),
      cache: "no-store",
    });
    if (!response.ok) throw Error();
    return Response.json(await response.json(), {
      headers: { "Cache-Control": "public, max-age=60" },
    });
  } catch {
    return Response.json(
      { message: "Standings could not load" },
      { status: 503 },
    );
  }
}
