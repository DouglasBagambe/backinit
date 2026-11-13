import { z } from "zod";

export const sourceSchema = z.object({
  provider: z.string(),
  url: z.string().url(),
  license: z.string(),
  fetchedAt: z.string().datetime(),
  stale: z.boolean(),
  liveValidUntil: z.string().datetime().optional(),
});
export const goalSchema = z.object({
  id: z.string(),
  minute: z.number().nullable(),
  player: z.string().nullable(),
  team: z.string().nullable(),
  homeScore: z.number(),
  awayScore: z.number(),
  penalty: z.boolean(),
  ownGoal: z.boolean(),
});
export const classificationSchema = z.object({
  position: z.number(),
  driver: z.string(),
  team: z.string(),
  laps: z.number(),
  points: z.number(),
  status: z.string(),
  time: z.string().nullable(),
});
export const standingSchema = z.object({
  team: z.string(),
  played: z.number(),
  won: z.number(),
  drawn: z.number(),
  lost: z.number(),
  goalsFor: z.number(),
  goalsAgainst: z.number(),
  points: z.number(),
});
const historyMatchSchema = z.object({
  id: z.string(),
  date: z.string(),
  home: z.string(),
  away: z.string(),
  homeScore: z.string(),
  awayScore: z.string(),
  competition: z.string().optional(),
});
export const liveDetailSchema = z.object({
  headToHead: z.array(historyMatchSchema).optional(),
  form: z
    .array(
      z.object({
        team: z.string(),
        matches: z.array(
          z.object({
            id: z.string(),
            date: z.string(),
            opponent: z.string(),
            result: z.enum(["W", "D", "L"]),
            score: z.string(),
          }),
        ),
      }),
    )
    .optional(),
  venue: z.string().nullable().optional(),
  round: z.string().optional(),
  goals: z.array(goalSchema).optional(),
  classification: z.array(classificationSchema).optional(),
  standings: z.array(standingSchema).optional(),
  statistics: z
    .array(z.object({ label: z.string(), home: z.string(), away: z.string() }))
    .optional(),
  periods: z
    .array(z.object({ label: z.string(), home: z.string(), away: z.string() }))
    .optional(),
  lineups: z
    .array(
      z.object({
        team: z.string(),
        formation: z.string().optional(),
        players: z.array(
          z.object({
            name: z.string(),
            id: z.string().optional(),
            imageUrl: z.string().url().optional(),
            jersey: z.string().optional(),
            formationPlace: z.string().optional(),
            position: z.string().optional(),
            starter: z.boolean().optional(),
          }),
        ),
      }),
    )
    .optional(),
  timeline: z
    .array(
      z.object({
        id: z.string(),
        clock: z.string(),
        text: z.string(),
        team: z.string().optional(),
      }),
    )
    .optional(),
});
export const coverageSchema = z.object({
  provider: z.string(),
  sport: z.string(),
  status: z.enum(["available", "stale", "unavailable", "not-configured"]),
  message: z.string(),
  fetchedAt: z.string().datetime().nullable(),
});
export type Coverage = z.infer<typeof coverageSchema>;
export type Source = z.infer<typeof sourceSchema>;
export type LiveDetail = z.infer<typeof liveDetailSchema>;

export const sports = [
  "Football",
  "Basketball",
  "Tennis",
  "WWE",
  "Formula 1",
  "Cricket",
  "MMA",
  "American football",
  "Baseball",
  "Rugby",
  "Badminton",
  "Ice hockey",
] as const;
export const sportSchema = z.enum(sports);
export type Sport = z.infer<typeof sportSchema>;
export const viewingLinkSchema = z.object({
  label: z.string().max(100),
  url: z.string().url(),
  evidenceUrl: z.string().url(),
  countries: z.array(z.string().regex(/^[A-Z]{2}$/)),
  access: z.enum(["free-account", "subscription", "information", "audio"]),
  confirmation: z.enum(["confirmed", "check-schedule"]),
  note: z.string().max(500),
  checkedAt: z.string().datetime(),
});
export const baseSchema = z.object({
  id: z.string(),
  sport: sportSchema,
  competition: z.string(),
  start: z.string().datetime(),
  status: z.enum([
    "live",
    "upcoming",
    "finished",
    "postponed",
    "cancelled",
    "suspended",
    "unknown",
  ]),
  provenance: z.enum(["demo", "provider"]),
  source: sourceSchema.optional(),
  detail: liveDetailSchema.optional(),
  externalId: z.string().optional(),
  scheduleOnly: z.boolean().optional(),
  timeConfirmed: z.boolean().optional(),
  end: z.string().datetime().optional(),
  viewingLinks: z.array(viewingLinkSchema).optional(),
});
export const participantSchema = z.object({
  id: z.string(),
  provider: z.string(),
  name: z.string(),
  imageUrl: z
    .string()
    .url()
    .refine((url) => url.startsWith("https://"), "HTTPS image required")
    .optional(),
  sourceUrl: z.string().url().optional(),
});
export const eventSchema = z.discriminatedUnion("kind", [
  baseSchema.extend({
    kind: z.literal("score"),
    home: z.string(),
    away: z.string(),
    homeParticipant: participantSchema.optional(),
    awayParticipant: participantSchema.optional(),
    homeScore: z.number().nullable(),
    awayScore: z.number().nullable(),
    clock: z.string(),
  }),
  baseSchema.extend({
    kind: z.literal("card"),
    title: z.string(),
    bouts: z.array(
      z.object({ performers: z.array(z.string()), stipulation: z.string() }),
    ),
  }),
  baseSchema.extend({
    kind: z.literal("race"),
    title: z.string(),
    session: z.string(),
    laps: z.number().nullable(),
  }),
]);
export type SportEvent = z.infer<typeof eventSchema>;
/** Watch can offer reported match tracking without claiming a video broadcast. */
export function hasMatchTracker(event: SportEvent): boolean {
  if (
    event.provenance !== "provider" ||
    !event.source ||
    event.source.stale ||
    event.scheduleOnly
  )
    return false;
  const detail = event.detail;
  return Boolean(
    (event.kind === "score" &&
      ["live", "finished"].includes(event.status) &&
      (event.homeScore !== null || event.awayScore !== null)) ||
    detail?.timeline?.length ||
    detail?.goals?.length ||
    detail?.statistics?.length ||
    detail?.periods?.length ||
    detail?.classification?.length,
  );
}
const base = { provenance: "demo" as const, start: "2026-10-26T19:00:00Z" };
export const events: SportEvent[] = [
  {
    ...base,
    id: "north-london",
    kind: "score",
    sport: "Football",
    competition: "Premier League · Demo",
    status: "live",
    home: "Arsenal",
    away: "Liverpool",
    homeScore: 2,
    awayScore: 1,
    clock: "67′",
  },
  {
    ...base,
    id: "madrid-barcelona",
    kind: "score",
    sport: "Football",
    competition: "La Liga · Demo",
    status: "live",
    home: "Real Madrid",
    away: "Barcelona",
    homeScore: 0,
    awayScore: 0,
    clock: "32′",
  },
  {
    ...base,
    id: "boston-la",
    kind: "score",
    sport: "Basketball",
    competition: "NBA · Demo",
    status: "live",
    home: "Boston Celtics",
    away: "LA Lakers",
    homeScore: 84,
    awayScore: 79,
    clock: "Q3 · 04:28",
  },
  {
    ...base,
    id: "milan-inter",
    kind: "score",
    sport: "Football",
    competition: "Serie A · Demo",
    status: "upcoming",
    home: "AC Milan",
    away: "Inter Milan",
    homeScore: null,
    awayScore: null,
    clock: "20:45 UTC",
  },
  {
    ...base,
    id: "tennis-final",
    kind: "score",
    sport: "Tennis",
    competition: "Exhibition · Demo",
    status: "finished",
    home: "Alex Rivers",
    away: "Leo Martín",
    homeScore: 2,
    awayScore: 1,
    clock: "Sets · Final",
  },
  {
    ...base,
    id: "wwe-showcase",
    kind: "card",
    sport: "WWE",
    competition: "Wrestling showcase · Fictional card",
    status: "upcoming",
    title: "Saturday Night Showcase",
    bouts: [
      {
        performers: ["Atlas King", "Jax Steel"],
        stipulation: "Main event · Singles",
      },
      {
        performers: ["Maya Storm", "Nova Reed"],
        stipulation: "Championship showcase",
      },
    ],
  },
  {
    ...base,
    id: "grand-prix",
    kind: "race",
    sport: "Formula 1",
    competition: "Motorsport · Demo",
    status: "upcoming",
    title: "Grand Prix weekend",
    session: "Race",
    laps: 56,
  },
  {
    ...base,
    id: "cricket",
    kind: "score",
    sport: "Cricket",
    competition: "T20 exhibition · Demo",
    status: "upcoming",
    home: "Harbor XI",
    away: "City XI",
    homeScore: null,
    awayScore: null,
    clock: "18:00 UTC",
  },
];
export function eventTitle(e: SportEvent) {
  return e.kind === "score" ? `${e.home} vs ${e.away}` : e.title;
}
export function filterEvents(
  items: SportEvent[],
  options: { sport?: string; query?: string; live?: boolean; ids?: string[] },
) {
  return items.filter(
    (e) =>
      (!options.sport || e.sport === options.sport) &&
      (!options.live || e.status === "live") &&
      (!options.ids || options.ids.includes(e.id)) &&
      (!options.query ||
        `${eventTitle(e)} ${e.competition} ${e.sport} ${(e.detail?.goals || []).map((g) => g.player || "").join(" ")} ${(e.detail?.classification || []).map((r) => `${r.driver} ${r.team}`).join(" ")} ${e.kind === "card" ? e.bouts.flatMap((b) => b.performers).join(" ") : ""}`
          .toLowerCase()
          .includes(options.query.toLowerCase())),
  );
}
export interface SportsProvider {
  readonly id: string;
  getEvents(): Promise<SportEvent[]>;
}
export class DemoProvider implements SportsProvider {
  readonly id = "demo";
  async getEvents() {
    return events.map((e) => eventSchema.parse(e));
  }
}
export const timeline = [
  {
    minute: 12,
    type: "goal",
    team: "Arsenal",
    text: "Arsenal take the lead",
    score: "1 – 0",
  },
  {
    minute: 29,
    type: "card",
    team: "Liverpool",
    text: "Yellow card · Liverpool",
    score: "1 – 0",
  },
  {
    minute: 41,
    type: "goal",
    team: "Liverpool",
    text: "Liverpool equalise",
    score: "1 – 1",
  },
  {
    minute: 58,
    type: "goal",
    team: "Arsenal",
    text: "Arsenal go ahead",
    score: "2 – 1",
  },
  {
    minute: 67,
    type: "corner",
    team: "Arsenal",
    text: "Corner awarded to Arsenal",
    score: "2 – 1",
  },
] as const;
export const stats = [
  ["Possession", 58, 42],
  ["Shots", 14, 9],
  ["Shots on target", 6, 4],
  ["Expected goals", 1.82, 0.94],
  ["Corners", 7, 3],
  ["Fouls", 8, 10],
] as const;
export const feedSchema = z.object({
  data: z.array(eventSchema),
  source: z.string(),
  edition: z.enum(["real", "demo"]),
  coverage: z.array(coverageSchema),
});
export type EventFeed = z.infer<typeof feedSchema>;

/** The catalogue cache cannot extend the verification window of its live sources. */
export function liveSnapshotExpired(
  event: SportEvent,
  now = Date.now(),
): boolean {
  if (
    event.provenance !== "provider" ||
    event.status !== "live" ||
    !event.source
  )
    return false;
  const checked = Date.parse(event.source.fetchedAt);
  // Explicit broadcast verification may last up to two minutes; scores retain one minute.
  const expires = event.source.liveValidUntil
    ? Math.min(Date.parse(event.source.liveValidUntil), checked + 120000)
    : checked + 60000;
  return !Number.isFinite(expires) || now > expires;
}

/** Cached live snapshots must never masquerade as current after their source expires. */
export function freshEventFeed(feed: EventFeed, now = Date.now()): EventFeed {
  const delayed = new Set<string>();
  const data = feed.data.map((event) => {
    if (!event.source || !liveSnapshotExpired(event, now)) return event;
    delayed.add(event.source.provider);
    return {
      ...event,
      status: "unknown" as const,
      source: { ...event.source, stale: true },
      ...(event.kind === "score" ? { clock: "Last update" } : {}),
    };
  });
  return {
    ...feed,
    data,
    coverage: feed.coverage.map((row) =>
      delayed.has(row.provider) ? { ...row, status: "stale" as const } : row,
    ),
  };
}
export const streamSourceSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]{1,80}$/),
    name: z.string().min(1).max(100),
    type: z.enum(["hls", "dash", "embed"]),
    url: z.string().url().max(2048),
    content: z.enum(["test", "sports", "official"]),
    eventId: z.string().max(80).nullable(),
    presentation: z.enum(["live", "replay", "highlights"]).optional(),
    fixtureRef: z
      .object({
        provider: z.string().min(1).max(100),
        externalId: z.string().min(1).max(100),
      })
      .optional(),
    rightsOwner: z.string().min(1).max(150),
    rightsEvidence: z.string().url().max(2048),
    validFrom: z.string().datetime(),
    validUntil: z.string().datetime(),
    territory: z.enum(["WORLD", "PROVIDER"]),
    catalog: z
      .object({
        sport: sportSchema,
        publisher: z.string(),
        channelId: z.string(),
        publishedAt: z.string().datetime().nullable(),
        thumbnail: z.string().url(),
        watchUrl: z.string().url(),
        category: z.enum([
          "Full match",
          "Full fight",
          "Full game",
          "Full event",
          "Highlights",
          "Official video",
        ]),
        checkedAt: z.string().datetime(),
      })
      .optional(),
    revoked: z.boolean(),
    version: z.number().int().min(1),
  })
  .strict();
export type StreamSource = z.infer<typeof streamSourceSchema>;
export const testSources: StreamSource[] = [
  {
    id: "bbb-hls",
    name: "Big Buck Bunny · HLS test",
    type: "hls",
    url: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
    content: "test",
    eventId: null,
    rightsOwner: "Blender Foundation",
    rightsEvidence: "https://peach.blender.org/",
    validFrom: "2026-01-01T00:00:00Z",
    validUntil: "2027-01-01T00:00:00Z",
    territory: "WORLD",
    revoked: false,
    version: 1,
  },
  {
    id: "bbb-dash",
    name: "Big Buck Bunny · DASH test",
    type: "dash",
    url: "https://dash.akamaized.net/akamai/bbb_30fps/bbb_30fps.mpd",
    content: "test",
    eventId: null,
    rightsOwner: "Blender Foundation",
    rightsEvidence: "https://peach.blender.org/",
    validFrom: "2026-01-01T00:00:00Z",
    validUntil: "2027-01-01T00:00:00Z",
    territory: "WORLD",
    revoked: false,
    version: 1,
  },
];
testSources.push({
  id: "dash-live-simulator",
  name: "DASH-IF live simulator · test pattern",
  type: "dash",
  url: "https://livesim2.dashif.org/livesim2/testpic_2s/Manifest.mpd",
  content: "test",
  eventId: null,
  presentation: "live",
  rightsOwner: "DASH-IF",
  rightsEvidence: "https://github.com/Dash-Industry-Forum/livesim2",
  validFrom: "2026-01-01T00:00:00Z",
  validUntil: "2027-01-01T00:00:00Z",
  territory: "WORLD",
  revoked: false,
  version: 1,
});
export function sourceIsActive(source: StreamSource, now = Date.now()) {
  return (
    !source.revoked &&
    Date.parse(source.validFrom) <= now &&
    Date.parse(source.validUntil) > now
  );
}
export const newsItemSchema = z.object({
  title: z.string(),
  url: z.string().url(),
  publishedAt: z.string().datetime(),
  source: z.string(),
  category: z.string(),
  dateKind: z.enum(["published", "indexed"]).optional(),
});
export const newsFeedSchema = z.object({
  data: z.array(newsItemSchema),
  status: z.enum(["available", "stale", "unavailable", "not-configured"]),
  message: z.string(),
  fetchedAt: z.string().datetime().nullable(),
  attribution: z.object({ name: z.string(), url: z.string().url() }).optional(),
});
export type NewsFeed = z.infer<typeof newsFeedSchema>;

export function sourceMatchesEvent(source: StreamSource, event: SportEvent) {
  if (source.content !== "sports" || event.provenance !== "provider")
    return false;
  if (source.eventId) return source.eventId === event.id;
  return Boolean(
    source.fixtureRef &&
    source.fixtureRef.provider === event.source?.provider &&
    source.fixtureRef.externalId === event.externalId,
  );
}
export const sourceCheckSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]{1,80}$/),
    version: z.number().int().positive(),
    result: z.enum(["passed", "failed"]),
    method: z.enum(["native-decoded", "provider-player", "operator-observed"]),
    currentTime: z.number().nonnegative().max(1e10),
    width: z.number().int().nonnegative().max(20000),
    height: z.number().int().nonnegative().max(20000),
    browser: z.string().min(1).max(300),
    live: z.boolean().optional(),
  })
  .strict();
export type PlaybackReport = Omit<
  z.infer<typeof sourceCheckSchema>,
  "id" | "version" | "browser"
>;
export const watchEntrySchema = z.object({
  event: eventSchema,
  sources: z.array(streamSourceSchema),
  availability: z.enum(["in-page", "external-only", "unavailable"]),
});
export const watchFeedSchema = z.object({
  statusEvents: z.array(eventSchema).default([]),
  data: z.array(watchEntrySchema),
  coverage: z.array(coverageSchema),
  generatedAt: z.string().datetime(),
});
export type WatchEntry = z.infer<typeof watchEntrySchema>;

const trackerLease = z.object({
  eventId: z.string().regex(/^[a-z0-9-]{1,80}$/),
  checkedAt: z.string().datetime(),
  validUntil: z.string().datetime(),
  kind: z.literal("publisher-tracker"),
});
export const trackerSourceSchema = z.discriminatedUnion("provider", [
  trackerLease.extend({
    provider: z.literal("SportScore"),
    url: z
      .string()
      .regex(
        /^https:\/\/sportscore\.com\/embed\/tracker\/(football|basketball|tennis|cricket)\/[a-z0-9-]{1,220}\/$/,
      ),
    sourceUrl: z.literal("https://sportscore.com/"),
    transport: z.literal("publisher").optional(),
    viewUrl: z
      .string()
      .regex(
        /^https:\/\/backinit-api\.onrender\.com\/trackers\/[a-z0-9-]{1,80}\/view$/,
      )
      .optional(),
  }),
  trackerLease.extend({
    provider: z.literal("Sportradar"),
    // The widget Client ID is public; API keys are never sent to the browser.
    clientId: z.string().regex(/^[a-f0-9]{32}$/),
    matchId: z.string().regex(/^sr:match:[1-9][0-9]{0,14}$/),
  }),
]);
export type TrackerSource = z.infer<typeof trackerSourceSchema>;

export const broadcastSchema = z.object({
  id: z.string(),
  title: z.string(),
  category: z.string(),
  competition: z.string(),
  poster: z.string().nullable(),
  start: z.number(),
  end: z.number(),
  channel: z.boolean(),
  viewers: z.number().nullable(),
  live: z.boolean().optional(),
  pageUrl: z.string().url(),
  sources: z.array(
    z.object({ id: z.string(), label: z.string(), url: z.string().url() }),
  ),
  replay: z.boolean(),
});
export type Broadcast = z.infer<typeof broadcastSchema>;
export const broadcastFeedSchema = z.object({
  data: z.array(broadcastSchema),
  updatedAt: z.string().nullable(),
  stale: z.boolean(),
  message: z.string().optional(),
});
export type BroadcastFeed = z.infer<typeof broadcastFeedSchema>;
export function broadcastState(b: Broadcast, now = Date.now()) {
  return b.replay
    ? "Replay"
    : b.channel
      ? "24/7"
      : now < b.start
        ? "Upcoming"
        : b.live === false
          ? "Awaiting stream"
          : now <= b.end
            ? "Live"
            : "Ended";
}

const aliases: Record<string, string> = {
  manutd: "manchesterunited",
  manchesterutd: "manchesterunited",
  manunited: "manchesterunited",
  psg: "parissaintgermain",
  bayernmunchen: "bayernmunich",
  bayern: "bayernmunich",
  inter: "intermilan",
  internazionale: "intermilan",
  fcbarcelona: "barcelona",
};
export function participantKey(value: string) {
  const key = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\b(?:fc|afc)\b/g, "")
    .replace(/[^a-z0-9]/g, "");
  return aliases[key] || key;
}
export function sportKey(value: string) {
  const key = value.toLowerCase();
  return key === "wrestling" ? "wwe" : key === "motorsport" ? "formula 1" : key;
}
/** Match both participants and kickoff; ambiguous matches are never joined. */
export function matchBroadcastEvent(
  broadcast: Broadcast,
  events: SportEvent[],
) {
  if (broadcast.channel) return null;
  const teams = broadcast.title.split(/\s+(?:vs?\.?|@|at)\s+/i);
  if (teams.length !== 2) return null;
  const matches = events.filter((e) => {
    if (
      e.kind !== "score" ||
      e.provenance !== "provider" ||
      sportKey(e.sport) !== sportKey(broadcast.category) ||
      Math.abs(Date.parse(e.start) - broadcast.start) > 6 * 3600000
    )
      return false;
    const sides = [participantKey(e.home), participantKey(e.away)].sort();
    return sides.join(":") === teams.map(participantKey).sort().join(":");
  });
  return matches.length === 1 ? matches[0]! : null;
}
export function isMediaEvent(event: SportEvent) {
  return (
    event.kind === "card" &&
    !event.bouts.length &&
    /full match|full basketball game|highlights|weekly|marathon|extended highlights/i.test(
      event.title,
    )
  );
}
export function eventScore(event: SportEvent, side: "home" | "away") {
  if (event.kind !== "score") return "";
  const total = side === "home" ? event.homeScore : event.awayScore;
  if (total !== null) return String(total);
  if (event.sport === "Tennis" && event.detail?.periods?.length)
    return event.detail.periods.map((p) => p[side]).join(" · ");
  return event.status === "upcoming" ? "" : "–";
}
export function entityHref(
  kind: "team" | "athlete" | "competition",
  name: string,
  sport: string,
  identity?: { id?: string; providerSport?: string; league?: string },
) {
  return `/explore/${kind}?${new URLSearchParams({ name, sport, ...(identity?.id && identity.providerSport && identity.league ? { pid: identity.id, psport: identity.providerSport, league: identity.league } : {}) })}`;
}
export type SportsEntity = {
  kind: "team" | "athlete" | "competition";
  name: string;
  sport: string;
  image?: string;
  id?: string;
  providerSport?: string;
  league?: string;
};
export function sportsEntities(events: SportEvent[]): SportsEntity[] {
  const entities = new Map<string, SportsEntity>();
  const add = (entity: SportsEntity) => {
    if (!entity.name.trim() || /^(tbd|unknown)$/i.test(entity.name.trim()))
      return;
    const key = `${entity.kind}:${entity.sport}:${participantKey(entity.name)}`;
    const old = entities.get(key);
    entities.set(key, { ...old, ...entity, image: entity.image || old?.image });
  };
  for (const e of events) {
    if (isMediaEvent(e)) continue;
    add({ kind: "competition", name: e.competition, sport: e.sport });
    if (e.kind === "score") {
      const path = e.source?.provider.match(/^ESPN:([a-z]+)\/([a-z0-9._-]+)$/);
      const identity = path ? { providerSport: path[1], league: path[2] } : {};
      const kind = ["Tennis", "Badminton"].includes(e.sport)
        ? "athlete"
        : "team";
      add({
        kind,
        name: e.home,
        sport: e.sport,
        image: e.homeParticipant?.imageUrl,
        ...(path ? { ...identity, id: e.homeParticipant?.id } : {}),
      });
      add({
        kind,
        name: e.away,
        sport: e.sport,
        image: e.awayParticipant?.imageUrl,
        ...(path ? { ...identity, id: e.awayParticipant?.id } : {}),
      });
    }
    for (const r of e.detail?.classification || []) {
      add({ kind: "athlete", name: r.driver, sport: e.sport });
      add({ kind: "team", name: r.team, sport: e.sport });
    }
    for (const team of e.detail?.lineups || [])
      for (const p of team.players)
        add({
          kind: "athlete",
          name: p.name,
          sport: e.sport,
          image: p.imageUrl,
          ...(p.id ? { id: p.id } : {}),
          ...(e.source?.provider.match(/^ESPN:([a-z]+)\/([a-z0-9._-]+)$/)
            ? {
                providerSport: e.source.provider.split(":")[1]!.split("/")[0],
                league: e.source.provider.split("/")[1],
              }
            : {}),
        });
    for (const goal of e.detail?.goals || [])
      if (goal.player)
        add({ kind: "athlete", name: goal.player, sport: e.sport });
    if (e.kind === "card")
      for (const bout of e.bouts)
        for (const name of bout.performers)
          add({ kind: "athlete", name, sport: e.sport });
  }
  return [...entities.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** Draw only when reported player positions agree with the reported formation. */
export function formationLines(
  team: NonNullable<LiveDetail["lineups"]>[number],
) {
  const formation = team.formation?.split("-").map(Number);
  const starters = team.players.filter((p) => p.starter === true);
  if (
    !formation?.every((n) => Number.isInteger(n) && n > 0 && n <= 6) ||
    formation.reduce((a, b) => a + b, 0) !== 10 ||
    starters.length !== 11
  )
    return null;
  const groups: Array<typeof starters> = Array.from({ length: 6 }, () => []);
  for (const p of starters) {
    const pos = p.position || "";
    const group =
      pos === "G" || pos === "GK"
        ? 0
        : /^(CD|CB|LB|RB)(-|$)/.test(pos)
          ? 1
          : /^(DM)(-|$)/.test(pos)
            ? 2
            : /^(CM|LM|RM|M)(-|$)/.test(pos)
              ? 3
              : /^(AM)(-|$)/.test(pos)
                ? 4
                : /^(F|LF|RF|CF|ST|LW|RW)(-|$)/.test(pos)
                  ? 5
                  : -1;
    if (group < 0) return null;
    groups[group]!.push(p);
  }
  if (
    groups[0]!.length !== 1 ||
    groups[1]!.length !== formation[0] ||
    groups[5]!.length !== formation.at(-1)
  )
    return null;
  // Providers can distinguish defensive/central/attacking midfield roles
  // within one formation line (for example the five in a 3-5-2).
  // Merge adjacent role groups only when they fit the reported formation.
  const roles = groups.filter((g) => g.length);
  const lines: Array<typeof starters> = [];
  let cursor = 0;
  for (const size of [1, ...formation]) {
    const line: typeof starters = [];
    while (line.length < size && cursor < roles.length)
      line.push(...roles[cursor++]!);
    if (line.length !== size) return null;
    lines.push(line);
  }
  if (cursor !== roles.length) return null;
  if (lines.map((g) => g.length).join("-") !== [1, ...formation].join("-"))
    return null;
  const lateral = (position = "") =>
    /^(LB|LWB|LM|LF|LW)$/.test(position)
      ? 0
      : position.endsWith("-L")
        ? 1
        : position.endsWith("-R")
          ? 3
          : /^(RB|RWB|RM|RF|RW)$/.test(position)
            ? 4
            : 2;
  return lines
    .map((line) =>
      [...line].sort((a, b) => lateral(a.position) - lateral(b.position)),
    )
    .reverse();
}

/** Stable directory IDs; score-provider IDs continue through the match router. */
export function isBroadcastId(value: string): boolean {
  return /^(?:ppv-\d+|ext-[a-z0-9-]{1,120})$/.test(value);
}

/** Group only explicitly named promotions/series; never infer absent coverage. */
export function broadcastCollection(
  item: Pick<Broadcast, "category" | "competition" | "title">,
): string {
  const text = `${item.competition} ${item.title}`;
  for (const [pattern, label] of [
    [/\b(?:WWE|WWF|Smackdown|Monday Night Raw|NXT)\b/i, "WWE"],
    [/\b(?:AEW|All Elite Wrestling)\b/i, "AEW"],
    [/\b(?:TNA|Impact Wrestling)\b/i, "TNA / Impact"],
    [/\b(?:NJPW|New Japan)\b/i, "NJPW"],
    [/\b(?:ROH|Ring of Honor)\b/i, "ROH"],
    [/\bMoto\s?GP\b/i, "MotoGP"],
    [/\b(?:Formula (?:One|1)|F1)\b/i, "Formula 1"],
  ] as const)
    if (pattern.test(text)) return label;
  return item.competition;
}
