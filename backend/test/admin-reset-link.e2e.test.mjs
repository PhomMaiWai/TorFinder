// End-to-end coverage for an admin starting someone's password reset (ASVS
// 6.4.6), run in CI against a freshly booted backend + MongoDB.
//
// The admin can send the usual emailed link but never sees it or sets the
// password: the route answers only { ok: true }, and what it leaves behind is
// a stored hash of a link for the account's own inbox. Accounts are inserted
// straight into `users` and tokens are minted, to stay off the rate limiters.

import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { after, before, describe, it } from "node:test";

import { MongoClient, ObjectId } from "mongodb";

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:4000";
const API = `${BASE_URL}/api`;
const SESSION_SECRET = process.env.SESSION_SECRET ?? "dev-only-insecure-secret-change-me";
const mongo = new MongoClient(process.env.MONGODB_URI ?? "mongodb://localhost:27017/torfinder");
const users = () => mongo.db().collection("users");
const authTokens = () => mongo.db().collection("authTokens");
const audit = () => mongo.db().collection("auditLogEntries");

const ACTOR = `admin+reset-link-${Date.now()}@ci.test`;

function makeToken(role, email = ACTOR) {
  const iat = Math.floor(Date.now() / 1000);
  const payload = { sub: new ObjectId().toString(), email, name: `CI ${role}`, role, iat, act: iat, exp: iat + 3600 };
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${data}.${createHmac("sha256", SESSION_SECRET).update(data).digest("base64url")}`;
}

async function sendResetLink(id, token = makeToken("admin")) {
  const res = await fetch(`${API}/accounts/${id}/password/reset-link`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}` },
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : undefined };
}

const created = [];
let serial = 0;
async function insertUser(fields = {}) {
  serial += 1;
  const { insertedId } = await users().insertOne({
    email: `ci+reset-link-${Date.now()}-${serial}@example.com`,
    name: `CI Reset ${serial}`,
    role: "org",
    status: "approved",
    emailVerified: true,
    passwordHash: "unchanged-hash",
    passwordSalt: "unchanged-salt",
    createdAt: new Date(),
    ...fields,
  });
  created.push(insertedId);
  return insertedId;
}

before(() => mongo.connect());
after(async () => {
  await authTokens().deleteMany({ userId: { $in: created } });
  await audit().deleteMany({ actor: ACTOR });
  await users().deleteMany({ _id: { $in: created } });
  await mongo.close();
});

describe("admin sends a password-reset link", () => {
  it("issues a link for the account's own inbox; the admin gets no link and the password is untouched", async () => {
    const id = await insertUser();
    const res = await sendResetLink(id.toString());
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.deepEqual(res.body, { ok: true });

    const links = await authTokens().find({ userId: id, purpose: "password-reset" }).toArray();
    assert.equal(links.length, 1);
    assert.ok(links[0].expiresAt > new Date());
    assert.equal(links[0].token, undefined, "only the hash is stored");

    const user = await users().findOne({ _id: id });
    assert.equal(user.passwordHash, "unchanged-hash", "the current password keeps working until the owner resets it");

    const entry = await audit().findOne({ actor: ACTOR, action: "ส่งลิงก์ตั้งรหัสผ่านใหม่" });
    assert.ok(entry, "the action is in the audit log");
  });

  it("sending again retires the earlier link", async () => {
    const id = await insertUser();
    await sendResetLink(id.toString());
    await sendResetLink(id.toString());
    assert.equal(await authTokens().countDocuments({ userId: id, purpose: "password-reset" }), 1);
  });

  it("refuses a suspended account, an unknown id, and anyone who isn't an admin", async () => {
    const suspended = await insertUser({ suspended: true });
    assert.equal((await sendResetLink(suspended.toString())).status, 400);
    assert.equal(await authTokens().countDocuments({ userId: suspended }), 0);

    assert.equal((await sendResetLink(new ObjectId().toString())).status, 404);
    assert.equal((await sendResetLink("not-an-id")).status, 404);

    const target = await insertUser();
    for (const role of ["org", "owner", "auditor", "viewer"]) {
      const res = await sendResetLink(target.toString(), makeToken(role, `${role}+reset-link@ci.test`));
      assert.equal(res.status, 403, `${role} must not send reset links`);
    }
    assert.equal(await authTokens().countDocuments({ userId: target }), 0);
  });
});
