import { GOOGLE_NONCE_COOKIE, googleNonceCookieOptions, newGoogleNonce } from "@/lib/google-nonce";
import { jsonResponse } from "@/lib/json-response";

/**
 * A fresh nonce for Google sign-in, kept in an HttpOnly cookie and returned to
 * the page for `google.accounts.id.initialize({ nonce })` (see lib/google-nonce.ts).
 * POST so a cross-site <img> or link can't mint one; the response is never cached.
 */
export async function POST() {
  const nonce = newGoogleNonce();
  const response = jsonResponse({ nonce });
  response.cookies.set(GOOGLE_NONCE_COOKIE, nonce, googleNonceCookieOptions());
  return response;
}
