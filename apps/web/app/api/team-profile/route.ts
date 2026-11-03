import { apiUrl } from "../../lib/api-url";
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const sport = params.get("sport") || "",
    league = params.get("league") || "",
    id = params.get("id") || "";
  if (
    !/^[a-z]{2,20}$/.test(sport) ||
    !/^[a-z0-9.]{1,40}$/.test(league) ||
    !/^\d{1,15}$/.test(id)
  )
    return Response.json({ message: "Invalid profile" }, { status: 400 });
  const query = new URLSearchParams({ sport, league, id });
  try {
    const r = await fetch(apiUrl(`/team-profile?${query}`), {
      signal: AbortSignal.timeout(10000),
      cache: "no-store",
    });
    if (!r.ok) throw Error();
    return Response.json(await r.json(), {
      headers: { "Cache-Control": "public, max-age=60" },
    });
  } catch {
    return Response.json(
      { message: "Could not load team-profile" },
      { status: 503 },
    );
  }
}
