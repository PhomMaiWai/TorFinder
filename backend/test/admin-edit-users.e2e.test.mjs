// End-to-end coverage for an admin renaming accounts and changing their roles,
// run in CI against a freshly booted backend + MongoDB.
//
// The accounts are inserted straight into `users` and the admin's token is
// minted, to stay off the sign-up and login rate limiters. The last-admin
// case briefly makes every other admin an owner and puts them back after.

import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { after, before, describe, it } from "node:test";

import { MongoClient, ObjectId } from "mongodb";

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:4000";
const API = `${BASE_URL}/api`;
const SESSION_SECRET =
  process.env.SESSION_SECRET ?? "dev-only-insecure-secret-change-me";
const mongo = new MongoClient(
  process.env.MONGODB_URI ?? "mongodb://localhost:27017/torfinder",
);
const users = () => mongo.db().collection("users");
const audit = () => mongo.db().collection("auditLogEntries");

const ACTOR = `admin+edit-${Date.now()}@ci.test`;

function makeToken(role, sub, email) {
  const iat = Math.floor(Date.now() / 1000);
  const payload = {
    sub,
    email,
    name: `CI ${role}`,
    role,
    iat,
    exp: iat + 3600,
  };
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${data}.${createHmac("sha256", SESSION_SECRET).update(data).digest("base64url")}`;
}

const ADMIN_TOKEN = makeToken("admin", "0123456789abcdef01234567", ACTOR);

async function edit(id, body, token = ADMIN_TOKEN) {
  const res = await fetch(`${API}/accounts/${id}/details`, {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : undefined };
}

async function api(path, token) {
  const res = await fetch(`${API}${path}`, { headers: { authorization: `Bearer ${token}` } });
  return { status: res.status, body: await res.json() };
}

const created = [];
let serial = 0;
async function insertUser(role, extra = {}) {
  serial += 1;
  const doc = {
    email: `ci+edit-${Date.now()}-${serial}@example.com`,
    name: `CI Edit ${serial}`,
    role,
    status: "approved",
    createdAt: new Date(),
    ...extra,
  };
  const { insertedId } = await users().insertOne(doc);
  created.push(insertedId);
  return { ...doc, id: insertedId.toString() };
}

const entriesFor = (email) =>
  audit()
    .find({
      actor: ACTOR,
      detail: { $regex: `^${email.replace(/[.+]/g, "\\$&")}:` },
    })
    .toArray();

before(() => mongo.connect());
after(async () => {
  await users().deleteMany({ _id: { $in: created } });
  await audit().deleteMany({ actor: ACTOR });
  await mongo.close();
});

describe("admin edits a user", () => {
  it("is admin-only", async () => {
    const viewer = await insertUser("viewer");
    const res = await edit(
      viewer.id,
      { name: "x" },
      makeToken("owner", viewer.id, viewer.email),
    );
    assert.equal(res.status, 403);
  });

  it("renames an account and records one audit entry", async () => {
    const viewer = await insertUser("viewer");
    const res = await edit(viewer.id, { name: "  ชื่อใหม่  " });
    assert.equal(res.status, 200);
    assert.equal(res.body.name, "ชื่อใหม่");

    const entries = await entriesFor(viewer.email);
    assert.equal(entries.length, 1);
    assert.equal(entries[0].action, "แก้ไขชื่อผู้ใช้");
    assert.match(entries[0].detail, /CI Edit \d+ → ชื่อใหม่/);
  });

  it("changes a role, signs the account out and writes one entry per changed field", async () => {
    const viewer = await insertUser("viewer");
    const res = await edit(viewer.id, { name: "ผู้ตรวจ", role: "auditor" });
    assert.equal(res.status, 200);
    assert.equal(res.body.role, "auditor");

    const stored = await users().findOne({ _id: new ObjectId(viewer.id) });
    assert.ok(stored.sessionMinIssuedAt, "old sessions are revoked");

    const actions = (await entriesFor(viewer.email))
      .map((e) => e.action)
      .sort();
    assert.deepEqual(actions, ["เปลี่ยนบทบาทผู้ใช้", "แก้ไขชื่อผู้ใช้"].sort());
  });

  it("records nothing when nothing changes", async () => {
    const owner = await insertUser("owner");
    assert.equal(
      (await edit(owner.id, { name: owner.name, role: "owner" })).status,
      200,
    );
    assert.equal((await entriesFor(owner.email)).length, 0);
  });

  it("refuses org on either side, unknown roles and blank names", async () => {
    const org = await insertUser("org", { company: { companyName: "CI Co" } });
    const viewer = await insertUser("viewer");
    assert.equal((await edit(org.id, { role: "viewer" })).status, 400);
    assert.equal((await edit(viewer.id, { role: "org" })).status, 400);
    assert.equal((await edit(viewer.id, { role: "superuser" })).status, 400);
    assert.equal((await edit(viewer.id, { name: "   " })).status, 400);
    assert.equal(
      (await users().findOne({ _id: new ObjectId(org.id) })).role,
      "org",
    );
  });

  it("404s an unknown account", async () => {
    assert.equal(
      (await edit(new ObjectId().toString(), { name: "x" })).status,
      404,
    );
  });

  it("notifies the account when its role changes", async () => {
    const viewer = await insertUser("viewer");
    assert.equal((await edit(viewer.id, { role: "owner" })).status, 200);

    // A role change revokes every session already issued (sessionMinIssuedAt,
    // precise to the millisecond); `iat` is floored to the second, so a token
    // minted in the same second as the revoke can land just before it. A
    // near-1s wait keeps this token's whole issuing second safely after.
    await new Promise((resolve) => setTimeout(resolve, 1100));
    const token = makeToken("owner", viewer.id, viewer.email);
    const res = await api("/notifications", token);
    assert.equal(res.status, 200);
    const notice = res.body.find((n) => n.title === "บทบาทของบัญชีคุณเปลี่ยนแล้ว");
    assert.ok(notice, "the account should hear about its own role change");
    assert.equal(notice.type, "system");
    assert.match(notice.message, /เจ้าของโครงการ/);
  });

  it("doesn't notify when only the name changes", async () => {
    const viewer = await insertUser("viewer");
    assert.equal((await edit(viewer.id, { name: "เฉยๆ" })).status, 200);

    const token = makeToken("viewer", viewer.id, viewer.email);
    const res = await api("/notifications", token);
    assert.ok(!res.body.some((n) => n.title === "บทบาทของบัญชีคุณเปลี่ยนแล้ว"));
  });

  it("surfaces the audit entries through the admin dashboard's feed, not just the collection", async () => {
    const viewer = await insertUser("viewer");
    await edit(viewer.id, { name: "ปรากฏในฟีด", role: "owner" });

    const res = await api("/audit", ADMIN_TOKEN);
    assert.equal(res.status, 200);
    const actions = res.body
      .filter((entry) => entry.detail.startsWith(`${viewer.email}:`))
      .map((entry) => entry.action)
      .sort();
    assert.deepEqual(actions, ["เปลี่ยนบทบาทผู้ใช้", "แก้ไขชื่อผู้ใช้"].sort());
  });

  it("the loser of a concurrent edit gets 409, told to reload", async () => {
    const viewer = await insertUser("viewer");
    const [a, b] = await Promise.all([
      edit(viewer.id, { role: "owner" }),
      edit(viewer.id, { role: "auditor" }),
    ]);

    const statuses = [a.status, b.status].sort();
    assert.deepEqual(statuses, [200, 409]);
    const winner = a.status === 200 ? a : b;
    const loser = a.status === 200 ? b : a;
    assert.match(loser.body.message, /ถูกแก้ไขไปแล้ว/);

    const stored = await users().findOne({ _id: new ObjectId(viewer.id) });
    assert.equal(stored.role, winner.body.role);
  });
});

describe("the last admin", () => {
  let others = [];
  let last;

  before(async () => {
    last = await insertUser("admin");
    others = (
      await users()
        .find({ role: "admin", _id: { $ne: new ObjectId(last.id) } })
        .toArray()
    ).map((u) => u._id);
    await users().updateMany(
      { _id: { $in: others } },
      { $set: { role: "owner" } },
    );
  });

  after(() =>
    users().updateMany({ _id: { $in: others } }, { $set: { role: "admin" } }),
  );

  it("can't be demoted, and nothing is recorded", async () => {
    const res = await edit(last.id, { role: "owner" });
    assert.equal(res.status, 409);
    assert.match(res.body.message, /อย่างน้อย 1 คน/);
    assert.equal(
      (await users().findOne({ _id: new ObjectId(last.id) })).role,
      "admin",
    );
    assert.equal((await entriesFor(last.email)).length, 0);
  });

  it("can still be renamed", async () => {
    assert.equal(
      (await edit(last.id, { name: "แอดมินคนสุดท้าย" })).status,
      200,
    );
  });

  it("can be demoted once another admin exists", async () => {
    await insertUser("admin");
    const res = await edit(last.id, { role: "owner" });
    assert.equal(res.status, 200);
    assert.equal(res.body.role, "owner");
  });
});

// The pre-write count check (above) can't catch two admins demoting each
// other at once — each one's own count still sees the other as admin. The
// post-write re-check is the safety net for exactly that race; this is the
// only way to actually exercise it rather than just trust it's there.
describe("two admins demoted at the same moment", () => {
  let others = [];
  let first, second;

  before(async () => {
    first = await insertUser("admin");
    second = await insertUser("admin");
    const theseTwo = [new ObjectId(first.id), new ObjectId(second.id)];
    others = (await users().find({ role: "admin", _id: { $nin: theseTwo } }).toArray()).map(
      (u) => u._id,
    );
    await users().updateMany({ _id: { $in: others } }, { $set: { role: "owner" } });
  });

  after(() => users().updateMany({ _id: { $in: others } }, { $set: { role: "admin" } }));

  it("never lets the count reach zero, however the two requests interleave", async () => {
    const [a, b] = await Promise.all([
      edit(first.id, { role: "owner" }),
      edit(second.id, { role: "owner" }),
    ]);

    for (const res of [a, b]) {
      assert.ok([200, 409].includes(res.status), `unexpected status ${res.status}`);
    }

    const remaining = await users().countDocuments({
      _id: { $in: [new ObjectId(first.id), new ObjectId(second.id)] },
      role: "admin",
    });
    assert.ok(remaining >= 1, "at least one of the two must still be admin");
  });
});
