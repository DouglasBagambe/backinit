import { trackerSourceSchema } from "../../../../packages/domain/src/index.js";

/** Relay only the matched public embed document; keep its publisher branding and upstream widget intact. */
export async function trackerView(
  source: unknown,
  theme: "light" | "dark",
  fetcher: typeof fetch = fetch,
) {
  const checked = trackerSourceSchema.parse(source);
  if (
    checked.provider !== "SportScore" ||
    Date.parse(checked.validUntil) <= Date.now()
  )
    throw new Error("No current publisher view");
  const response = await fetcher(`${checked.url}?theme=${theme}`, {
    redirect: "error",
    signal: AbortSignal.timeout(12000),
    headers: { "User-Agent": "BackInIt/0.2", Accept: "text/html" },
  });
  if (
    !response.ok ||
    !response.headers.get("content-type")?.includes("text/html")
  )
    throw new Error("Publisher view unavailable");
  const html = await response.text();
  // Do not present a CDN error/challenge page as a live tracker.
  if (
    html.length > 500000 ||
    !/<head\b/i.test(html) ||
    !/<iframe\b/i.test(html) ||
    !html.includes("widgets.thesports01.com")
  )
    throw new Error("Publisher widget missing");
  const id = JSON.stringify(checked.eventId);
  const bridge = `<base href="https://sportscore.com/"><script>(()=>{const eventId=${id};const send=(type,extra={})=>parent.postMessage({type,eventId,...extra},'*');let ready=false;const size=()=>send('backinit:tracker-size',{height:Math.ceil(document.documentElement.scrollHeight)});const watch=()=>{document.querySelectorAll('iframe').forEach(frame=>{if(frame.dataset.backinitWatched)return;frame.dataset.backinitWatched='1';frame.addEventListener('load',()=>{ready=true;send('backinit:tracker-ready');size()});frame.addEventListener('error',()=>send('backinit:tracker-error'))})};new MutationObserver(watch).observe(document.documentElement,{childList:true,subtree:true});watch();window.addEventListener('resize',size);window.addEventListener('load',()=>{watch();if(ready)size()});})();</script>`;
  return html.replace(/<head\b[^>]*>/i, (match) => match + bridge);
}
