export const locales = ["th", "en"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "th";

/**
 * The chosen language. In production it carries the `__Host-` prefix (ASVS
 * 3.3.3), like the session cookie: the browser then takes it only when Secure,
 * set by this exact host, and scoped to `/`, so no sibling subdomain can plant
 * one. Dev keeps the framework's usual name over plain http://localhost.
 */
export const LOCALE_COOKIE = process.env.NODE_ENV === "production" ? "__Host-torr_locale" : "NEXT_LOCALE";
