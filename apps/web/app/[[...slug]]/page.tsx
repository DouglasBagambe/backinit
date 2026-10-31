import { demoEnabled } from "../lib/edition";
import { notFound } from "next/navigation";
import { sports } from "@backinit/domain";
import { cookies } from "next/headers";
import { Experience } from "../components/experience";
import { loadPageData } from "../lib/page-loader";
export default async function Page({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}) {
  const { slug = [] } = await params;
  const route = slug.join("/");
  if (route === "playback" && !demoEnabled()) notFound();
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
    "privacy",
    "videos",
    "playback",
  ];
  if (
    !pages.includes(route) &&
    !(slug.length === 2 && ["match", "watch"].includes(slug[0]!)) &&
    !(
      slug[0] === "sport" &&
      slug.length === 2 &&
      sports.some((s) => s.toLowerCase().replaceAll(" ", "-") === slug[1])
    )
  )
    notFound();
  const selected = (await cookies()).get("backinit-edition")?.value;
  const requestedEdition =
    route === "watch" || route.startsWith("watch/")
      ? "real"
      : selected === "demo"
        ? "demo"
        : selected === "real"
          ? "real"
          : undefined;
  const { feed, news } = await loadPageData(route, requestedEdition);
  if (
    !pages.includes(route) &&
    !(
      ["match", "watch"].includes(slug[0] || "") &&
      slug.length === 2 &&
      feed.data.some((e) => e.id === slug[1])
    ) &&
    !(
      slug[0] === "sport" &&
      slug.length === 2 &&
      sports.some((s) => s.toLowerCase().replaceAll(" ", "-") === slug[1])
    )
  )
    notFound();
  return (
    <Experience
      route={route}
      initialEvents={feed.data}
      feedSource={feed.source}
      edition={feed.edition}
      coverage={feed.coverage}
      news={news}
      demoAvailable={demoEnabled()}
      nativeAdsEnabled={process.env.ADSTERRA_NATIVE_ENABLED !== "false"}
    />
  );
}
