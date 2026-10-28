import {
  eventSchema,
  type SportEvent,
} from "../../../../packages/domain/src/index.js";
import { ProviderCache } from "./cache.js";
export const eflEvidence =
  "https://www.efl.com/news/2026/october/20/carabao-cup-round-four-referee-appointments/";
export const clubEvidence =
  "https://www.chelseafc.com/en/news/article/date-and-kick-off-time-for-liverpool-carabao-cup-tie-confirmed";
export const checkedAt = "2026-10-27T22:15:00Z";
const partners = "https://www.efl.com/how-to-watch/broadcast-partners/";
const months = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
export function londonKickoff(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
) {
  const candidate = Date.UTC(year, month, day, hour, minute);
  const offset =
    new Intl.DateTimeFormat("en", {
      timeZone: "Europe/London",
      timeZoneName: "shortOffset",
    })
      .formatToParts(candidate)
      .find((p) => p.type === "timeZoneName")?.value || "GMT";
  const match = offset.match(/GMT([+-])(\d+)(?::(\d+))?/);
  const minutes = match
    ? (Number(match[2]) * 60 + Number(match[3] || 0)) *
      (match[1] === "+" ? 1 : -1)
    : 0;
  return new Date(candidate - minutes * 60000).toISOString();
}
export function footballFixture(
  home: string,
  away: string,
  start: string,
  fetchedAt: string,
  stale: boolean,
): SportEvent {
  home = home.replaceAll("&amp;", "&");
  away = away.replaceAll("&amp;", "&");
  const id = `efl-${start.slice(0, 10).replaceAll("-", "")}-${slug(home.replace(/^AFC /, ""))}-${slug(away)}`;
  const priority = home === "Liverpool" && away === "Chelsea";
  return eventSchema.parse({
    id,
    externalId: id,
    sport: "Football",
    competition: "Carabao Cup · Round four",
    kind: "score",
    home,
    away,
    start,
    status: "upcoming",
    homeScore: null,
    awayScore: null,
    clock: "Scheduled",
    provenance: "provider",
    scheduleOnly: true,
    source: {
      provider: "EFL official schedule",
      url: eflEvidence,
      license:
        "Officially published fixture facts · no broadcast rights implied",
      fetchedAt,
      stale,
    },
    detail: {
      round: "Round four",
      venue:
        home === "Liverpool"
          ? "Anfield"
          : home === "Manchester City"
            ? "Etihad Stadium"
            : home === "Fulham"
              ? "Craven Cottage"
              : home === "Sunderland"
                ? "Stadium of Light"
                : home.includes("Bournemouth")
                  ? "Vitality Stadium"
                  : null,
    },
    viewingLinks: [
      {
        label: priority ? "ITV / ITVX · UK" : "Sky Sports · UK",
        url: priority
          ? "https://www.itv.com/watch/categories/sport"
          : "https://www.skysports.com/watch/football-on-sky",
        evidenceUrl: priority ? clubEvidence : partners,
        countries: ["GB"],
        access: priority ? "free-account" : "subscription",
        confirmation: priority ? "confirmed" : "check-schedule",
        note: priority
          ? "UK coverage confirmed by Chelsea. ITVX requires UK access and an account. No BackInIt embed is authorized."
          : "UK broadcast partner. Check the event listing and your subscription; no in-page feed supplied.",
        checkedAt,
      },
      ...(priority
        ? [
            {
              label: "Sky Sports · UK",
              url: "https://www.skysports.com/watch/football-on-sky",
              evidenceUrl: clubEvidence,
              countries: ["GB"],
              access: "subscription",
              confirmation: "confirmed",
              note: "UK coverage confirmed by Chelsea. Subscription required; not an embeddable source.",
              checkedAt,
            },
          ]
        : []),
      {
        label: "Uganda · official broadcast partners",
        url: partners,
        evidenceUrl: partners,
        countries: ["UG"],
        access: "information",
        confirmation: "check-schedule",
        note: "EFL lists SuperSport and ESPN Africa for Uganda. This is a partner directory, not confirmation of this match on a particular channel or permission to embed it.",
        checkedAt,
      },
      ...(priority
        ? [
            {
              label: "Chelsea match coverage · audio / updates",
              url: "https://www.chelseafc.com/en/matches",
              evidenceUrl: "https://hospitality.chelseafc.com/faq/",
              countries: [],
              access: "audio",
              confirmation: "check-schedule",
              note: "Club coverage can include audio commentary and updates. Full live men's first-team video is not confirmed.",
              checkedAt,
            },
          ]
        : []),
    ],
  });
}
export const verifiedCupFixtures = [
  footballFixture(
    "Manchester City",
    "Brighton & Hove Albion",
    "2026-10-28T19:30:00Z",
    checkedAt,
    false,
  ),
  footballFixture(
    "AFC Bournemouth",
    "Aston Villa",
    "2026-10-28T19:45:00Z",
    checkedAt,
    false,
  ),
  footballFixture(
    "Fulham",
    "Crystal Palace",
    "2026-10-28T19:45:00Z",
    checkedAt,
    false,
  ),
  footballFixture(
    "Sunderland",
    "Brentford",
    "2026-10-28T19:45:00Z",
    checkedAt,
    false,
  ),
  footballFixture(
    "Liverpool",
    "Chelsea",
    "2026-10-28T20:00:00Z",
    checkedAt,
    false,
  ),
];
/** Public, fixed official announcement only. Never executes Nuxt payloads or follows private APIs. */
export function parseEflSchedule(
  raw: unknown,
  fetchedAt: string,
): SportEvent[] {
  if (
    typeof raw !== "string" ||
    raw.length > 2_000_000 ||
    !raw.includes("Carabao Cup Round Four referee appointments")
  )
    throw new Error("Unexpected EFL page");
  const pattern =
    /(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s+(\d{1,2})(?:st|nd|rd|th)?\s+([A-Z][a-z]+)\s+(20\d{2})|<strong>([^<>]{1,90}) v ([^<>]{1,90}) \((\d{2}):(\d{2})\)<\/strong>/g;
  let date: { day: number; month: number; year: number } | null = null;
  const events = new Map<string, SportEvent>();
  for (const m of raw.matchAll(pattern)) {
    if (m[1]) {
      const month = months.indexOf(m[2]!);
      date =
        month >= 0 ? { day: Number(m[1]), month, year: Number(m[3]) } : null;
      continue;
    }
    if (!date || Number(m[6]) > 23 || Number(m[7]) > 59) continue;
    const event = footballFixture(
      m[4]!,
      m[5]!,
      londonKickoff(
        date.year,
        date.month,
        date.day,
        Number(m[6]),
        Number(m[7]),
      ),
      fetchedAt,
      false,
    );
    events.set(event.id, event);
  }
  if (!events.size) throw new Error("Official fixtures not found");
  return [...events.values()];
}
export class EflProvider {
  constructor(private readonly cache: ProviderCache) {}
  async events() {
    try {
      const result = await this.cache.json(
        eflEvidence,
        900000,
        (raw) => parseEflSchedule(raw, new Date().toISOString()),
        {},
        (r) => r.text(),
      );
      return {
        ...result,
        value: result.value.map((e) => ({
          ...e,
          source: {
            ...e.source!,
            fetchedAt: result.fetchedAt,
            stale: result.stale,
          },
        })),
      };
    } catch {
      return {
        value: verifiedCupFixtures.map((e) => ({
          ...e,
          source: { ...e.source!, stale: true },
        })),
        fetchedAt: checkedAt,
        stale: true,
      };
    }
  }
}
