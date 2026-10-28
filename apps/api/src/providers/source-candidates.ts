import {
  streamSourceSchema,
  type SportEvent,
  type StreamSource,
} from "../../../../packages/domain/src/index.js";
const channel = "UChh-akEbUM8_6ghGVnJd6cQ";
/** Discovery only: candidates remain unsaved, disabled and unverified. */
export function sourceCandidates(
  events: SportEvent[],
  now = Date.now(),
): StreamSource[] {
  return events.flatMap((event) => {
    const id = event.externalId;
    if (
      event.source?.provider !== "BWF TV" ||
      event.provenance !== "provider" ||
      event.status !== "live" ||
      event.source.stale ||
      now - Date.parse(event.source.fetchedAt) > 120000 ||
      Date.parse(event.source.fetchedAt) > now + 60000 ||
      !id ||
      !/^[\w-]{11}$/.test(id) ||
      event.source.url !== `https://www.youtube.com/watch?v=${id}`
    )
      return [];
    return [
      streamSourceSchema.parse({
        id: event.id,
        name: event.kind === "card" ? event.title.slice(0, 100) : event.id,
        type: "embed",
        url: `https://www.youtube-nocookie.com/embed/${id}`,
        content: "sports",
        eventId: event.id,
        fixtureRef: { provider: "BWF TV", externalId: id },
        presentation: "live",
        rightsOwner: "Badminton World Federation",
        rightsEvidence: `https://www.youtube.com/channel/${channel}`,
        validFrom: new Date(now).toISOString(),
        validUntil: new Date(now + 4 * 3600000).toISOString(),
        territory: "PROVIDER",
        revoked: true,
        version: 1,
      }),
    ];
  });
}
