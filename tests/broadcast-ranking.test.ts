import { it, expect } from "vitest";
import {
  broadcastImportance,
  compareBroadcasts,
} from "../apps/web/app/lib/broadcast-ranking";
import type { Broadcast } from "../packages/domain/src/index";
const now = Date.now();
const game = (
  title: string,
  competition = "League",
  start = now + 3600000,
): Broadcast => ({
  id: title,
  title,
  competition,
  category: "Football",
  start,
  end: start + 7200000,
  channel: false,
  viewers: null,
  poster: null,
  pageUrl: "https://ppv.st",
  sources: [],
  replay: false,
});
it("ranks a marquee upcoming rivalry above ordinary live and earlier games", () => {
  const big = game(
    "Chelsea vs. Manchester United",
    "Premier League",
    now + 86400000,
  );
  const live = game("Home vs. Away", "Premier League", now - 1000);
  const earlier = game("Other vs. Another", "League", now + 1000);
  expect(
    [live, earlier, big].sort((a, b) => compareBroadcasts(a, b, now))[0],
  ).toBe(big);
  expect(broadcastImportance(big)).toBeGreaterThanOrEqual(1000);
  expect(
    broadcastImportance(game("Man Utd vs Chelsea")),
  ).toBeGreaterThanOrEqual(1000);
  expect(broadcastImportance(game("One vs Two", "Quarterfinal"))).toBeLessThan(
    1000,
  );
});
it("keeps ordinary live games ahead of regular upcoming games and recognizes major finals", () => {
  const live = game("Home vs Away", "League", now - 1000);
  const upcoming = game("Arsenal vs Other", "Premier League");
  expect(compareBroadcasts(live, upcoming, now)).toBeLessThan(0);
  expect(broadcastImportance(game("A vs B", "NBA Finals"))).toBe(1200);
});
