import { loadCatalogueFromBases } from "../apps/native/src/api-client";
import { afterEach, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllGlobals();
});

it("loads the complete native catalogue from the fallback API", async () => {
  const fetchMock = vi.fn(async (input: string | URL | Request) => {
    const url = String(input);
    if (url.startsWith("https://primary.example")) {
      return new Response("unavailable", { status: 503 });
    }
    if (url.endsWith("/broadcasts")) {
      return Response.json({
        data: [
          {
            id: "match-1",
            title: "Match one",
            category: "Football",
            competition: "League",
            poster: null,
            start: 1,
            end: 2,
            channel: false,
            sources: [
              {
                id: "source-1",
                label: "Stream 1",
                url: "https://video.example",
              },
            ],
            replay: false,
          },
        ],
      });
    }
    return Response.json({
      data: [
        {
          id: "video-1",
          name: "Highlights",
          url: "https://video.example/highlights",
          rightsOwner: "Publisher",
        },
      ],
    });
  });
  vi.stubGlobal("fetch", fetchMock);

  const catalogue = await loadCatalogueFromBases([
    "https://primary.example",
    "https://backinit-api-pgaq.onrender.com",
  ]);

  expect(catalogue.broadcasts).toHaveLength(1);
  expect(catalogue.videos).toHaveLength(1);
  expect(fetchMock).toHaveBeenCalledWith(
    "https://backinit-api-pgaq.onrender.com/broadcasts",
    expect.any(Object),
  );
  expect(fetchMock).toHaveBeenCalledWith(
    "https://backinit-api-pgaq.onrender.com/videos",
    expect.any(Object),
  );
});
