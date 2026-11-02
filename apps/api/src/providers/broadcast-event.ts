import type {
  Broadcast,
  SportEvent,
} from "../../../../packages/domain/src/index.js";
const aliases: Record<string, string> = {
  manutd: "manchesterunited",
  manchesterutd: "manchesterunited",
  manunited: "manchesterunited",
  psg: "parissaintgermain",
  bayernmunchen: "bayernmunich",
  bayern: "bayernmunich",
  inter: "intermilan",
  internazionale: "intermilan",
};
const key = (value: string) => {
  const name = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\b(?:fc|afc)\b/g, "")
    .replace(/[^a-z0-9]/g, "");
  return aliases[name] || name;
};
/** Pair both participants, sport and kickoff; ambiguity never creates a tracker. */
export function broadcastEvent(
  broadcast: Broadcast,
  events: SportEvent[],
): SportEvent | null {
  if (broadcast.channel) return null;
  const teams = broadcast.title.split(/\s+(?:vs?\.?|@|at)\s+/i);
  if (teams.length !== 2) return null;
  const sport = broadcast.category.toLowerCase();
  const matches = events.filter((e) => {
    if (
      e.kind !== "score" ||
      e.provenance !== "provider" ||
      e.sport.toLowerCase() !== sport ||
      Math.abs(Date.parse(e.start) - broadcast.start) > 6 * 3600000
    )
      return false;
    const sides = [key(e.home), key(e.away)];
    return (
      (sides[0] === key(teams[0]!) && sides[1] === key(teams[1]!)) ||
      (sides[1] === key(teams[0]!) && sides[0] === key(teams[1]!))
    );
  });
  return matches.length === 1 ? matches[0]! : null;
}
