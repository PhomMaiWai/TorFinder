/**
 * The nonce that binds a Google sign-in to this browser (ASVS 10.1.2, 10.5.1).
 *
 * GET /api/auth/google/nonce makes a fresh random value, keeps it in an
 * HttpOnly cookie and hands it to the page, which gives it to Google's
 * `initialize({ nonce })`. Google copies it into the ID token. The sign-in
 * routes then send the cookie's value to the backend, which refuses a token
 * whose nonce differs: a credential captured elsewhere carries another nonce
 * (or none), so it can't be replayed in this browser.
 */

const IS_PRODUCTION = process.env.NODE_ENV === "production";

/** `__Host-` in production, like the session cookie: Secure, this host only, path `/`. */
export const GOOGLE_NONCE_COOKIE = IS_PRODUCTION ? "__Host-torr_gnonce" : "torr_gnonce";

/** Long enough to sit on the sign-in page and fill in the company form after Google. */
const NONCE_MAX_AGE = 30 * 60;

export function googleNonceCookieOptions(maxAge: number = NONCE_MAX_AGE) {
  return { httpOnly: true, secure: IS_PRODUCTION, sameSite: "lax" as const, path: "/", maxAge };
}

/** 32 random bytes, base64url. */
export function newGoogleNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Buffer.from(bytes).toString("base64url");
}

/** The nonce cookie's value from a request, or "" (which the backend refuses). */
export function googleNonceFrom(request: Request): string {
  const cookie = request.headers.get("cookie") ?? "";
  for (const part of cookie.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === GOOGLE_NONCE_COOKIE) return decodeURIComponent(rest.join("="));
  }
  return "";
}
