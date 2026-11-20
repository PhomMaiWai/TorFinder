/**
 * ASVS 3.7.3: a link that leaves TorFinder goes through /leaving first, which
 * names the destination and offers a way back. Relative and non-web links
 * (our own pages and /api files) are returned unchanged.
 */
export function leavingHref(href: string | undefined): string | undefined {
  if (!href || !/^https?:\/\//i.test(href)) return href;
  return `/leaving?to=${encodeURIComponent(href)}`;
}

/** The destination /leaving may show: an absolute http(s) URL, or null for anything else. */
export function leavingTarget(to: string | undefined): URL | null {
  if (!to) return null;
  try {
    const url = new URL(to);
    return url.protocol === "https:" || url.protocol === "http:" ? url : null;
  } catch {
    return null;
  }
}
