const adFreeHosts = new Set(["db.backinit.live"]);

export function isAdFreeHost(hostname: string) {
  return adFreeHosts.has(hostname.toLowerCase().replace(/\.$/, ""));
}
