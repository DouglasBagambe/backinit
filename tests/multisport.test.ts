import { describe, it, expect, vi } from "vitest";
import {
  normalizeScoreboard,
  EspnProvider,
  espnLeagues,
} from "../apps/api/src/providers/espn";
import { ProviderCache } from "../apps/api/src/providers/cache";
import { normalizeWwe } from "../apps/api/src/providers/wwe";
import {
  normalizeBwf,
  pageJson,
  publishedVideoIds,
} from "../apps/api/src/providers/bwf";
const at = "2026-10-28T10:00:00Z";
const nba = espnLeagues.find((l) => l.path === "basketball/nba")!;
const state = (state: string, name = "STATUS_IN_PROGRESS") => ({
  type: { state, name, shortDetail: "Q2 4:32" },
});
const match = {
  id: "42",
  date: at,
  status: state("in"),
  competitors: [
    {
      id: "1",
      homeAway: "home",
      team: {
        id: "1",
        displayName: "Home",
        logo: "https://a.espncdn.com/i/home.png",
      },
      score: "51",
      linescores: [{ value: 30 }],
      statistics: [{ name: "rebounds", displayValue: "14" }],
    },
    {
      id: "2",
      homeAway: "away",
      team: { displayName: "Away" },
      score: "44",
      linescores: [{ value: 25 }],
      statistics: [{ name: "rebounds", displayValue: "10" }],
    },
  ],
};
const board = (c = match) => ({
  leagues: [{ name: "NBA" }],
  events: [{ id: "42", name: "Away at Home", date: at, competitions: [c] }],
});
describe("automated multi-sport feeds", () => {
  it("uses provider identities, scores, period totals and statistics", () => {
    const e = normalizeScoreboard(board(), nba, at, false)[0]!;
    expect(e).toMatchObject({
      status: "live",
      kind: "score",
      homeScore: 51,
      awayScore: 44,
      homeParticipant: {
        id: "1",
        imageUrl: "https://a.espncdn.com/i/home.png",
      },
      detail: {
        statistics: [{ label: "rebounds", home: "14", away: "10" }],
        periods: [{ label: "Period 1", home: "30", away: "25" }],
      },
    });
  });
  it("does not report stale live scores as currently live or infer kickoff status", () => {
    expect(normalizeScoreboard(board(), nba, at, true)[0]?.status).toBe(
      "unknown",
    );
    const c = {
      ...match,
      date: "2020-01-01T00:00:00Z",
      status: state("pre", "STATUS_SCHEDULED"),
    };
    expect(normalizeScoreboard(board(c), nba, at, false)[0]).toMatchObject({
      status: "upcoming",
      homeScore: null,
    });
    expect(
      normalizeScoreboard(
        board({ ...match, status: state("pre", "STATUS_POSTPONED") }),
        nba,
        at,
        false,
      )[0]?.status,
    ).toBe("postponed");
  });
  it("reads nested tennis competitions and keeps games separate from match totals", () => {
    const raw = {
      events: [
        {
          id: "cup",
          name: "Basel",
          date: at,
          status: state("post"),
          groupings: [
            {
              competitions: [
                {
                  ...match,
                  competitors: [
                    {
                      id: "a",
                      roster: { displayName: "A / B" },
                      linescores: [{ value: 3 }],
                    },
                    {
                      id: "b",
                      athlete: { displayName: "C" },
                      linescores: [{ value: 5 }],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };
    const e = normalizeScoreboard(
      raw,
      { path: "tennis/atp", sport: "Tennis", label: "ATP" },
      at,
      false,
    )[0];
    expect(e).toMatchObject({
      status: "live",
      home: "A / B",
      homeScore: null,
      awayScore: null,
      detail: { periods: [{ label: "Set 1", home: "3", away: "5" }] },
    });
  });
  it("uses card start and athlete names for UFC, not the first prelim's time", () => {
    const raw = {
      events: [
        {
          id: "card",
          name: "UFC card",
          date: at,
          status: state("pre"),
          competitions: [
            {
              ...match,
              date: "2026-10-28T08:00:00Z",
              competitors: [
                { id: "a", athlete: { fullName: "Fighter A" } },
                { id: "b", athlete: { fullName: "Fighter B" } },
              ],
            },
          ],
        },
      ],
    };
    expect(
      normalizeScoreboard(
        raw,
        { path: "mma/ufc", sport: "MMA", label: "UFC" },
        at,
        false,
      )[0],
    ).toMatchObject({
      kind: "card",
      start: new Date(at).toISOString(),
      bouts: [{ performers: ["Fighter A", "Fighter B"] }],
    });
  });
  it("refreshes live scores after TTL and retains a marked snapshot on provider failure", async () => {
    let time = Date.parse(at);
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(Response.json(board()))
      .mockResolvedValueOnce(
        Response.json(
          board({
            ...match,
            competitors: [
              { ...match.competitors[0], score: "53" },
              match.competitors[1],
            ],
          }),
        ),
      )
      .mockRejectedValueOnce(new Error("offline"));
    const p = new EspnProvider(new ProviderCache(fetcher, () => time));
    expect((await p.events(nba, "2026-10-28")).value[0]).toMatchObject({
      homeScore: 51,
    });
    time += 31000;
    expect((await p.events(nba, "2026-10-28")).value[0]).toMatchObject({
      homeScore: 53,
    });
    time += 31000;
    const old = await p.events(nba, "2026-10-28");
    expect(old.stale).toBe(true);
    expect(old.value[0]).toMatchObject({
      status: "unknown",
      homeScore: 53,
      clock: "Updates delayed",
    });
    expect(String(fetcher.mock.calls[0][0])).toContain("dates=20261028");
  });
  it("fails explicitly on malformed scoreboards", () =>
    expect(() =>
      normalizeScoreboard({ events: [{}] }, nba, at, false),
    ).toThrow());
});
describe("official schedules and live broadcast discovery", () => {
  it("parses WWE's official event links and dates without inventing live results", () => {
    const html =
      '<tr><h2 class="events-upcoming-header"><a href="/event/smackdown-85">Friday Night SmackDown</a></h2><time datetime="2026-10-30T23:30:00+00:00">7:30 PM</time> | Arena</tr>';
    expect(normalizeWwe(html, at, false)[0]).toMatchObject({
      id: "wwe-smackdown-85",
      status: "upcoming",
      scheduleOnly: true,
      bouts: [],
    });
    expect(() => normalizeWwe("no schedule", at, false)).toThrow();
  });
  it("accepts only publisher-identified BWF metadata and marks ended broadcasts finished", () => {
    const raw = {
      videoDetails: {
        title: "Court session",
        channelId: "UChh-akEbUM8_6ghGVnJd6cQ",
      },
      microformat: {
        playerMicroformatRenderer: {
          liveBroadcastDetails: { isLiveNow: true, startTimestamp: at },
        },
      },
    };
    expect(normalizeBwf(raw, "epxkdYuTSqU", at, false)?.status).toBe("live");
    expect(normalizeBwf(raw, "epxkdYuTSqU", at, true)?.status).toBe("unknown");
    expect(
      normalizeBwf(
        { ...raw, videoDetails: { title: "Court", channelId: "impostor" } },
        "epxkdYuTSqU",
        at,
        false,
      ),
    ).toBeNull();
    raw.microformat.playerMicroformatRenderer.liveBroadcastDetails = {
      isLiveNow: false,
      startTimestamp: at,
      ...{ endTimestamp: "2026-10-28T11:00:00Z" },
    };
    expect(normalizeBwf(raw, "epxkdYuTSqU", at, false)?.status).toBe(
      "finished",
    );
  });
  it("parses public page JSON safely without evaluating publisher scripts", () => {
    const raw = pageJson(
      'var ytInitialData = {"lockupViewModel":{"contentId":"epxkdYuTSqU"},"title":"} \\\" test"}; evil()',
      "ytInitialData",
    );
    expect(publishedVideoIds(raw)).toEqual(["epxkdYuTSqU"]);
    expect(() => pageJson("no data", "ytInitialData")).toThrow();
  });
});
it("resolves an older match from a summary header without requiring scoreboard-only name/date fields", async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValue(
      Response.json({ header: { id: "42", competitions: [match] } }),
    );
  const cache = new ProviderCache(fetcher);
  const p = new EspnProvider(cache, cache);
  expect(await p.lookup("espn-basketball-nba-42")).toMatchObject({
    id: "espn-basketball-nba-42",
    home: "Home",
    homeScore: 51,
  });
  expect(await p.lookup("espn-unknown-host-42")).toBeUndefined();
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it("offers only fresh publisher-identified live broadcasts as disabled candidates", async () => {
  const { sourceCandidates } =
    await import("../apps/api/src/providers/source-candidates");
  const now = Date.parse(at);
  const live = normalizeBwf(
    {
      videoDetails: {
        title: "Live court",
        channelId: "UChh-akEbUM8_6ghGVnJd6cQ",
      },
      microformat: {
        playerMicroformatRenderer: {
          liveBroadcastDetails: { isLiveNow: true, startTimestamp: at },
        },
      },
    },
    "epxkdYuTSqU",
    at,
    false,
  )!;
  expect(sourceCandidates([live], now)).toMatchObject([
    {
      content: "sports",
      eventId: live.id,
      fixtureRef: { externalId: "epxkdYuTSqU", provider: "BWF TV" },
      type: "embed",
      revoked: true,
      territory: "PROVIDER",
      url: "https://www.youtube-nocookie.com/embed/epxkdYuTSqU",
    },
  ]);
  expect(sourceCandidates([live], now + 121000)).toEqual([]);
  for (const status of ["finished", "unknown", "upcoming"] as const)
    expect(sourceCandidates([{ ...live, status }], now)).toEqual([]);
  expect(
    sourceCandidates(
      [{ ...live, source: { ...live.source!, stale: true } }],
      now,
    ),
  ).toEqual([]);
  expect(
    sourceCandidates(
      [
        {
          ...live,
          source: { ...live.source!, url: "https://example.test/impostor" },
        },
      ],
      now,
    ),
  ).toEqual([]);
});
it("retains only event metadata from publisher pages", async () => {
  const { broadcastMetadata } = await import("../apps/api/src/providers/bwf");
  const meta = broadcastMetadata({
    videoDetails: {
      title: "Court",
      channelId: "official",
      tracking: "discard",
    },
    streamingData: { ignored: true },
    microformat: {
      playerMicroformatRenderer: {
        liveBroadcastDetails: { isLiveNow: true, startTimestamp: at },
      },
    },
  });
  expect(meta.videoDetails).toMatchObject({
    title: "Court",
    channelId: "official",
  });
  expect(JSON.stringify(meta)).not.toContain("streamingData");
  expect(JSON.stringify(meta)).not.toContain("tracking");
});
