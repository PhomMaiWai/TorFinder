// End-to-end coverage for ASVS 2.3.5: granting or removing the admin role
// needs a second admin. The first admin's edit only files a request; another
// admin approves it (behind step-up), the requester can only cancel, and a
// request lapses on its own. Run in CI against a freshly booted backend +
// MongoDB.
//
// Accounts are inserted straight into `users` and tokens are minted, to stay
// off the sign-up and login rate limiters.

import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { after, before, describe, it } from "node:test";

import { MongoClient, ObjectId } from "mongodb";

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:4000";
const API = `${BASE_URL}/api`;
const SESSION_SECRET = process.env.SESSION_SECRET ?? "dev-only-insecure-secret-change-me";
const mongo = new MongoClient(process.env.MONGODB_URI ?? "mongodb://localhost:27017/torfinder");
const users = () => mongo.db().collection("users");
const approvals = () => mongo.db().collection("adminApprovals");
const audit = () => mongo.db().collection("auditLogEntries");
const notifications = () => mongo.db().collection("notifications");

const RUN = `${Date.now()}`;

// Mirrors backend/src/common/token.ts; must match the server's SESSION_SECRET.
function makeToken(user, extra = {}) {
  const iat = Math.floor(Date.now() / 1000);
  const payload = { sub: user.id, email: user.email, name: user.name, role: user.role, iat, exp: iat + 3600, ...extra };
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${data}.${createHmac("sha256", SESSION_SECRET).update(data).digest("base64url")}`;
}

async function call(method, path, token, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      ...(token && { authorization: `Bearer ${token}` }),
      ...(body && { "content-type": "application/json" }),
    },
    ...(body && { body: JSON.stringify(body) }),
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : undefined };
}

const edit = (id, body, as) => call("PATCH", `/accounts/${id}/details`, makeToken(as), body);
const list = (as) => call("GET", "/accounts/admin-approvals", makeToken(as));
const approve = (requestId, as) => call("POST", `/accounts/admin-approvals/${requestId}/approve`, makeToken(as));
const reject = (requestId, as) => call("POST", `/accounts/admin-approvals/${requestId}/reject`, makeToken(as));

const created = [];
let serial = 0;
async function insertUser(role, extra = {}) {
  serial += 1;
  const doc = {
    email: `ci+approval-${RUN}-${serial}@example.com`,
    name: `CI Approval ${serial}`,
    role,
    status: "approved",
    createdAt: new Date(),
    ...extra,
  };
  const { insertedId } = await users().insertOne(doc);
  created.push(insertedId);
  return { ...doc, id: insertedId.toString() };
}

const roleOf = async (user) => (await users().findOne({ _id: new ObjectId(user.id) })).role;
const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const actionsFor = async (email) =>
  (await audit().find({ detail: { $regex: `^${escape(email)}:` } }).toArray()).map((e) => e.action);

let alice, bob;

before(async () => {
  await mongo.connect();
  alice = await insertUser("admin");
  bob = await insertUser("admin");
});

after(async () => {
  await approvals().deleteMany({ targetId: { $in: created } });
  await notifications().deleteMany({ userId: { $in: created } });
  await audit().deleteMany({ actor: { $regex: `^ci\\+approval-${RUN}-` } });
  await users().deleteMany({ _id: { $in: created } });
  await mongo.close();
});

describe("granting the admin role (ASVS 2.3.5)", () => {
  it("files a request instead of changing the role, and tells the other admins", async () => {
    const target = await insertUser("owner");
    const res = await edit(target.id, { role: "admin" }, alice);
    assert.equal(res.status, 202, JSON.stringify(res.body));
    assert.equal(res.body.role, "owner");
    assert.equal(res.body.pendingApproval.toRole, "admin");
    assert.equal(res.body.pendingApproval.requestedBy, alice.email);
    assert.equal(await roleOf(target), "owner");

    const listed = (await list(bob)).body.find((r) => r.targetId === target.id);
    assert.ok(listed, "the request is listed for other admins");
    assert.equal(listed.mine, false);
    assert.equal((await list(alice)).body.find((r) => r.targetId === target.id).mine, true);

    assert.deepEqual(await actionsFor(target.email), ["ขอเปลี่ยนบทบาทผู้ดูแลระบบ (รออนุมัติ)"]);
    assert.ok(
      await notifications().findOne({ userId: new ObjectId(bob.id), title: "มีคำขอเปลี่ยนบทบาทผู้ดูแลระบบรออนุมัติ" }),
      "another admin hears about it",
    );
  });

  it("can't be approved by the admin who asked", async () => {
    const target = await insertUser("auditor");
    const { body } = await edit(target.id, { role: "admin" }, alice);
    const res = await approve(body.pendingApproval.id, alice);
    assert.equal(res.status, 403);
    assert.match(res.body.message, /ผู้ดูแลระบบคนอื่น/);
    assert.equal(await roleOf(target), "auditor");
    assert.ok(await approvals().findOne({ _id: new ObjectId(body.pendingApproval.id) }), "the request is still open");
  });

  it("applies once a second admin approves: role changed, sessions revoked, every step logged", async () => {
    const target = await insertUser("owner");
    const { body } = await edit(target.id, { role: "admin" }, alice);

    const res = await approve(body.pendingApproval.id, bob);
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.role, "admin");

    const stored = await users().findOne({ _id: new ObjectId(target.id) });
    assert.equal(stored.role, "admin");
    assert.ok(stored.sessionMinIssuedAt, "old sessions are revoked");
    assert.equal(await approvals().countDocuments({ targetId: new ObjectId(target.id) }), 0);

    assert.deepEqual(
      (await actionsFor(target.email)).sort(),
      ["ขอเปลี่ยนบทบาทผู้ดูแลระบบ (รออนุมัติ)", "อนุมัติคำขอเปลี่ยนบทบาทผู้ดูแลระบบ", "เปลี่ยนบทบาทผู้ใช้"].sort(),
    );
    const change = await audit().findOne({ action: "เปลี่ยนบทบาทผู้ใช้", detail: { $regex: `^${escape(target.email)}:` } });
    assert.equal(change.actor, bob.email);
    assert.match(change.detail, new RegExp(`ขอโดย ${escape(alice.email)}`));
  });

  it("can't be approved twice", async () => {
    const target = await insertUser("owner");
    const { body } = await edit(target.id, { role: "admin" }, alice);
    const carol = await insertUser("admin");
    const [a, b] = await Promise.all([approve(body.pendingApproval.id, bob), approve(body.pendingApproval.id, carol)]);
    assert.deepEqual([a.status, b.status].sort(), [200, 404]);
  });

  it("allows only one open request per account", async () => {
    const target = await insertUser("owner");
    assert.equal((await edit(target.id, { role: "admin" }, alice)).status, 202);
    const second = await edit(target.id, { role: "admin" }, bob);
    assert.equal(second.status, 409);
    assert.match(second.body.message, /รออนุมัติอยู่แล้ว/);
  });

  it("applies a rename in the same edit at once, and leaves the role waiting", async () => {
    const target = await insertUser("owner");
    const res = await edit(target.id, { name: "ชื่อใหม่", role: "admin" }, alice);
    assert.equal(res.status, 202);
    assert.equal(res.body.name, "ชื่อใหม่");
    assert.equal(res.body.role, "owner");
  });

  it("is rejected by another admin, or cancelled by the one who asked; nothing changes", async () => {
    const first = await insertUser("owner");
    const second = await insertUser("owner");
    const a = await edit(first.id, { role: "admin" }, alice);
    const b = await edit(second.id, { role: "admin" }, alice);

    assert.equal((await reject(a.body.pendingApproval.id, bob)).status, 200);
    assert.equal((await reject(b.body.pendingApproval.id, alice)).status, 200);
    assert.equal(await roleOf(first), "owner");
    assert.equal(await roleOf(second), "owner");

    assert.ok((await actionsFor(first.email)).includes("ปฏิเสธคำขอเปลี่ยนบทบาทผู้ดูแลระบบ"));
    assert.ok((await actionsFor(second.email)).includes("ยกเลิกคำขอเปลี่ยนบทบาทผู้ดูแลระบบ"));
    assert.equal((await approve(a.body.pendingApproval.id, bob)).status, 404, "a rejected request can't be approved");
  });

  it("can't be approved once it has expired", async () => {
    const target = await insertUser("owner");
    const { body } = await edit(target.id, { role: "admin" }, alice);
    await approvals().updateOne({ _id: new ObjectId(body.pendingApproval.id) }, { $set: { expiresAt: new Date(Date.now() - 1000) } });

    assert.equal((await approve(body.pendingApproval.id, bob)).status, 404);
    assert.equal(await roleOf(target), "owner");
    assert.ok(!(await list(bob)).body.some((r) => r.targetId === target.id), "an expired request isn't listed");
    // And a new request for the same account isn't blocked by the lapsed one.
    assert.equal((await edit(target.id, { role: "admin" }, alice)).status, 202);
  });

  it("is void if the requester stopped being an admin", async () => {
    const dave = await insertUser("admin");
    const target = await insertUser("owner");
    const { body } = await edit(target.id, { role: "admin" }, dave);
    await users().updateOne({ _id: new ObjectId(dave.id) }, { $set: { role: "owner" } });

    const res = await approve(body.pendingApproval.id, bob);
    assert.equal(res.status, 409);
    assert.equal(await roleOf(target), "owner");
    assert.equal(await approvals().countDocuments({ _id: new ObjectId(body.pendingApproval.id) }), 0);
  });

  it("is void if the account's role moved since it was asked", async () => {
    const target = await insertUser("owner");
    const { body } = await edit(target.id, { role: "admin" }, alice);
    await users().updateOne({ _id: new ObjectId(target.id) }, { $set: { role: "auditor" } });

    const res = await approve(body.pendingApproval.id, bob);
    assert.equal(res.status, 409);
    assert.equal(await roleOf(target), "auditor");
  });

  it("is admin-only", async () => {
    const owner = await insertUser("owner");
    const target = await insertUser("owner");
    const { body } = await edit(target.id, { role: "admin" }, alice);
    assert.equal((await list(owner)).status, 403);
    assert.equal((await approve(body.pendingApproval.id, owner)).status, 403);
    assert.equal((await reject(body.pendingApproval.id, owner)).status, 403);
    assert.equal(await roleOf(target), "owner");
  });

  it("needs a fresh passkey check to approve when the approver uses passkeys", async () => {
    const target = await insertUser("owner");
    const { body } = await edit(target.id, { role: "admin" }, alice);
    const stale = makeToken(bob, { amr: ["pwd", "passkey"], pkt: Math.floor(Date.now() / 1000) - 3600 });
    const res = await fetch(`${API}/accounts/admin-approvals/${body.pendingApproval.id}/approve`, {
      method: "POST",
      headers: { authorization: `Bearer ${stale}` },
    });
    assert.equal(res.status, 403);
    assert.equal((await res.json()).code, "step-up-required");
    assert.equal(await roleOf(target), "owner");
  });
});

describe("removing the admin role", () => {
  it("waits for a second admin too, and other role changes don't", async () => {
    const erin = await insertUser("admin");
    const res = await edit(erin.id, { role: "owner" }, alice);
    assert.equal(res.status, 202);
    assert.equal(await roleOf(erin), "admin");
    assert.equal((await approve(res.body.pendingApproval.id, bob)).status, 200);
    assert.equal(await roleOf(erin), "owner");

    const plain = await insertUser("owner");
    assert.equal((await edit(plain.id, { role: "auditor" }, alice)).status, 200, "owner → auditor is applied at once");
  });
});

describe("the only admin", () => {
  let others = [];
  let solo;

  before(async () => {
    solo = await insertUser("admin");
    others = (await users().find({ role: "admin", _id: { $ne: new ObjectId(solo.id) } }).toArray()).map((u) => u._id);
    await users().updateMany({ _id: { $in: others } }, { $set: { role: "owner" } });
  });

  after(() => users().updateMany({ _id: { $in: others } }, { $set: { role: "admin" } }));

  it("can make the first extra admin directly, since no one else could approve", async () => {
    const target = await insertUser("owner");
    const res = await edit(target.id, { role: "admin" }, solo);
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.role, "admin");
    assert.equal(res.body.pendingApproval, undefined);
  });
});
