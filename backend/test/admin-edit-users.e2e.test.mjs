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
  const payload = {
    sub,
    email,
    name: `CI ${role}`,
    role,
    exp: Math.floor(Date.now() / 1000) + 3600,
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
