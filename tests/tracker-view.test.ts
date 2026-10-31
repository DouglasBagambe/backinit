import { expect, it, vi } from "vitest";
import { trackerView } from "../apps/api/src/providers/tracker-view";
const source = {
  provider: "SportScore",
  eventId: "match-one",
  kind: "publisher-tracker",
  url: "https://sportscore.com/embed/tracker/tennis/a-vs-b/",
  sourceUrl: "https://sportscore.com/",
  checkedAt: new Date().toISOString(),
  validUntil: new Date(Date.now() + 120000).toISOString(),
};
it("relays only a current matched public embed and preserves its widget and attribution", async () => {
  const fetcher = vi.fn(
    async () =>
      new Response(
        '<html><head></head><body><iframe src="https://widgets.thesports01.com/widget"></iframe><a href="https://sportscore.com/">Publisher attribution</a></body></html>',
        { headers: { "content-type": "text/html" } },
      ),
  );
  const html = await trackerView(source, "dark", fetcher);
  expect(fetcher.mock.calls).toHaveLength(1);
  expect(html).toContain('base href="https://sportscore.com/"');
  expect(html).toContain("backinit:tracker-ready");
  expect(html).toContain("Publisher attribution");
  expect(html).toContain("https://widgets.thesports01.com/widget");
});
it("rejects arbitrary destinations, expired leases and CDN/error pages", async () => {
  const fetcher = vi.fn(
    async () =>
      new Response(
        "<html><head></head><body>Gateway unavailable</body></html>",
        { headers: { "content-type": "text/html" } },
      ),
  );
  await expect(
    trackerView({ ...source, url: "https://evil.test/" }, "light", fetcher),
  ).rejects.toThrow();
  await expect(
    trackerView(
      { ...source, validUntil: new Date(0).toISOString() },
      "light",
      fetcher,
    ),
  ).rejects.toThrow();
  expect(fetcher).not.toHaveBeenCalled();
  await expect(trackerView(source, "light", fetcher)).rejects.toThrow(
    "Publisher widget missing",
  );
});

it("serves relay failures as a sandboxed recovery message, never a ready event", async () => {
  const { GET } = await import("../apps/web/app/api/trackers/[id]/view/route");
  vi.stubEnv("API_BACKEND", "external");
  vi.stubEnv("API_URL", "https://backend.example.test");
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response("provider failed", { status: 503 })),
  );
  try {
    const response = await GET(
      new Request("https://backinit.live/api/trackers/match-one/view"),
      { params: Promise.resolve({ id: "match-one" }) },
    );
    expect(response.status).toBe(503);
    expect(response.headers.get("Content-Security-Policy")).toContain(
      "sandbox allow-scripts allow-popups;",
    );
    expect(response.headers.get("Content-Security-Policy")).not.toContain(
      "allow-same-origin",
    );
    const html = await response.text();
    expect(html).toContain("backinit:tracker-error");
    expect(html).not.toContain("backinit:tracker-ready");
  } finally {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  }
});
