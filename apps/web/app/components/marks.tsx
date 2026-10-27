"use client";
import { CircleDot, Flag, Swords, Trophy } from "lucide-react";
import logoFiles from "../lib/logos.json";
const logos: Record<string, string> = logoFiles;
export function Crest({
  name,
  large = false,
}: {
  name: string;
  large?: boolean;
}) {
  return (
    <span
      className={`crest real-crest ${large ? "large" : ""}`}
      aria-hidden="true"
    >
      {logos[name] && (
        <img
          src={logos[name]}
          alt=""
          loading="lazy"
          decoding="async"
          onError={(e) => {
            e.currentTarget.style.visibility = "hidden";
          }}
        />
      )}
    </span>
  );
}
export function SportMark({ name }: { name: string }) {
  const source =
    logos[
      name === "WWE Vault" ? "WWE" : name === "FORMULA 1" ? "Formula 1" : name
    ];
  if (source)
    return (
      <img className="sport-mark" src={source} alt="" aria-hidden="true" />
    );
  const Icon =
    name === "Formula 1"
      ? Flag
      : name === "MMA"
        ? Swords
        : name === "Football" || name === "Basketball" || name === "Tennis"
          ? CircleDot
          : Trophy;
  return <Icon className="sport-symbol" size={16} aria-hidden="true" />;
}
