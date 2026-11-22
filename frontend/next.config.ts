import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

/**
 * Sent on every page, route handler and static file. Browsers talk to this
 * server, not the backend, so the backend's helmet() headers never reach them.
 */
const SECURITY_HEADERS = [
  // ASVS 3.4.1: HTTPS only for a year once seen over HTTPS (ignored on plain HTTP, so local dev is unaffected).
  // ASVS 3.7.4: `preload` asks browsers to ship this domain as HTTPS-only;
  // it takes effect once the domain is submitted (deployment checklist).
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains; preload" },
  // Level 2 extras that cost nothing: no MIME sniffing, no full URLs (and their
  // one-time ?token= links) leaked to other sites, and no framing by other sites.
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // The fallback policy for every response the proxy doesn't set its nonce
  // policy on: the proxy's matcher skips file-like paths (.txt, .xml, .png…),
  // so a missing /robots.txt or /x.png answered with the HTML 404 page used to
  // carry only frame-ancestors (ZAP DAST, docs/security/dast-report.md). No
  // inline script and nothing from another origin; the proxy's own header
  // replaces this one on every page and API route it handles.
  {
    key: "Content-Security-Policy",
    value:
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; " +
      "object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'self'; " +
      "report-uri /api/csp-report; report-to csp",
  },
  // ASVS 3.4.7: where `report-to csp` sends violation reports.
  { key: "Reporting-Endpoints", value: 'csp="/api/csp-report"' },
  // ASVS 3.4.8: no other window keeps a handle on ours (tabnabbing, frame
  // counting). "allow-popups" because the Google sign-in pop-up reports back
  // to the window that opened it.
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
  // ASVS 3.5.8: other sites can't embed our responses — including a signed-in
  // user's certificate and library files — as images, scripts or media.
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  // docs/SECURITY.md G12 (ZAP 10063): no page here uses these browser
  // features, so none of them may be used, by us or by anything embedded.
  // Passkeys (publickey-credentials-get/create) keep their default: this origin.
  {
    key: "Permissions-Policy",
    value:
      "accelerometer=(), autoplay=(), camera=(), display-capture=(), geolocation=(), gyroscope=(), " +
      "magnetometer=(), microphone=(), midi=(), payment=(), usb=(), interest-cohort=()",
  },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
};

export default withNextIntl(nextConfig);
