/** How often a sidebar badge re-reads its count while the tab is in view. */
export const BADGE_POLL_MS = 30_000;

/**
 * Calls `refresh` every `intervalMs` while the tab is visible, and once more as
 * soon as the tab comes back into view. Returns a stop function. A hidden tab
 * makes no requests.
 */
export function pollWhileVisible(refresh: () => void, intervalMs = BADGE_POLL_MS): () => void {
  if (typeof window === "undefined") return () => {};

  const timer = window.setInterval(() => {
    if (document.visibilityState === "visible") refresh();
  }, intervalMs);

  function onVisibilityChange() {
    if (document.visibilityState === "visible") refresh();
  }
  document.addEventListener("visibilitychange", onVisibilityChange);

  return () => {
    window.clearInterval(timer);
    document.removeEventListener("visibilitychange", onVisibilityChange);
  };
}
