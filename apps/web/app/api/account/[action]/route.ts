import { validOrigin } from "../../../lib/origin";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
const actions = new Set([
  "register",
  "login",
  "logout",
  "me",
  "favorites",
  "saved-events",
]);
async function handle(
  request: NextRequest,
  context: { params: Promise<{ action: string }> },
) {
  const { action } = await context.params;
  if (!actions.has(action)) return new Response("Not found", { status: 404 });
  if (request.method !== "GET" && !validOrigin(request))
    return Response.json(
      { message: "Request origin was rejected. Reload this page and retry." },
      { status: 403 },
    );
  if (Number(request.headers.get("content-length")) > 4096)
    return new Response("Request too large", { status: 413 });
  try {
    const token = (await cookies()).get("backinit-session")?.value;
    const body = request.method === "GET" ? undefined : await request.text();
    if (body && body.length > 4096)
      return new Response("Request too large", { status: 413 });
    const upstream = await fetch(
      `${process.env.API_URL || "http://127.0.0.1:4000"}/account/${action}`,
      {
        method: request.method,
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body,
        cache: "no-store",
        signal: AbortSignal.timeout(10000),
      },
    );
    const result = await upstream.json();
    const session = result.token;
    delete result.token;
    const response = NextResponse.json(result, {
      status: upstream.status,
      headers: { "Cache-Control": "no-store" },
    });
    if (session && upstream.ok)
      response.cookies.set("backinit-session", session, {
        httpOnly: true,
        secure: request.nextUrl.protocol === "https:",
        sameSite: "lax",
        path: "/",
        maxAge: 7 * 86400,
      });
    if (action === "logout" && upstream.ok)
      response.cookies.delete("backinit-session");
    return response;
  } catch {
    return NextResponse.json(
      { message: "Account service unavailable. Please retry." },
      { status: 503 },
    );
  }
}
export const GET = handle;
export const POST = handle;
export const DELETE = handle;
