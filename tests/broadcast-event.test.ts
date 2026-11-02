import { it, expect } from "vitest";
import { broadcastEvent } from "../apps/api/src/providers/broadcast-event";
import { verifiedCupFixtures } from "../apps/api/src/providers/efl";
import type { Broadcast, SportEvent } from "../packages/domain/src/index";
const event = {
  ...verifiedCupFixtures[0]!,
  kind: "score",
  home: "Chelsea",
  away: "Manchester United",
  sport: "Football",
  provenance: "provider",
} as SportEvent;
const item: Broadcast = {
  id: "ppv-1",
  title: "Chelsea vs Man Utd",
  category: "Football",
  competition: "League",
  start: Date.parse(event.start),
  end: Date.parse(event.start) + 7200000,
  channel: false,
  poster: null,
  viewers: null,
  sources: [],
  pageUrl: "https://ppv.st",
  replay: false,
};
it("binds both participants and kickoff to a real provider fixture", () => {
  expect(broadcastEvent(item, [event])?.id).toBe(event.id);
  expect(
    broadcastEvent({ ...item, title: "Man Utd vs Chelsea" }, [event])?.id,
  ).toBe(event.id);
  for (const change of [
    { title: "Chelsea Women vs Manchester United Women" },
    { start: item.start + 86400000 },
    { category: "Basketball" },
    { channel: true },
  ])
    expect(broadcastEvent({ ...item, ...change }, [event])).toBeNull();
});
it("rejects ambiguous or demo lookalikes instead of attaching the wrong tracker", () => {
  expect(
    broadcastEvent(item, [event, { ...event, id: "different" }]),
  ).toBeNull();
  expect(
    broadcastEvent(item, [{ ...event, provenance: "demo" } as SportEvent]),
  ).toBeNull();
});
