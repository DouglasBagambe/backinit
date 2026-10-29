/** Public installs default to real data. Demo mode is an explicit isolated-test opt-in. */
export function demoEnabled() {
  if (process.env.ALLOW_DEMO_MODE !== "true" || process.env.VERCEL === "1")
    return false;
  try {
    const origin = new URL(process.env.APP_ORIGIN || "");
    return ["127.0.0.1", "localhost", "[::1]"].includes(origin.hostname);
  } catch {
    return false;
  }
}
export function resolveEdition(requested?: string): "real" | "demo" {
  return demoEnabled() &&
    (requested === "demo" ||
      (!requested && process.env.SPORTS_DATA_MODE === "demo"))
    ? "demo"
    : "real";
}
