import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { loadEvents, loadEvent } from "../apps/web/app/lib/feed";
import { events } from "../packages/domain/src/index";
beforeEach(() => {
  vi.stubEnv("ALLOW_DEMO_MODE", "true");
  vi.stubEnv("APP_ORIGIN", "http://127.0.0.1:3100");
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
describe("server feed boundary", () => {
  it("uses validated API events when available", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json({
          data: events,
          source: "Demo API connected",
          edition: "demo",
          coverage: [],
        }),
      ),
    );
    expect((await loadEvents("demo")).source).toBe("Demo API connected");
  });
  it("labels fallback on network failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    const result = await loadEvents("demo");
    expect(result.source).toContain("API unavailable");
    expect(result.data).toHaveLength(8);
  });
  it("rejects unvalidated provider payloads rather than showing them", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          Response.json({ data: [{ id: "bad", provenance: "real" }] }),
        ),
    );
    const result = await loadEvents("demo");
    expect(result.source).toContain("fallback");
    expect(result.data.every((e) => e.provenance === "demo")).toBe(true);
  });
  it("rejects unsuccessful HTTP responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("failure", { status: 503 })),
    );
    expect((await loadEvents("demo")).source).toContain("fallback");
  });
});

it("never substitutes demo data in the real edition", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
  const result = await loadEvents("real");
  expect(result.data).toEqual([]);
  expect(result.source).toContain("no demo substitution");
});

it("rejects demo provenance on real event detail requests", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(events[0])));
  expect(await loadEvent(events[0]!.id, "real")).toBeNull();
});
it("forces real data for an old demo preference on a public installation", async () => {
  vi.stubEnv("ALLOW_DEMO_MODE", undefined);
  const fetcher = vi.fn().mockResolvedValue(
    Response.json({
      data: events,
      source: "Wrong demo server",
      edition: "demo",
      coverage: [],
    }),
  );
  vi.stubGlobal("fetch", fetcher);
  const result = await loadEvents("demo");
  expect(result).toMatchObject({ edition: "real", data: [] });
  expect(String(fetcher.mock.calls[0][0])).toContain("edition=real");
});
