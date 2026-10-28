/** Compare against the actual HTTP Host. Next may normalize nextUrl.hostname to
 * localhost internally even when the browser uses 127.0.0.1. Browser scripts
 * cannot choose the Host header; an absent or cross-origin Origin is denied. */
export function validOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    const actual = new URL(origin);
    const configured = process.env.APP_ORIGIN;
    if (configured) return actual.origin === configured;
    return (
      actual.host === request.headers.get("host") &&
      actual.protocol === new URL(request.url).protocol
    );
  } catch {
    return false;
  }
}
