const evidence =
  "https://www.chelseafc.com/en/news/article/chelsea-vs-manchester-united-preview-tv-channel-kick-off-time-26-27";
const partners = "https://www.premierleague.com/en/media/broadcasters";
const checkedAt = "2026-10-30T22:15:00Z";

/** Confirmed destinations for this fixture; these are not embedded broadcasts. */
export function premierLeagueViewingLinks(
  home: string,
  away: string,
  start: string,
) {
  if (
    home !== "Chelsea" ||
    away !== "Manchester United" ||
    Date.parse(start) !== Date.parse("2026-10-31T12:30:00Z")
  )
    return [];
  return [
    {
      label: "Chelsea · live audio and match updates",
      url: "https://www.chelseafc.com/en/match/chelsea-vs-manchester-united-english-premier-league-2026-10-31",
      evidenceUrl: evidence,
      countries: [],
      access: "audio" as const,
      confirmation: "confirmed" as const,
      note: "Chelsea confirms live audio from 12:25 GMT, plus text updates and match statistics.",
      checkedAt,
    },
    {
      label: "TNT Sports · UK",
      url: "https://www.tntsports.co.uk/football/premier-league/",
      evidenceUrl: evidence,
      countries: ["GB"],
      access: "subscription" as const,
      confirmation: "confirmed" as const,
      note: "UK live television coverage confirmed by Chelsea. Subscription and regional access required.",
      checkedAt,
    },
    {
      label: "Uganda · SuperSport coverage",
      url: partners,
      evidenceUrl: partners,
      countries: ["UG"],
      access: "information" as const,
      confirmation: "check-schedule" as const,
      note: "The Premier League lists SuperSport for sub-Saharan Africa. Check your package and match channel.",
      checkedAt,
    },
  ];
}
