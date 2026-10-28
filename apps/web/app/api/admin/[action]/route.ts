import { validOrigin } from "../../../lib/origin";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";
async function handle(
  request: NextRequest,
  { params }: { params: Promise<{ action: string }> },
) {
  const { action } = await params;
  if (!["sources", "audit", "source-check", "fixtures"].includes(action))
    return new Response("Not found", { status: 404 });
  if (request.method !== "GET" && !validOrigin(request))
    return Response.json(
      { message: "Request origin was rejected. Reload this page and retry." },
      { status: 403 },
    );
  const token = (await cookies()).get("backinit-session")?.value;
  if (!token)
    return Response.json(
      { message: "Sign in as an administrator." },
      { status: 401 },
    );
  const body = request.method === "POST" ? await request.text() : undefined;
  if (body && body.length > 8192)
    return new Response("Request too large", { status: 413 });
  try {
    const response = await fetch(
      `${process.env.API_URL || "http://127.0.0.1:4000"}/admin/${action}${action === "source-check" && request.method === "GET" ? `?id=${encodeURIComponent(request.nextUrl.searchParams.get("id") || "")}` : ""}`,
      {
        method: request.method,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body,
        cache: "no-store",
        signal: AbortSignal.timeout(15000),
      },
    );
    return Response.json(await response.json(), {
      status: response.status,
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return Response.json(
      { message: "Administration service unavailable." },
      { status: 503 },
    );
  }
}
export const GET = handle;
export const POST = handle;
