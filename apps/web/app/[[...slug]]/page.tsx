import { notFound } from "next/navigation";
import { events, sports } from "@backinit/domain";
import { loadEvents } from "../lib/feed";
import { Experience } from "../components/experience";
export default async function Page({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}) {
  const { slug = [] } = await params;
  const route = slug.join("/");
  const pages = [
    "",
    "live",
    "scores",
    "watch",
    "fixtures",
    "news",
    "search",
    "favorites",
    "settings",
    "profile",
    "admin",
    "competitions",
    "teams",
    "athletes",
  ];
  if (
    !pages.includes(route) &&
    !(
      slug[0] === "match" &&
      slug.length === 2 &&
      events.some((e) => e.id === slug[1])
    ) &&
    !(
      slug[0] === "sport" &&
      slug.length === 2 &&
      sports.some((s) => s.toLowerCase().replaceAll(" ", "-") === slug[1])
    )
  )
    notFound();
  const feed = await loadEvents();
  return (
    <Experience
      route={route}
      initialEvents={feed.data}
      feedSource={feed.source}
    />
  );
}
