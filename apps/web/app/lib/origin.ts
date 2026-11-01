/** Compare against the actual HTTP Host. Next may normalize nextUrl.hostname to
 * localhost internally even when the browser uses 127.0.0.1. Browser scripts
 * cannot choose the Host header; an absent or cross-origin Origin is denied. */
export function validOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    const actual = new URL(origin);
    const configured = process.env.APP_ORIGIN;
    if (configured) {
      const canonical = new URL(configured);
      if (actual.origin === canonical.origin) return true;
      // Both public production hosts serve the application. Keep the alias
      // narrowly scoped; previews, arbitrary subdomains and ports are not trusted.
      // The public reverse proxy can replace Host with its upstream hostname.
      // Trust the browser's exact Origin allowlist rather than that rewritten Host.
      const productionHosts = new Set(["backinit.live", "www.backinit.live"]);
      return (
        canonical.protocol === "https:" &&
        !canonical.port &&
        productionHosts.has(canonical.hostname) &&
        actual.protocol === "https:" &&
        !actual.port &&
        productionHosts.has(actual.hostname)
      );
    }
    return (
      actual.host === request.headers.get("host") &&
      actual.protocol === new URL(request.url).protocol
    );
  } catch {
    return false;
  }
}
