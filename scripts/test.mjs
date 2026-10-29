import { spawn, execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
let container;
const env = { ...process.env };
try {
  // Reuse the existing CI test step; no workflow permission or database secret is required.
  if (env.GITHUB_ACTIONS === "true" && !env.POSTGRES_TEST_URL) {
    const password = randomUUID();
    container = execFileSync(
      "docker",
      [
        "run",
        "--detach",
        "--rm",
        "--publish",
        "127.0.0.1::5432",
        "--env",
        "POSTGRES_DB=backinit_test",
        "--env",
        "POSTGRES_USER=backinit_test",
        "--env",
        "POSTGRES_PASSWORD",
        "postgres:17",
      ],
      {
        env: { ...env, POSTGRES_PASSWORD: password },
        encoding: "utf8",
        stdio: ["ignore", "pipe", "inherit"],
      },
    ).trim();
    let ready = false;
    for (let attempt = 0; attempt < 60; attempt++) {
      try {
        execFileSync(
          "docker",
          [
            "exec",
            container,
            "pg_isready",
            "-h",
            "127.0.0.1",
            "-U",
            "backinit_test",
            "-d",
            "backinit_test",
          ],
          { stdio: "ignore" },
        );
        ready = true;
        break;
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }
    if (!ready) throw new Error("Isolated CI PostgreSQL failed to start");
    const address = execFileSync("docker", ["port", container, "5432/tcp"], {
      encoding: "utf8",
    }).trim();
    const port = address.split(":").at(-1);
    if (!/^\d+$/.test(port)) throw new Error("Invalid CI PostgreSQL port");
    env.POSTGRES_TEST_URL = `postgres://backinit_test:${password}@127.0.0.1:${port}/backinit_test`;
    console.log("Isolated PostgreSQL 17 ready for account integration tests.");
  }
  const child = spawn(
    "pnpm",
    ["exec", "vitest", "run", ...process.argv.slice(2)],
    { env, stdio: "inherit" },
  );
  process.exitCode = await new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code) => resolve(code ?? 1));
  });
} finally {
  if (container)
    execFileSync("docker", ["stop", container], {
      stdio: "ignore",
      timeout: 30000,
    });
}
