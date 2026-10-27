import Link from "next/link";
import { Activity, ChevronRight } from "lucide-react";
export { Crest } from "./marks";
export function Empty({ title, text }: { title: string; text: string }) {
  return (
    <div className="empty">
      <Activity size={28} />
      <h3>{title}</h3>
      <p>{text}</p>
      <Link href="/scores">
        Browse scores <ChevronRight size={15} />
      </Link>
    </div>
  );
}
