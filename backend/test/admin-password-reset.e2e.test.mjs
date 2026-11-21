// End-to-end coverage for ASVS 6.4.6: an admin starts a password reset for an
// account without choosing or seeing the password. The owner gets the same
// single-use link as "forgot password"; their password is untouched until
// they use it. Run in CI against a freshly booted backend + MongoDB.

import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { after, before, describe, it } from "node:test";

import { MongoClient, ObjectId } from "mongodb";

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:4000";
const API = `${BASE_URL}/api`;
const mongo = new MongoClient(process.env.MONGODB_URI ?? "mongodb://localhost:27017/torfinder");
const db = () => mongo.db();

// Mirrors backend/src/common/token.ts; must match the server's SESSION_SECRET.
const SESSION_SECRET = process.env.SESSION_SECRET ?? "dev-only-insecure-secret-change-me";
function makeToken(role, sub, email) {
  const payload = { sub, email, name: `CI ${role}`, role, exp: Math.floor(Date.now() / 1000) + 3600 };
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${data}.${createHmac("sha256", SESSION_SECRET).update(data).digest("base64url")}`;
}

const ADMIN_TOKEN = makeToken("admin", "0123456789abcdef01234567", "admin@ci.test");

async function sendReset(id, token = ADMIN_TOKEN) {
  const res = await fetch(`${API}/accounts/${id}/password-reset`, {
    method: "POST",
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : undefined };
}

const resetLinks = (userId) => db().collection("authTokens").countDocuments({ userId, purpose: "password-reset" });

/** An account written straight into the database, so this suite spends none of the shared sign-up rate limit. */
async function plantUser(fields) {
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const doc = {
    email: `ci+admin-reset-${unique}@example.com`,
    name: `CI Reset ${unique}`,
    role: "org",
    status: "approved",
    passwordHash: "a".repeat(128),
    passwordSalt: "b".repeat(32),
    createdAt: new Date(),
    ...fields,
  };
  const { insertedId } = await db().collection("users").insertOne(doc);
  return { ...doc, _id: insertedId };
}

before(() => mongo.connect());
after(() => mongo.close());

describe("POST /api/accounts/:id/password-reset (ASVS 6.4.6)", () => {
  it("is for admins only", async () => {
    const user = await plantUser();
    assert.equal((await sendReset(user._id.toString(), null)).status, 401);
    const orgToken = makeToken("org", user._id.toString(), user.email);
    assert.equal((await sendReset(user._id.toString(), orgToken)).status, 403);
    assert.equal(await resetLinks(user._id), 0);
  });

  it("issues a reset link for the owner, leaves the password alone, and records it in the audit log", async () => {
    const user = await plantUser();
    const res = await sendReset(user._id.toString());
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.deepEqual(res.body, { ok: true });

    assert.equal(await resetLinks(user._id), 1);
    const after = await db().collection("users").findOne({ _id: user._id });
    assert.equal(after.passwordHash, user.passwordHash, "the admin did not set a password");

    const entry = await db()
      .collection("auditLogEntries")
      .findOne({ action: "ส่งลิงก์ตั้งรหัสผ่านใหม่", detail: `${user.name} (${user.email})` });
    assert.ok(entry, "the audit log names the account");
  });

  it("replaces an earlier link instead of adding a second one", async () => {
    const user = await plantUser();
    assert.equal((await sendReset(user._id.toString())).status, 200);
    assert.equal((await sendReset(user._id.toString())).status, 200);
    assert.equal(await resetLinks(user._id), 1);
  });

  it("refuses a viewer (Google only, no password) and a suspended account", async () => {
    const viewer = await plantUser({ role: "viewer", passwordHash: undefined, passwordSalt: undefined });
    assert.equal((await sendReset(viewer._id.toString())).status, 400);
    const suspended = await plantUser({ suspended: true });
    assert.equal((await sendReset(suspended._id.toString())).status, 400);
    assert.equal(await resetLinks(viewer._id), 0);
    assert.equal(await resetLinks(suspended._id), 0);
  });

  it("answers 404 for an unknown or malformed id", async () => {
    assert.equal((await sendReset(new ObjectId().toString())).status, 404);
    assert.equal((await sendReset("not-an-id")).status, 404);
  });
});
