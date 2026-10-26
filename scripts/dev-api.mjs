// Preserve TypeScript decorator metadata and a single ESM graph in development.
import { spawn, spawnSync } from "node:child_process";
const compiled = spawnSync("tsc", ["-p", "tsconfig.build.json"], {
  stdio: "inherit",
});
if (compiled.status !== 0) process.exit(compiled.status ?? 1);
const compiler = spawn(
  "tsc",
  ["-p", "tsconfig.build.json", "--watch", "--preserveWatchOutput"],
  { stdio: "inherit" },
);
const server = spawn(
  process.execPath,
  ["--watch", "dist/apps/api/src/main.js"],
  { stdio: "inherit" },
);
let closing = false;
function stop(code = 0) {
  if (closing) return;
  closing = true;
  compiler.kill();
  server.kill();
  process.exitCode = code;
}
process.on("SIGINT", () => stop());
process.on("SIGTERM", () => stop());
compiler.on("exit", (code) => stop(code ?? 0));
server.on("exit", (code) => stop(code ?? 0));
