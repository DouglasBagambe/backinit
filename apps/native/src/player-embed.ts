/** Give embed-only providers a real parent document and an HTTPS referrer. */
export function nativePlayerDocument(url: string) {
  const embed = new URL(url);
  if (embed.protocol !== "https:") throw new Error("Playback requires HTTPS");
  if (
    embed.hostname === "www.youtube-nocookie.com" ||
    embed.hostname === "www.youtube.com"
  ) {
    embed.searchParams.set("enablejsapi", "1");
    embed.searchParams.set("origin", "https://backinit.live");
    embed.searchParams.set("playsinline", "1");
  }
  const escaped = embed.href
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
  return {
    baseUrl: "https://backinit.live/",
    html: `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="strict-origin-when-cross-origin"><style>html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#000}iframe{display:block;border:0;width:100%;height:100%}</style></head><body><iframe title="Stream player" src="${escaped}" referrerpolicy="strict-origin-when-cross-origin" allow="autoplay; fullscreen; encrypted-media; picture-in-picture" allowfullscreen sandbox="allow-scripts allow-same-origin allow-forms allow-presentation"></iframe></body></html>`,
  };
}
