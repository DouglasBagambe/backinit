/** Public installs default to real data. Demo mode is an explicit isolated-test opt-in. */
export function demoEnabled() {
  return process.env.ALLOW_DEMO_MODE === "true";
}
export function resolveEdition(requested?: string): "real" | "demo" {
  return demoEnabled() &&
    (requested === "demo" ||
      (!requested && process.env.SPORTS_DATA_MODE === "demo"))
    ? "demo"
    : "real";
}
