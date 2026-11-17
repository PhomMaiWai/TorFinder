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
  return next;
}
