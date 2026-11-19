import { timingSafeEqual } from "node:crypto";

/** What a verified Google ID token says, the fields this app reads. */
export type GoogleClaims = { email?: string; email_verified?: boolean; sub?: string; name?: string; nonce?: string };

export type GoogleClaimsProblem = "invalid_google_token" | "email_not_verified_by_google" | "nonce_mismatch";

/**
 * Checks a signature-verified ID token's claims; null when they are fine.
 *
 * The nonce (ASVS 10.1.2, 10.5.1) is the value the frontend gave Google for
 * this browser's sign-in and kept in an HttpOnly cookie. A token that carries
 * another nonce, or none, was issued for a different sign-in: a token lifted
 * from elsewhere can't be replayed here within its hour of validity.
 */
export function googleClaimsProblem(claims: GoogleClaims | null | undefined, expectedNonce: string): GoogleClaimsProblem | null {
  if (!claims?.email || !claims.sub) return "invalid_google_token";
  if (!sameString(claims.nonce, expectedNonce)) return "nonce_mismatch";
  // findOrLinkGoogleUser links by email, so an address Google hasn't proven
  // the caller owns would let them take over the account registered to it.
  if (claims.email_verified !== true) return "email_not_verified_by_google";
  return null;
}

function sameString(actual: string | undefined, expected: string): boolean {
  if (!actual || !expected) return false;
  const a = Buffer.from(actual);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
