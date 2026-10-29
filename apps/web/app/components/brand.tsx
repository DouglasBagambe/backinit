import { useId } from "react";

/** Football and broadcast arcs; transparent panel seams work on every surface. */
export function BrandMark({ className = "" }: { className?: string }) {
  const mask = `brand-${useId()}`;
  return (
    <svg
      className={`brand-symbol ${className}`}
      viewBox="0 0 100 64"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <mask id={mask}>
          <circle cx="50" cy="32" r="25" fill="white" />
          <path
            d="M50 21 60.5 28.6 56.5 41 43.5 41 39.5 28.6Z M50 21V7 M60.5 28.6 74 23 M56.5 41 65 54 M43.5 41 35 54 M39.5 28.6 26 23"
            fill="none"
            stroke="black"
            strokeWidth="3"
            strokeLinejoin="round"
          />
        </mask>
      </defs>
      <circle cx="50" cy="32" r="25" mask={`url(#${mask})`} />
      <path
        d="M16 13a31 31 0 0 0 0 38 M84 13a31 31 0 0 1 0 38"
        fill="none"
        stroke="currentColor"
        strokeWidth="7"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function BrandLoading({ label = "Loading" }: { label?: string }) {
  return (
    <span className="brand-loading" role="status">
      <BrandMark />
      <span className="sr-only">{label}</span>
    </span>
  );
}

export function EventSkeleton({
  label = "Loading events",
}: {
  label?: string;
}) {
  return (
    <div className="event-skeleton" role="status" aria-busy="true">
      <span className="sr-only">{label}</span>
      <div aria-hidden="true" className="skeleton-competition" />
      {[0, 1, 2, 3].map((i) => (
        <div className="skeleton-event" aria-hidden="true" key={i}>
          <span className="skeleton-time" />
          <div>
            <span />
            <span />
          </div>
          <span className="skeleton-action" />
        </div>
      ))}
    </div>
  );
}
