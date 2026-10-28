/** Real-network audit, deliberately excluded from deterministic CI.
 * Usage: pnpm exec tsx scripts/probe-real-sports.mts
 * This checks data, not decoded video. It never publishes or enables a source.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { SportsService } from "../apps/api/src/providers/service.js";
const feed = await new SportsService().feed("real");
const generatedAt = new Date().toISOString();
const today = generatedAt.slice(0, 10);
const live = feed.data.filter((e) => e.status === "live" && !e.source?.stale);
const data = {
  generatedAt,
  totalProviderRecords: feed.data.length,
  recordsStartingTodayUtc: feed.data.filter(
    (e) => e.start.slice(0, 10) === today,
  ).length,
  sports: [...new Set(feed.data.map((e) => e.sport))],
  live,
  coverage: feed.coverage,
  // Discovery is intentionally separate from playback verification/publication.
  disabledSourceCandidates: live
    .filter(
      (e) =>
        e.source?.provider === "BWF TV" &&
        /^[\w-]{11}$/.test(e.externalId || ""),
    )
    .map((e) => ({
      id: e.id,
      name: e.kind === "card" ? e.title : e.id,
      type: "embed",
      url: `https://www.youtube-nocookie.com/embed/${e.externalId}`,
      content: "sports",
      eventId: e.id,
      presentation: "live",
      rightsOwner: "Badminton World Federation",
      rightsEvidence:
        "https://www.youtube.com/channel/UChh-akEbUM8_6ghGVnJd6cQ",
      validFrom: generatedAt,
      validUntil: new Date(Date.now() + 4 * 3600000).toISOString(),
      territory: "PROVIDER",
      revoked: true,
      version: 1,
    })),
  warning:
    "A publisher live flag and an embed URL do not prove in-app playback. Source candidates require operator review and an actual browser playback check. Country restrictions remain enforced by the publisher.",
};
mkdirSync("artifacts", { recursive: true });
writeFileSync(
  "artifacts/real-sports-audit.json",
  JSON.stringify(data, null, 2),
);
console.log(
  JSON.stringify(
    {
      generatedAt,
      records: feed.data.length,
      live: live.length,
      sports: data.sports,
      coverage: feed.coverage,
    },
    null,
    2,
  ),
);
