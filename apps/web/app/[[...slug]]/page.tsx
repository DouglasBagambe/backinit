import { Suspense } from "react";
import { RouteLoading } from "../components/route-loading";
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
  const requestedRoute = slug.join("/");
  const route = requestedRoute === "home" ? "" : requestedRoute;
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
    "broadcasts",
    "multiview",
  ];
  if (
    !(
      slug[0] === "explore" &&
      slug.length === 2 &&
      ["team", "athlete", "competition"].includes(slug[1]!)
    ) &&
    !pages.includes(route) &&
    !(slug.length === 2 && ["match", "watch"].includes(slug[0]!)) &&
    !(
      slug[0] === "sport" &&
      slug.length === 2 &&
      sports.some((s) => s.toLowerCase().replaceAll(" ", "-") === slug[1])
    )
  )
    notFound();
  return (
    <Suspense fallback={<RouteLoading />}>
      <PageContent route={route} slug={slug} pages={pages} />
    </Suspense>
  );
}
async function PageContent({
  route,
  slug,
  pages,
}: {
  route: string;
  slug: string[];
  pages: string[];
}) {
  const selected = (await cookies()).get("backinit-edition")?.value;
  const requestedEdition =
    ["watch", "broadcasts", "multiview"].includes(route) ||
    route.startsWith("watch/")
      ? "real"
      : selected === "demo"
        ? "demo"
        : selected === "real"
          ? "real"
          : undefined;
  const { feed, news } = await loadPageData(route, requestedEdition);
  if (
    !(
      slug[0] === "explore" &&
      slug.length === 2 &&
      ["team", "athlete", "competition"].includes(slug[1]!)
    ) &&
    !pages.includes(route) &&
    !(
      ["match", "watch"].includes(slug[0] || "") &&
      slug.length === 2 &&
      (feed.data.some((e) => e.id === slug[1]) ||
        (slug[0] === "watch" && /^ppv-\d+$/.test(slug[1] || "")))
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

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}) {
  const { slug = [] } = await params;
  const route = slug[0] || "";
  const titles: Record<string, string> = {
    watch: "Watch live sport",
    scores: "Scores & results",
    fixtures: "Fixtures",
    live: "Live scores",
    news: "Sports news",
    search: "Search sport",
    teams: "Teams",
    athletes: "Athletes",
    competitions: "Competitions",
    settings: "Settings",
    profile: "Account",
    multiview: "Multiview",
    privacy: "Privacy",
  };
  return {
    title:
      titles[route] ||
      (route === "match"
        ? "Match centre"
        : route === "explore"
          ? "Sport profile"
          : "Live sport, scores & streams"),
    ...(["admin", "profile", "settings", "favorites", "search"].includes(route)
      ? { robots: { index: false, follow: false } }
      : {}),
  };
}
