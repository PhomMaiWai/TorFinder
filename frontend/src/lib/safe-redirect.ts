/**
 * The `?next=` page to return to after signing in, only if it stays on this
 * site (ASVS 3.7.2). It must be a path: one leading "/", then not a second "/"
 * or a "\" — browsers read both "//evil.com" and "/\evil.com" as another host —
 * and no backslash or control character anywhere, so nothing can be
 * normalised into a different origin.
 */
export function safeNextPath(next: string | null | undefined, fallback: string): string {
  if (!next || !next.startsWith("/")) return fallback;
  if (next.startsWith("//") || /[\\\u0000-\u001f\u007f]/.test(next)) return fallback;
  // ASVS 1.5.3: the browser will resolve this with the WHATWG URL parser, so
  // the decision is checked with that same parser too: it must stay on this
  // origin, whatever the string rules above missed.
  const BASE = "https://torfinder.invalid";
  let resolved: URL;
  try {
    resolved = new URL(next, BASE);
  } catch {
    return fallback;
  }
  return resolved.origin === BASE ? next : fallback;
}
