"use client";
import { useState } from "react";
import { Radio, Gamepad2 } from "lucide-react";
import { Crest } from "./marks";
import type { SportEvent } from "@backinit/domain";
import type { Broadcast } from "@backinit/domain";
const regions = [
  [/\b(?:UK|United Kingdom)\b/i, "GB", "United Kingdom"],
  [/\b(?:USA|US|United States)\b/i, "US", "United States"],
  [/\b(?:Italy|Italia|IT)\b/i, "IT", "Italy"],
  [/\b(?:Serbia)\b/i, "RS", "Serbia"],
  [/\b(?:Croatia)\b/i, "HR", "Croatia"],
  [/\b(?:BiH|Bosnia)\b/i, "BA", "Bosnia and Herzegovina"],
  [/\b(?:Germany|DE)\b/i, "DE", "Germany"],
  [/\b(?:France)\b/i, "FR", "France"],
  [/\b(?:Spain|ES)\b/i, "ES", "Spain"],
  [/\b(?:Portugal|PT)\b/i, "PT", "Portugal"],
  [/\b(?:Poland|PL)\b/i, "PL", "Poland"],
  [/\b(?:UAE)\b/i, "AE", "United Arab Emirates"],
  [/\b(?:Sweden)\b/i, "SE", "Sweden"],
  [/\b(?:NL|Netherlands)\b/i, "NL", "Netherlands"],
  [/\b(?:NZ|New Zealand)\b/i, "NZ", "New Zealand"],
] as const;
export function ChannelRegion({ name }: { name: string }) {
  const region = regions.find(([pattern]) => pattern.test(name));
  if (!region) return null;
  const flag = String.fromCodePoint(
    ...[...region[1]].map((c) => 127397 + c.charCodeAt(0)),
  );
  return (
    <span className="channel-region">
      <span aria-hidden="true">{flag}</span> {region[2]}
    </span>
  );
}
export function BroadcastArtwork({
  item,
  event,
}: {
  item: Broadcast;
  event?: SportEvent | null;
}) {
  const [failed, setFailed] = useState<string | null>(null);
  if (item.poster && failed !== item.poster)
    return (
      <img
        className={
          item.channel && item.id.startsWith("ext-")
            ? "channel-logo-image"
            : undefined
        }
        src={item.poster}
        alt=""
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setFailed(item.poster)}
      />
    );
  if (event?.kind === "score")
    return (
      <span className="match-duel-art" aria-hidden="true">
        <span className="match-duel-side">
          <Crest name={event.home} imageUrl={event.homeParticipant?.imageUrl} />
          <strong>{event.home}</strong>
        </span>
        <span className="match-duel-vs">vs</span>
        <span className="match-duel-side">
          <Crest name={event.away} imageUrl={event.awayParticipant?.imageUrl} />
          <strong>{event.away}</strong>
        </span>
      </span>
    );
  const words = item.title.split(/\s+/).filter(Boolean);
  const initials = words
    .slice(0, 3)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
  return (
    <span
      className={`broadcast-identity ${item.channel ? "channel-identity" : "match-identity"}`}
      aria-hidden="true"
    >
      {item.channel ? (
        <>
          <span className="channel-monogram">{initials}</span>
          <span className="channel-wordmark">
            {words.slice(0, 3).join(" ")}
          </span>
        </>
      ) : (
        <>
          <span className="match-sport-symbol">
            {item.category === "Esports" ? (
              <Gamepad2 size={32} />
            ) : (
              <Radio size={28} />
            )}
          </span>
          <span className="match-art-title">{item.title}</span>
        </>
      )}
    </span>
  );
}
