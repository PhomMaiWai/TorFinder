// Unit coverage for the checks made on a Google ID token after its signature
// is verified (ASVS 10.1.2, 10.5.1): the nonce must be the one this browser's
// sign-in was given, and the email must be Google-verified. CI can't mint a
// token Google signed, so these claims are tested here directly.
// Loaded from dist — run `npm run build` first.

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { googleClaimsProblem } from "../dist/auth/google-claims.js";

const NONCE = "browser-nonce-0123456789abcdefgh";
const claims = (overrides = {}) => ({
  sub: "1234567890",
  email: "someone@example.com",
  email_verified: true,
  name: "Someone",
  nonce: NONCE,
  ...overrides,
});

describe("googleClaimsProblem", () => {
  it("accepts a verified email with this browser's nonce", () => {
    assert.equal(googleClaimsProblem(claims(), NONCE), null);
  });

  it("refuses a token issued for another sign-in (replayed or lifted)", () => {
    assert.equal(googleClaimsProblem(claims({ nonce: "some-other-nonce-0123456789ab" }), NONCE), "nonce_mismatch");
  });

  it("refuses a token with no nonce at all", () => {
    assert.equal(googleClaimsProblem(claims({ nonce: undefined }), NONCE), "nonce_mismatch");
  });

  it("refuses when the browser has no nonce to compare", () => {
    assert.equal(googleClaimsProblem(claims(), ""), "nonce_mismatch");
  });

  it("refuses an email Google hasn't verified", () => {
    assert.equal(googleClaimsProblem(claims({ email_verified: false }), NONCE), "email_not_verified_by_google");
  });

  it("refuses a token with no email or subject", () => {
    assert.equal(googleClaimsProblem(claims({ email: undefined }), NONCE), "invalid_google_token");
    assert.equal(googleClaimsProblem(claims({ sub: undefined }), NONCE), "invalid_google_token");
    assert.equal(googleClaimsProblem(null, NONCE), "invalid_google_token");
  });
});
