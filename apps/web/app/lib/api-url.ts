/** Server-only address resolution. A deployed frontend must never call its own loopback. */
export function apiUrl(path: string): URL {
  const configured = process.env.API_INTERNAL_URL || process.env.API_URL;
  const base =
    configured ||
    (process.env.VERCEL === "1" ? undefined : "http://127.0.0.1:4000");
  if (!base)
    throw new Error("Configure API_INTERNAL_URL or API_URL for the Nest API.");
  const url = new URL(base);
  if (
    !["https:", "http:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw new Error("Invalid API address");
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\"))
    throw new Error("Invalid API path");
  return new URL(path.slice(1), `${url.href.replace(/\/+$/, "")}/`);
}
