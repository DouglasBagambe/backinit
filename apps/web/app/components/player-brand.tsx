import { BrandMark } from "./brand";
/** Outside third-party content: never obscures provider branding or player controls. */
export function PlayerBrand({ overlay = false }: { overlay?: boolean }) {
  return (
    <span
      className={`player-brand${overlay ? " player-brand-overlay" : ""}`}
      aria-hidden="true"
    >
      <BrandMark />
      <svg viewBox="0 0 55 14" className="player-brand-word">
        <text x="0" y="11" fill="currentColor">
          backinit.
        </text>
      </svg>
    </span>
  );
}
