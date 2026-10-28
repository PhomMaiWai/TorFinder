// End-to-end coverage for the project owner's dashboard list, run in CI
// against a freshly booted backend + MongoDB with SEED_DEMO_DATA on.
//
// Announcements are created through the admin route, then handed to a made-up
// owner by setting `ownerId` directly — assigning one in the app is #220's
// job. Comments are written straight into `feedback` in each status. Every
// row made here is removed after.

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

const OWNER = new ObjectId();
const OTHER_OWNER = new ObjectId();
const ownerToken = makeToken("owner", OWNER.toString());
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

const created = [];
let serial = 0;
async function createTor({ title, summary, tags, owner = OWNER }) {
  serial += 1;
  const res = await api("/tor", {
    method: "POST",
    token: ADMIN_TOKEN,
    body: {
      title: `${title} CI-owner ${Date.now()}-${serial}`,
      agency: "สำนักงานทดสอบแดชบอร์ด",
      budget: "฿5,000,000",
      deadline: "31 ธ.ค. 2575",
      daysLeft: 30,
      tags,
      stage: "เปิดรับฟังความคิดเห็น",
      summary,
    },
  });
  assert.equal(res.status, 201, `create failed: ${JSON.stringify(res.body)}`);
  const _id = new ObjectId(res.body.id);
  created.push(_id);
  await db()
    .collection("tors")
    .updateOne({ _id }, { $set: { ownerId: owner } });
  return res.body.id;
}

async function addFeedback(torId, counts) {
  const docs = Object.entries(counts).flatMap(([status, n]) =>
    Array.from({ length: n }, (_, i) => ({
      torId: new ObjectId(torId),
      author: `CI ${i}`,
      text: "ความคิดเห็นทดสอบ",
      status,
      createdAt: new Date(),
    })),
  );
  if (docs.length) await db().collection("feedback").insertMany(docs);
}

/** What the matching page itself would count for this announcement at the default alert threshold. */
async function expectedMatches(torId) {
  const res = await api(`/matching/tor/${torId}/companies`, {
    token: ADMIN_TOKEN,
  });
  assert.equal(res.status, 200);
  const fits = res.body.filter((c) => c.score >= 70 && c.eligible !== false);
  return { matchCount: fits.length, topScore: fits[0]?.score ?? null };
}

let software;
let cleaning;
let hidden;

before(async () => {
  await mongo.connect();
  // Older first: the list is newest first.
  cleaning = await createTor({
    title: "จ้างเหมาทำความสะอาดอาคาร",
    summary: "ทำความสะอาดอาคารสำนักงาน",
    tags: ["cleaning"],
  });
  software = await createTor({
    title: "จ้างพัฒนาระบบสารสนเทศและเว็บแอปพลิเคชัน",
    summary: "พัฒนาระบบสารสนเทศ เว็บแอปพลิเคชัน และบำรุงรักษาระบบ",
    tags: ["software", "web"],
  });
  hidden = await createTor({
    title: "จ้างพัฒนาระบบที่ถูกซ่อน",
    summary: "ซ่อน",
    tags: ["software"],
  });
  await db()
    .collection("tors")
    .updateOne(
      { _id: new ObjectId(hidden) },
      { $set: { deletedAt: new Date() } },
    );
  await createTor({
    title: "โครงการของเจ้าของอื่น",
    summary: "อื่น",
    tags: ["software"],
    owner: OTHER_OWNER,
  });

  await addFeedback(software, { อนุมัติ: 3, รอตรวจสอบ: 2, ปฏิเสธ: 1 });
  await addFeedback(hidden, { อนุมัติ: 5 });
});

after(async () => {
  await db()
    .collection("tors")
    .deleteMany({ _id: { $in: created } });
  await db()
    .collection("feedback")
    .deleteMany({ torId: { $in: created } });
  await db()
    .collection("notifications")
    .deleteMany({ torId: { $in: created } });
  await mongo.close();
});

describe("GET /api/owner/tors", () => {
  it("is for owners only", async () => {
    assert.equal((await api("/owner/tors")).status, 403);
    assert.equal(
      (await api("/owner/tors", { token: ADMIN_TOKEN })).status,
      403,
    );
    assert.equal(
      (
        await api("/owner/tors", {
          token: makeToken("org", new ObjectId().toString()),
        })
      ).status,
      403,
    );
  });

  it("lists only the owner's own visible announcements, newest first", async () => {
    const res = await api("/owner/tors", { token: ownerToken });
    assert.equal(res.status, 200);
    assert.deepEqual(
      res.body.tors.map((t) => t.id),
      [software, cleaning],
    );
  });

  it("counts the companies that fit each one, as matching does", async () => {
    const { tors } = (await api("/owner/tors", { token: ownerToken })).body;
    const row = tors.find((t) => t.id === software);
    const expected = await expectedMatches(software);
    assert.ok(
      expected.matchCount >= 1,
      "precondition: the seeded software company fits",
    );
    assert.equal(row.matchCount, expected.matchCount);
    assert.equal(row.topScore, expected.topScore);
  });

  it("counts comments by moderation status, zeros included", async () => {
    const { tors } = (await api("/owner/tors", { token: ownerToken })).body;
    assert.deepEqual(tors.find((t) => t.id === software).feedback, {
      approved: 3,
      pending: 2,
      rejected: 1,
    });
    assert.deepEqual(tors.find((t) => t.id === cleaning).feedback, {
      approved: 0,
      pending: 0,
      rejected: 0,
    });
  });

  it("totals the list, leaving the hidden announcement out", async () => {
    const { tors, totals } = (await api("/owner/tors", { token: ownerToken }))
      .body;
    assert.equal(totals.tors, 2);
    assert.equal(
      totals.matches,
      tors.reduce((sum, t) => sum + t.matchCount, 0),
    );
    assert.deepEqual(totals.feedback, { approved: 3, pending: 2, rejected: 1 });
  });

  it("answers an owner with no announcements with an empty list", async () => {
    const res = await api("/owner/tors", {
      token: makeToken("owner", new ObjectId().toString()),
    });
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, {
      totals: {
        tors: 0,
        matches: 0,
        feedback: { approved: 0, pending: 0, rejected: 0 },
      },
      tors: [],
    });
  });
});
