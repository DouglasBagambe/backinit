/** Keep provider popups and ad redirects from replacing the native player. */
export function isPlayerNavigationAllowed(
  playerUrl: string,
  requestedUrl: string,
) {
  if (requestedUrl === "about:blank") return true;
  try {
    const player = new URL(playerUrl);
    const requested = new URL(requestedUrl, player);
    return (
      requested.protocol === "https:" && requested.origin === player.origin
    );
  } catch {
    return false;
  }
}
