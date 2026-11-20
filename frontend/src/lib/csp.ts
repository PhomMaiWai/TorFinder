/**
 * ASVS 3.4.3: a strict policy for every page, with a fresh nonce per request.
 * Next.js puts the nonce on its own scripts and on every `next/script`, and
 * `'strict-dynamic'` lets those load what they need (the Google sign-in
 * script) — any other script, inline or injected, is refused. Inline style
 * attributes stay allowed: React and the Google button use them, and styles
 * can't run code.
 *
 * The proxy sets this on every page; `next.config.ts` sends a stricter
 * fallback on the responses the proxy skips. `test/csp.test.mts` checks both.
 */
export function pageContentSecurityPolicy(nonce: string, isDev: boolean = process.env.NODE_ENV === "development"): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://accounts.google.com/gsi/client${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline' https://accounts.google.com/gsi/style",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src 'self' https://accounts.google.com/gsi/${isDev ? " ws: wss:" : ""}`,
    "frame-src 'self' https://accounts.google.com/gsi/",
    "object-src 'none'",
    // ASVS 3.4.3 asks for 'none': nothing here uses a <base> element.
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'self'",
    // ASVS 3.4.7: violations go to app/api/csp-report (Reporting-Endpoints in next.config.ts).
    "report-uri /api/csp-report",
    "report-to csp",
  ].join("; ");
}

/** A fresh, unguessable nonce for one response (122 random bits from `randomUUID`). */
export function newCspNonce(): string {
  return btoa(crypto.randomUUID());
}
