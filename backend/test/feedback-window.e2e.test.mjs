// End-to-end coverage for when the public may comment on a TOR (#215), run in
// CI against a freshly booted backend + MongoDB: a comment is taken up to and
// including the comment deadline's day in Bangkok, refused after it, and taken
// as before when no deadline is known. Records are created through the admin
// route with the deadline written straight into the collection; every row made
// here is removed after.

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

function makeToken(role, sub) {
  const payload = {
    sub,
    email: `${sub}@ci.test`,
    name: `CI ${role}`,
    role,
    exp: Math.floor(Date.now() / 1000) + 3600,
  };
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${data}.${createHmac("sha256", SESSION_SECRET).update(data).digest("base64url")}`;
}

const ADMIN_TOKEN = makeToken("admin", "0123456789abcdef01234567");

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

/** A Bangkok calendar day `offset` days from today, as the deadline is stored. */
const bangkokDay = (offset) =>
  new Date(Date.now() + offset * 86_400_000).toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });

const created = [];
let serial = 0;
async function createDraft(feedbackDeadline) {
  serial += 1;
  const res = await api("/tor", {
    method: "POST",
    token: ADMIN_TOKEN,
    body: {
      title: `จ้างพัฒนาระบบช่วงรับฟังความคิดเห็น CI ${Date.now()}-${serial}`,
      agency: `สำนักงานทดสอบช่วงรับฟัง ${serial}`,
      budget: "฿1,200,000",
      deadline: "31 ธ.ค. 2575",
      daysLeft: 30,
      tags: ["software"],
      stage: "เปิดรับฟังความคิดเห็น",
      summary: "ทดสอบช่วงเวลารับฟังความคิดเห็น",
    },
  });
  assert.equal(res.status, 201, `create failed: ${JSON.stringify(res.body)}`);
  const _id = new ObjectId(res.body.id);
  created.push(_id);
  if (feedbackDeadline) await db().collection("tors").updateOne({ _id }, { $set: { feedbackDeadline } });
  return res.body.id;
}

const comment = (torId) =>
  api(`/tor/${torId}/feedback`, { method: "POST", body: { text: "ความคิดเห็นทดสอบช่วงเวลารับฟัง", author: "CI" } });

before(() => mongo.connect());
after(async () => {
  await db().collection("feedback").deleteMany({ torId: { $in: created } });
  await db().collection("tors").deleteMany({ _id: { $in: created } });
  await db().collection("notifications").deleteMany({ torId: { $in: created } });
  await mongo.close();
});

describe("POST /api/tor/:torId/feedback — the comment window", () => {
  it("takes a comment before the deadline", async () => {
    assert.equal((await comment(await createDraft(bangkokDay(3)))).status, 201);
  });

  it("takes a comment on the deadline day itself", async () => {
    assert.equal((await comment(await createDraft(bangkokDay(0)))).status, 201);
  });

  it("refuses a comment after the deadline, and stores nothing", async () => {
    const id = await createDraft(bangkokDay(-1));
    const res = await comment(id);
    assert.equal(res.status, 400);
    assert.match(res.body.message, /ปิดรับฟังความคิดเห็น/);
    assert.equal(await db().collection("feedback").countDocuments({ torId: new ObjectId(id) }), 0);
  });

  it("goes by the model's date when the portal gave none", async () => {
    const id = await createDraft();
    await db()
      .collection("tors")
      .updateOne({ _id: new ObjectId(id) }, { $set: { "extraction.feedbackDeadline": bangkokDay(-2) } });
    assert.equal((await comment(id)).status, 400);
  });

  it("takes a comment as before when no deadline is known", async () => {
    assert.equal((await comment(await createDraft())).status, 201);
  });
});
