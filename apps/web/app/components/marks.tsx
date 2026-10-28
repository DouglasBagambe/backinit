"use client";
import { useState } from "react";
import { Globe2 } from "lucide-react";
const sportPhotos: Record<string, string> = {
  Football: "/sports/football.webp",
  Basketball: "/sports/basketball.webp",
  Tennis: "/sports/tennis.webp",
  Cricket: "/sports/cricket.webp",
  Rugby: "/sports/rugby.webp",
  "American football": "/sports/american-football.webp",
  Baseball: "/sports/baseball.webp",
};
import logoFiles from "../lib/logos.json";
const logos: Record<string, string> = logoFiles;
export function Crest({
  name,
  large = false,
  imageUrl,
}: {
  name: string;
  large?: boolean;
  imageUrl?: string;
}) {
  const [failed, setFailed] = useState<string[]>([]);
  const source = [imageUrl, logos[name]].find(
    (url) => !!url && !failed.includes(url),
  );
  return (
    <span
      className={`crest real-crest ${large ? "large" : ""}`}
      aria-hidden="true"
    >
      {source ? (
        <img
          key={source}
          src={source}
          alt=""
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFailed((old) => [...old, source])}
        />
      ) : (
        <span className="crest-fallback">
          {name
            .split(/\s+/)
            .slice(0, 2)
            .map((n) => n[0])
            .join("")}
        </span>
      )}
    </span>
  );
}

export function SportMark({ name }: { name: string }) {
  if (name === "All sports")
    return (
      <span
        className="all-sports-mark"
        aria-hidden="true"
        data-sport-image="All sports"
      >
        {["Football", "Basketball", "Tennis"].map((s) => (
          <img
            key={s}
            src={sportPhotos[s]}
            alt=""
            width="18"
            height="18"
            decoding="async"
          />
        ))}
      </span>
    );
  const normalized =
    name === "WWE Vault" ? "WWE" : name === "FORMULA 1" ? "Formula 1" : name;
  const photo = sportPhotos[normalized];
  const source = photo || logos[normalized];
  return source ? (
    <img
      className={photo ? "sport-mark sport-photo" : "sport-mark"}
      data-sport-image={normalized}
      src={source}
      width="24"
      height="24"
      alt=""
      aria-hidden="true"
      decoding="async"
    />
  ) : (
    <Globe2 size={20} aria-hidden="true" />
  );
}
