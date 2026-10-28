/** Server-only address resolution. A deployed frontend must never call its own loopback. */
export function apiUrl(path: string): URL {
  const base =
    process.env.API_INTERNAL_URL ||
    (process.env.VERCEL !== "1"
      ? process.env.API_URL || "http://127.0.0.1:4000"
      : undefined);
  if (!base) throw new Error("Missing api service binding: API_INTERNAL_URL");
  const url = new URL(base);
  if (
    !["https:", "http:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw new Error("Invalid API address");
  if (
    path.startsWith("//") ||
    path.includes("\\") ||
    /^[a-z][a-z0-9+.-]*:/i.test(path) ||
    path.split("/").includes("..")
  )
    throw new Error("Invalid API path");
  return new URL(path.replace(/^\//, ""), `${url.href.replace(/\/+$/, "")}/`);
}
