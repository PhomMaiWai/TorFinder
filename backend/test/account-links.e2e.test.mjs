// End-to-end coverage for the emailed links — password reset and email
// verification — run in CI against a freshly booted backend + MongoDB.
//
// No mail is sent in CI (no RESEND_API_KEY), and only a token's hash is
// stored, so a test can't read a link back. Instead it writes a link of its
// own straight into `authTokens`, knowing the raw token, and then drives the
// public routes with it exactly as the emailed page would.
//
// Sign-up and login share rate-limit buckets with the other suites, so each
// describe signs up one account and walks it through its steps in order.

import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { after, before, describe, it } from "node:test";

import { MongoClient } from "mongodb";

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:4000";
const API = `${BASE_URL}/api`;
const mongo = new MongoClient(process.env.MONGODB_URI ?? "mongodb://localhost:27017/torfinder");
const db = () => mongo.db();

async function api(path, body) {
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : undefined };
}

let suffix = 0;
async function signup() {
  suffix += 1;
  const org = {
    email: `ci+links-${Date.now()}-${suffix}@example.com`,
    password: "Str0ngPass!",
    companyName: `CI Links Co ${suffix}`,
    taxId: "0105563001236",
    contactName: "CI Runner",
    phone: "0812345678",
    address: "1 CI Street, Bangkok",
    specialty: "software",
    size: "1-10",
  };
  const res = await api("/auth/signup", org);
  assert.equal(res.status, 201, `signup failed: ${JSON.stringify(res.body)}`);
  return org;
}

const userOf = (email) => db().collection("users").findOne({ email });

/** A link as the backend would have mailed it, returned as the raw token. */
async function plantLink(email, purpose, { expiresInMs = 60_000 } = {}) {
  const user = await userOf(email);
  const token = randomBytes(32).toString("base64url");
  await db()
    .collection("authTokens")
    .insertOne({
      userId: user._id,
      purpose,
      tokenHash: createHash("sha256").update(token).digest("hex"),
      expiresAt: new Date(Date.now() + expiresInMs),
      createdAt: new Date(),
    });
  return token;
}

const linksFor = async (email, purpose) =>
  db().collection("authTokens").countDocuments({ userId: (await userOf(email))._id, purpose });

before(() => mongo.connect());
after(() => mongo.close());

describe("email verification on sign-up", () => {
  let org;
  before(async () => {
    org = await signup();
  });

  it("issues a link at sign-up and refuses a password sign-in until it is used", async () => {
    assert.equal((await userOf(org.email)).emailVerified, false);
    assert.equal(await linksFor(org.email, "email-verify"), 1);

    const res = await api("/auth/login", { email: org.email, password: org.password });
    assert.equal(res.status, 403);
    assert.equal(res.body.code, "email-unverified");
  });

  it("refuses an expired link", async () => {
    const token = await plantLink(org.email, "email-verify", { expiresInMs: -1_000 });

    assert.equal((await api("/auth/email/verify", { token })).status, 400);
    assert.equal((await userOf(org.email)).emailVerified, false);
  });

  it("refuses a reset link offered as a verification link", async () => {
    const token = await plantLink(org.email, "password-reset");
    assert.equal((await api("/auth/email/verify", { token })).status, 400);
  });

  it("resends by replacing the old link, and answers alike for unknown addresses", async () => {
    const old = await plantLink(org.email, "email-verify");

    const resent = await api("/auth/email/resend", { email: org.email });
    const unknown = await api("/auth/email/resend", { email: `nobody-${Date.now()}@example.com` });
    assert.equal(resent.status, 200);
    assert.deepEqual(unknown, resent);

    assert.equal(await linksFor(org.email, "email-verify"), 1);
    assert.equal((await api("/auth/email/verify", { token: old })).status, 400, "the replaced link is dead");
  });

  it("verifies with a live link, then only the admin's approval is left", async () => {
    const token = await plantLink(org.email, "email-verify");

    const verified = await api("/auth/email/verify", { token });
    assert.equal(verified.status, 200);
    assert.equal(verified.body.status, "pending");
    assert.equal((await userOf(org.email)).emailVerified, true);

    const res = await api("/auth/login", { email: org.email, password: org.password });
    assert.equal(res.status, 403);
    assert.notEqual(res.body.code, "email-unverified");

    assert.equal((await api("/auth/email/verify", { token })).status, 400, "a used link is dead");
  });
});

describe("password reset", () => {
  let org;
  const newPassword = "N3wPassword!";
  before(async () => {
    org = await signup();
    // Approved, so a sign-in that gets past the password succeeds outright.
    await db().collection("users").updateOne({ email: org.email }, { $set: { status: "approved" } });
  });

  it("answers the same for a known and an unknown address, and issues a link only for the known one", async () => {
    const known = await api("/auth/password/forgot", { email: org.email });
    const unknown = await api("/auth/password/forgot", { email: `nobody-${Date.now()}@example.com` });
    assert.equal(known.status, 200);
    assert.deepEqual(unknown, known);
    assert.equal(await linksFor(org.email, "password-reset"), 1);
  });

  it("refuses an expired link and keeps the old password", async () => {
    const oldHash = (await userOf(org.email)).passwordHash;
    const token = await plantLink(org.email, "password-reset", { expiresInMs: -1_000 });

    assert.equal((await api("/auth/password/reset", { token, password: newPassword })).status, 400);
    assert.equal((await userOf(org.email)).passwordHash, oldHash);
  });

  it("refuses a verification link offered as a reset link", async () => {
    const token = await plantLink(org.email, "email-verify");
    assert.equal((await api("/auth/password/reset", { token, password: newPassword })).status, 400);
  });

  it("refuses a password shorter than sign-up allows, leaving the link usable", async () => {
    const token = await plantLink(org.email, "password-reset");

    assert.equal((await api("/auth/password/reset", { token, password: "short" })).status, 400);
    assert.equal((await api("/auth/password/reset", { token, password: newPassword })).status, 200);
    assert.equal((await api("/auth/password/reset", { token, password: "Another1Pass!" })).status, 400, "used once");
  });

  it("signs in with the new password only, and the address now counts as verified", async () => {
    assert.equal((await userOf(org.email)).emailVerified, true);
    assert.equal((await api("/auth/login", { email: org.email, password: org.password })).status, 401);

    const res = await api("/auth/login", { email: org.email, password: newPassword });
    assert.equal(res.status, 200);
    assert.equal(typeof res.body.token, "string");
  });
});
