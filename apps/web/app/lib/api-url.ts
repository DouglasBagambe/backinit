/** Server runtime only: Vercel injects the service binding per deployment. */
export function apiUrl(path: string): URL {
  const base =
    process.env.API_INTERNAL_URL ||
    (process.env.VERCEL !== "1"
      ? process.env.API_URL || "http://127.0.0.1:4000"
      : undefined);
  if (!base) throw new Error("Missing api service binding: API_INTERNAL_URL");
  // Preserve any path in the generated binding base, including its trailing slash.
  return new URL(path.replace(/^\/+/, ""), `${base.replace(/\/+$/, "")}/`);
}
