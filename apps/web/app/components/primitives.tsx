import Link from "next/link";
import { Activity, ChevronRight } from "lucide-react";
export function Crest({
  name,
  large = false,
}: {
  name: string;
  large?: boolean;
}) {
  return (
    <span
      className={`crest ${large ? "large" : ""} crest-${name.charCodeAt(0) % 5}`}
      aria-hidden="true"
    >
      {name
        .split(" ")
        .map((w) => w[0])
        .slice(0, 2)
        .join("")}
    </span>
  );
}
export function Empty({ title, text }: { title: string; text: string }) {
  return (
    <div className="empty">
      <Activity size={28} />
      <h3>{title}</h3>
      <p>{text}</p>
      <Link href="/scores">
        Explore demo events <ChevronRight size={15} />
      </Link>
    </div>
  );
}
