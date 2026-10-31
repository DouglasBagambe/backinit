import { apiUrl } from "../../../../lib/api-url";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const theme =
    new URL(request.url).searchParams.get("theme") === "dark"
      ? "dark"
      : "light";
  if (!/^[a-z0-9-]{1,80}$/.test(id))
    return new Response("Invalid event", { status: 400 });
  const headers = {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store",
    // Third-party document gets an opaque origin, never BackInIt's cookies or DOM.
    "Content-Security-Policy":
      "sandbox allow-scripts allow-popups; object-src 'none'; base-uri https://sportscore.com; form-action 'none'; frame-ancestors 'self'",
    "Referrer-Policy": "strict-origin-when-cross-origin",
  };
  try {
    const response = await fetch(
      apiUrl(`/trackers/${id}/view?theme=${theme}`),
      { cache: "no-store", signal: AbortSignal.timeout(28000) },
    );
    if (
      !response.ok ||
      !response.headers.get("content-type")?.includes("text/html")
    )
      throw new Error();
    return new Response(await response.text(), { headers });
  } catch {
    return new Response(
      `<!doctype html><script>parent.postMessage({type:'backinit:tracker-error',eventId:${JSON.stringify(id)}},'*')</script>`,
      { status: 503, headers },
    );
  }
}
