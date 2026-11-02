// Read-only HTTP baseline. Does not execute ads, start video, or count media playback.
import { writeFile } from "node:fs/promises";
const base = process.argv[2] || "http://127.0.0.1:3000";
const out = process.argv[3];
const paths = [
  "/",
  "/watch",
  "/fixtures",
  "/news",
  "/watch/ppv-27496",
  "/api/broadcasts",
];
const results = [];
for (const path of paths) {
  for (let sample = 0; sample < 2; sample++) {
    const start = performance.now();
    try {
      const r = await fetch(new URL(path, base), {
        signal: AbortSignal.timeout(20000),
      });
      const headers = performance.now();
      const bytes = await r.arrayBuffer();
      results.push({
        path,
        sample,
        status: r.status,
        headersMs: Math.round(headers - start),
        totalMs: Math.round(performance.now() - start),
        bytes: bytes.byteLength,
        cache: r.headers.get("x-vercel-cache"),
      });
    } catch (e) {
      results.push({ path, sample, error: e.cause?.code || e.name });
    }
  }
}
const report = {
  at: new Date().toISOString(),
  base,
  note: "First and repeat HTTP samples; not first paint, video startup, or cold-start guarantees.",
  results,
};
if (out) await writeFile(out, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
