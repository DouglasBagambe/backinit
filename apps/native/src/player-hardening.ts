/** App-owned guardrails for third-party players embedded in the native apps. */
export const playerHardeningScript = `(() => {
  const block = (event) => {
    const target = event.target && event.target.closest
      ? event.target.closest('a[href]')
      : null;
    if (!target) return;
    try {
      const destination = new URL(target.href, location.href);
      if (destination.origin !== location.origin) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    } catch (_) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  };
  try {
    window.open = () => null;
    window.alert = () => undefined;
    window.confirm = () => false;
    window.prompt = () => null;
    document.addEventListener('click', block, true);
    document.addEventListener('auxclick', block, true);
  } catch (_) {}
})(); true;`;
