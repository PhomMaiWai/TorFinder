// End-to-end coverage for the Google sign-in endpoint (backend/src/auth), run
// in CI by .github/workflows/auth.yml against a freshly booted backend + MongoDB.
//
// Same approach as auth.e2e.test.mjs: Node's built-in runner + fetch, hitting
// the running server over HTTP.
//
// What this suite can and cannot reach: a real happy path needs an ID token
// actually signed by Google, which CI has no way to mint, so the "approved
// account gets a session" / "new account is left pending" / "existing account
// is linked" branches of AuthService.googleAuth are out of scope here. What is
// testable end to end is everything up to and including token verification:
// request validation, the uniform "not verified" rejection every bad token
// gets, and the route's own (login-independent) rate-limit bucket.

import assert from "node:assert/strict";
import { describe, it } from "node:test";

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:4000";
const API = `${BASE_URL}/api`;

// The Google route has its own throttler bucket, separate from /auth/login, so
// tripping it here doesn't touch the auth suite (and vice versa). Must match
// AUTH_THROTTLE_LIMIT in the workflow.
const AUTH_THROTTLE_LIMIT = Number(process.env.AUTH_THROTTLE_LIMIT ?? "30");

// Copy from AuthService.googleAuth — the message every unverifiable credential
// comes back with, whatever was actually wrong with it.
const NOT_VERIFIED = "ยืนยันบัญชี Google ไม่สำเร็จ";

async function api(path, { method = "GET", body, token } = {}) {
  const headers = {};
  if (body !== undefined) headers["content-type"] = "application/json";
  if (token) headers.authorization = `Bearer ${token}`;

  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const text = await res.text();
  let parsed;
  try {
    parsed = text ? JSON.parse(text) : undefined;
  } catch {
    parsed = text;
  }
  return { status: res.status, body: parsed, headers: res.headers };
}

function googleAuth(body) {
  return api("/auth/google", { method: "POST", body });
}

function message(body) {
  return Array.isArray(body?.message) ? body.message[0] : body?.message;
}

// A structurally valid JWT — three base64url segments, real JSON in the header
// and payload — that Google never signed. Enough to clear DTO validation and
// reach verifyIdToken, which must reject it.
function forgedGoogleJwt(payloadOverrides = {}) {
  const now = Math.floor(Date.now() / 1000);
  const encode = (obj) => Buffer.from(JSON.stringify(obj)).toString("base64url");
  const header = encode({ alg: "RS256", kid: "not-a-real-key", typ: "JWT" });
  const payload = encode({
    iss: "https://accounts.google.com",
    aud: "ci-not-a-real-client-id.apps.googleusercontent.com",
    sub: "1234567890",
    email: "ci-oauth@example.com",
    email_verified: true,
    name: "CI OAuth",
    iat: now,
    exp: now + 3600,
    ...payloadOverrides,
  });
  const signature = Buffer.from("this-is-not-a-real-signature").toString("base64url");
  return `${header}.${payload}.${signature}`;
}

describe("POST /api/auth/google — request validation", () => {
  it("rejects a request with no credential (400)", async () => {
    const res = await googleAuth({});
    assert.equal(res.status, 400);
  });

  it("rejects an empty-string credential (400)", async () => {
    const res = await googleAuth({ credential: "" });
    assert.equal(res.status, 400);
  });

  it("rejects a non-string credential (400)", async () => {
    const res = await googleAuth({ credential: 1234567890 });
    assert.equal(res.status, 400);
  });
});

describe("POST /api/auth/google — token verification", () => {
  it("is mounted: an unverifiable credential is 401, not 404", async () => {
    const res = await googleAuth({ credential: "not-a-jwt" });
    assert.equal(res.status, 401);
  });

  it("rejects a credential with the wrong number of segments (401)", async () => {
    const res = await googleAuth({ credential: "one-segment-only" });
    assert.equal(res.status, 401);
    assert.equal(message(res.body), NOT_VERIFIED);
  });

  it("rejects three segments that aren't base64url JSON (401)", async () => {
    const res = await googleAuth({ credential: "aaa.bbb.ccc" });
    assert.equal(res.status, 401);
    assert.equal(message(res.body), NOT_VERIFIED);
  });

  it("rejects a well-formed JWT that Google never signed (401)", async () => {
    const res = await googleAuth({ credential: forgedGoogleJwt() });
    assert.equal(res.status, 401);
    assert.equal(message(res.body), NOT_VERIFIED);
  });

  it("rejects a forged token even when its claims look valid and unexpired (401)", async () => {
    const res = await googleAuth({ credential: forgedGoogleJwt({ exp: Math.floor(Date.now() / 1000) + 86_400 }) });
    assert.equal(res.status, 401);
  });

  it("never issues a session cookie for a rejected credential", async () => {
    const res = await googleAuth({ credential: forgedGoogleJwt() });
    assert.equal(res.status, 401);
    assert.equal(res.headers.get("set-cookie"), null);
    assert.equal(res.body?.token, undefined);
  });
});

describe("POST /api/auth/google — brute-force protection", () => {
  it("starts returning 429 once the per-window limit is exceeded", async () => {
    const attempts = AUTH_THROTTLE_LIMIT + 15;
    const statuses = [];
    for (let i = 0; i < attempts; i += 1) {
      const res = await googleAuth({ credential: forgedGoogleJwt() });
      statuses.push(res.status);
    }

    assert.ok(
      statuses.includes(429),
      `expected at least one 429 within ${attempts} rapid attempts, saw ${JSON.stringify(
        [...new Set(statuses)],
      )}`,
    );
  });
});
