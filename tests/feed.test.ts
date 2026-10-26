import { afterEach, describe, it, expect, vi } from "vitest";
import { loadEvents } from "../apps/web/app/lib/feed";
import { events } from "../packages/domain/src/index";
afterEach(() => vi.unstubAllGlobals());
describe("server feed boundary", () => {
  it("uses validated API events when available", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(Response.json({ data: events })),
    );
    expect((await loadEvents()).source).toBe("Demo API connected");
  });
  it("labels fallback on network failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    const result = await loadEvents();
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
    const result = await loadEvents();
    expect(result.source).toContain("fallback");
    expect(result.data.every((e) => e.provenance === "demo")).toBe(true);
  });
  it("rejects unsuccessful HTTP responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("failure", { status: 503 })),
    );
    expect((await loadEvents()).source).toContain("fallback");
  });
});
