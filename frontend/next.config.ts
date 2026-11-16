import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

/**
 * Sent on every page, route handler and static file. Browsers talk to this
 * server, not the backend, so the backend's helmet() headers never reach them.
 */
const SECURITY_HEADERS = [
  // ASVS 3.4.1: HTTPS only for a year once seen over HTTPS (ignored on plain HTTP, so local dev is unaffected).
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  // Level 2 extras that cost nothing: no MIME sniffing, no full URLs (and their
  // one-time ?token= links) leaked to other sites, and no framing by other sites.
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
};

export default withNextIntl(nextConfig);
