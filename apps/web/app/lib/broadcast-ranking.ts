import type { Broadcast } from "./broadcast-types";
// Editorial discovery defaults, not claims about current league standings.
const marqueeTeams = [
  /manchester united|man(?:chester)?\s*utd|\bmanu\b/i,
  /chelsea/i,
  /liverpool/i,
  /arsenal/i,
  /manchester city|man city/i,
  /real madrid/i,
  /barcelona/i,
  /bayern/i,
  /paris saint.germain|\bpsg\b/i,
  /juventus/i,
  /inter milan|internazionale/i,
  /ac milan/i,
  /borussia dortmund/i,
  /atl[eé]tico madrid/i,
  /tottenham/i,
  /los angeles lakers|\blakers\b/i,
  /boston celtics|\bceltics\b/i,
  /golden state warriors|\bwarriors\b/i,
  /new york knicks|\bknicks\b/i,
  /kansas city chiefs|\bchiefs\b/i,
  /dallas cowboys|\bcowboys\b/i,
  /san francisco 49ers|\b49ers\b/i,
  /baltimore ravens|\bravens\b/i,
];
export function broadcastImportance(item: Broadcast): number {
  if (item.channel) return 0;
  const text = `${item.title} ${item.competition}`;
  if (
    /super bowl|\bnba finals\b|\bworld cup final\b|\bchampions league final\b/i.test(
      text,
    )
  )
    return 1200;
  if (marqueeTeams.filter((team) => team.test(item.title)).length >= 2)
    return 1100;
  if (/\bfinal\b/i.test(text) && !/quarter|semi|qualif/i.test(text))
    return 1000;
  const league =
    /premier league|champions league|\bnba\b|\bnfl\b|grand slam/i.test(text)
      ? 80
      : /laliga|la liga|serie a|bundesliga|ligue 1|europa league|\batp\b|\bwta\b|\bufc\b|formula 1/i.test(
            text,
          )
        ? 60
        : 10;
  return (
    league + (marqueeTeams.some((team) => team.test(item.title)) ? 100 : 0)
  );
}
export function compareBroadcasts(a: Broadcast, b: Broadcast, now: number) {
  const pa = broadcastImportance(a),
    pb = broadcastImportance(b);
  const big = Number(pb >= 1000) - Number(pa >= 1000);
  if (big) return big;
  const live = (b: Broadcast) => !b.channel && b.start <= now && b.end >= now;
  return (
    Number(live(b)) - Number(live(a)) ||
    pb - pa ||
    a.start - b.start ||
    a.title.localeCompare(b.title)
  );
}
