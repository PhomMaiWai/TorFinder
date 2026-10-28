// End-to-end coverage for an admin linking an announcement to a project owner
// account (#220), run in CI against a freshly booted backend + MongoDB with
// SEED_DEMO_DATA on: who may do it, which accounts it accepts, what the owner
// then sees on their dashboard, and what the audit log records. The accounts
// are written straight into `users`; every row made here is removed after.

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
const db = () => mongo.db();

const ACTOR = `admin+owner-link-${Date.now()}@ci.test`;

function makeToken(role, sub, email = `${sub}@ci.test`) {
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
const OWNER = { _id: new ObjectId(), email: `owner-${Date.now()}@ci.test`, name: "CI เจ้าของโครงการ", role: "owner" };
const VIEWER = { _id: new ObjectId(), email: `viewer-${Date.now()}@ci.test`, name: "CI ผู้ชม", role: "viewer" };
const ownerToken = makeToken("owner", OWNER._id.toString(), OWNER.email);

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
  return { status: res.status, body: text ? JSON.parse(text) : undefined };
}

const created = [];
let serial = 0;
async function createTor() {
  serial += 1;
  const res = await api("/tor", {
    method: "POST",
    token: ADMIN_TOKEN,
    body: {
      title: `จ้างพัฒนาระบบเจ้าของโครงการ CI ${Date.now()}-${serial}`,
      agency: `สำนักงานทดสอบเจ้าของโครงการ ${serial}`,
      budget: "฿3,000,000",
      deadline: "31 ธ.ค. 2575",
      daysLeft: 30,
      tags: ["software"],
      stage: "เปิดรับฟังความคิดเห็น",
      summary: "ทดสอบการกำหนดเจ้าของโครงการ",
    },
  });
  assert.equal(res.status, 201, `create failed: ${JSON.stringify(res.body)}`);
  created.push(new ObjectId(res.body.id));
  return res.body;
}

const setOwner = (torId, ownerId, token = ADMIN_TOKEN) =>
  api(`/tor/${torId}/owner`, { method: "PUT", token, body: { ownerId } });
const ownersList = async () => (await api("/owner/tors", { token: ownerToken })).body.tors;
const auditFor = (action, title) =>
  db().collection("auditLogEntries").find({ actor: ACTOR, action, detail: { $regex: title } }).toArray();

before(async () => {
  await mongo.connect();
  const now = new Date();
  await db()
    .collection("users")
    .insertMany([OWNER, VIEWER].map((user) => ({ ...user, status: "approved", createdAt: now })));
});
after(async () => {
  await db().collection("tors").deleteMany({ _id: { $in: created } });
  await db().collection("notifications").deleteMany({ torId: { $in: created } });
  await db().collection("users").deleteMany({ _id: { $in: [OWNER._id, VIEWER._id] } });
  await db().collection("auditLogEntries").deleteMany({ actor: ACTOR });
  await mongo.close();
});

describe("PUT /api/tor/:id/owner — linking an announcement to its owner", () => {
  it("is admin-only", async () => {
    const tor = await createTor();
    assert.equal((await setOwner(tor.id, OWNER._id.toString(), "")).status, 403);
    assert.equal((await setOwner(tor.id, OWNER._id.toString(), ownerToken)).status, 403);
  });

  it("links the record to an owner, who then sees it on their dashboard", async () => {
    const tor = await createTor();
    const res = await setOwner(tor.id, OWNER._id.toString());
    assert.equal(res.status, 200);
    assert.equal(res.body.ownerId, OWNER._id.toString());
    // Not a correction: nothing is locked and "last edited" is left alone.
    assert.equal(res.body.lockedFields, undefined);
    assert.equal(res.body.lastEdited, undefined);

    const list = await ownersList();
    assert.ok(list.some((t) => t.id === tor.id), "the owner's dashboard should list the linked record");

    const [entry, ...rest] = await auditFor("กำหนดเจ้าของประกาศ TOR", tor.title);
    assert.equal(rest.length, 0);
    assert.equal(entry.detail, `${tor.title} → ${OWNER.name} (${OWNER.email})`);
  });

  it("writes nothing when the owner is already the one linked", async () => {
    const tor = await createTor();
    await setOwner(tor.id, OWNER._id.toString());
    assert.equal((await setOwner(tor.id, OWNER._id.toString())).status, 200);
    assert.equal((await auditFor("กำหนดเจ้าของประกาศ TOR", tor.title)).length, 1);
  });

  it("unlinks with null, and the record leaves the owner's dashboard", async () => {
    const tor = await createTor();
    await setOwner(tor.id, OWNER._id.toString());

    const res = await setOwner(tor.id, null);
    assert.equal(res.status, 200);
    assert.equal(res.body.ownerId, undefined);
    assert.ok(!(await ownersList()).some((t) => t.id === tor.id));
    assert.equal((await auditFor("ยกเลิกเจ้าของประกาศ TOR", tor.title)).length, 1);
  });

  it("refuses an account that isn't an owner, or doesn't exist (400)", async () => {
    const tor = await createTor();
    assert.equal((await setOwner(tor.id, VIEWER._id.toString())).status, 400);
    assert.equal((await setOwner(tor.id, new ObjectId().toString())).status, 400);
    assert.equal((await setOwner(tor.id, "not-an-id")).status, 400);
    const stored = await db().collection("tors").findOne({ _id: new ObjectId(tor.id) });
    assert.equal(stored.ownerId, undefined);
  });

  it("answers 404 for an announcement that doesn't exist", async () => {
    assert.equal((await setOwner(new ObjectId().toString(), OWNER._id.toString())).status, 404);
  });
});
