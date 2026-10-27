import { cookies } from "next/headers";
import { loadEvent } from "../../../lib/feed";
import { eventTitle } from "@backinit/domain";
const escape = (value: string) =>
  value
    .replaceAll("\\", "\\\\")
    .replaceAll(";", "\\;")
    .replaceAll(",", "\\,")
    .replace(/\r?\n/g, "\\n");
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!/^[a-z0-9-]{1,80}$/.test(id))
    return new Response("Invalid event", { status: 400 });
  const selected = (await cookies()).get("backinit-edition")?.value;
  const edition =
    selected === "demo"
      ? "demo"
      : selected === "real"
        ? "real"
        : process.env.SPORTS_DATA_MODE === "demo"
          ? "demo"
          : "real";
  const event = await loadEvent(id, edition);
  if (!event) return new Response("Event unavailable", { status: 404 });
  const stamp = (value: string) =>
    value.replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const body = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//BackInIt//Matchday//EN",
    "BEGIN:VEVENT",
    `UID:${escape(id)}@backinit`,
    `DTSTAMP:${stamp(new Date().toISOString())}`,
    `DTSTART:${stamp(event.start)}`,
    `SUMMARY:${escape((edition === "demo" ? "DEMO: " : "") + eventTitle(event))}`,
    `DESCRIPTION:${escape(`${event.competition}. Schedule may change. ${event.source?.provider || "Illustrative event"}.`)}`,
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ];
  // RFC5545 fold long content lines at <=75 octets, without splitting Unicode characters.
  const folded = body
    .map((line) => {
      let out = "",
        bytes = 0;
      for (const ch of line) {
        const n = Buffer.byteLength(ch);
        if (bytes + n > 73) {
          out += "\r\n ";
          bytes = 1;
        }
        out += ch;
        bytes += n;
      }
      return out;
    })
    .join("\r\n");
  return new Response(folded, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="backinit-${id}.ics"`,
      "Cache-Control": "no-store",
    },
  });
}
