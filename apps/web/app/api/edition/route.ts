import { validOrigin } from "../../lib/origin";
import { NextRequest, NextResponse } from "next/server";
export async function POST(request: NextRequest) {
  if (!validOrigin(request))
    return Response.json(
      { message: "Request origin was rejected. Reload this page and retry." },
      { status: 403 },
    );
  const body = await request.json().catch(() => null);
  if (body?.edition !== "demo" && body?.edition !== "real")
    return new Response("Invalid edition", { status: 400 });
  const response = NextResponse.json({ ok: true });
  response.cookies.set("backinit-edition", body.edition, {
    httpOnly: true,
    sameSite: "lax",
    secure: request.nextUrl.protocol === "https:",
    path: "/",
    maxAge: 31536000,
  });
  return response;
}
