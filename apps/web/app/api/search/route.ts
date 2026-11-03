import { apiUrl } from "../../lib/api-url";
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const q = (params.get("q") || "").trim();
  if (q.length < 2 || q.length > 80)
    return Response.json({ data: [] }, { status: 400 });
  const query = new URLSearchParams({ q });
  try {
    const r = await fetch(apiUrl(`/search?${query}`), {
      signal: AbortSignal.timeout(10000),
      cache: "no-store",
    });
    if (!r.ok) throw Error();
    return Response.json(await r.json(), {
      headers: { "Cache-Control": "public, max-age=60" },
    });
  } catch {
    return Response.json({ message: "Could not load search" }, { status: 503 });
  }
}
