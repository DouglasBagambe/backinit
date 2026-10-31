import { expect, it } from "vitest";
import { watchFeed } from "../apps/api/src/watch-feed";
import { verifiedCupFixtures } from "../apps/api/src/providers/efl";
import {
  watchFeedSchema,
  type StreamSource,
} from "../packages/domain/src/index";

it("transfers only Watch-eligible games, retaining live broadcasts and reported trackers", () => {
  const base = verifiedCupFixtures[0]!;
  const tracked = {
    ...base,
    id: "tracked",
    status: "live" as const,
    scheduleOnly: false,
    homeScore: 1,
    awayScore: 0,
    source: { ...base.source!, stale: false },
  };
  const finished = { ...tracked, id: "finished", status: "finished" as const };
  const broadcast = { ...base, id: "broadcast", status: "live" as const };
  const video: StreamSource = {
    id: "test-video",
    name: "Isolated test publisher",
    type: "embed",
    url: "https://www.youtube-nocookie.com/embed/PM5UPYoDvf0",
    content: "sports",
    eventId: broadcast.id,
    presentation: "live",
    rightsOwner: "Test only",
    rightsEvidence: "https://example.test",
    territory: "PROVIDER",
    validFrom: "2026-01-01T00:00:00Z",
    validUntil: "2099-01-01T00:00:00Z",
    version: 1,
    revoked: false,
  };
  const result = watchFeed(
    {
      data: [base, finished, tracked, broadcast],
      coverage: [],
      edition: "real",
      source: "Test",
    },
    base.start.slice(0, 10),
    (e) => (e.id === broadcast.id ? [video] : []),
  );
  expect(result.data.map((x) => x.event.id)).toEqual([
    tracked.id,
    broadcast.id,
  ]);
  expect(result.data[1]?.availability).toBe("in-page");
  expect(watchFeedSchema.safeParse(result).success).toBe(true);
});
