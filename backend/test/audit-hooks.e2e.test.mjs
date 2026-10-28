// End-to-end coverage for the admin actions that write an audit entry (#169),
// run in CI against a freshly booted backend + MongoDB. Only the actions that
// stay inside the app are exercised here: the portal syncs, the national e-GP
// capture and the AI extraction each call an outside service, so they are not
// started from CI.

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

const ACTOR = `admin+audit-${Date.now()}@ci.test`;

function makeToken(role, email) {
  const payload = {
    sub: "0123456789abcdef01234567",
    email,
    name: `CI ${role}`,
    role,
    exp: Math.floor(Date.now() / 1000) + 3600,
  };
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${data}.${createHmac("sha256", SESSION_SECRET).update(data).digest("base64url")}`;
}

const ADMIN_TOKEN = makeToken("admin", ACTOR);

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

const entriesFor = (action) =>
  db().collection("auditLogEntries").find({ actor: ACTOR, action }).toArray();

const created = [];
const createdUsers = [];
const createdFeedback = [];

let userSerial = 0;
async function insertUser(role, extra = {}) {
  userSerial += 1;
  const doc = {
    email: `ci+audit-hooks-${Date.now()}-${userSerial}@example.com`,
    name: `CI Audit Hooks ${userSerial}`,
    role,
    status: "approved",
    createdAt: new Date(),
    ...extra,
  };
  const { insertedId } = await db().collection("users").insertOne(doc);
  createdUsers.push(insertedId);
  return { ...doc, id: insertedId.toString() };
}

before(() => mongo.connect());
after(async () => {
  await db()
    .collection("tors")
    .deleteMany({ _id: { $in: created } });
  await db()
    .collection("notifications")
    .deleteMany({ torId: { $in: created } });
  await db()
    .collection("users")
    .deleteMany({ _id: { $in: createdUsers } });
  await db()
    .collection("feedback")
    .deleteMany({ _id: { $in: createdFeedback } });
  await db().collection("auditLogEntries").deleteMany({ actor: ACTOR });
  await mongo.close();
});

describe("admin actions write an audit entry", () => {
  it("adding a TOR records who added which announcement", async () => {
    const title = `จ้างพัฒนาระบบบันทึกการตรวจสอบ CI ${Date.now()}`;
    const res = await api("/tor", {
      method: "POST",
      token: ADMIN_TOKEN,
      body: {
        title,
        agency: "สำนักงานทดสอบบันทึกการตรวจสอบ",
        budget: "฿1,000,000",
        deadline: "31 ธ.ค. 2575",
        daysLeft: 30,
        tags: ["software"],
        stage: "เปิดรับฟังความคิดเห็น",
        summary: "บันทึกการตรวจสอบ",
      },
    });
    assert.equal(res.status, 201, `create failed: ${JSON.stringify(res.body)}`);
    created.push(new ObjectId(res.body.id));

    const [entry, ...rest] = await entriesFor("เพิ่มประกาศ TOR");
    assert.equal(rest.length, 0);
    assert.equal(entry.detail, title);

    const feed = await api("/audit", { token: ADMIN_TOKEN });
    assert.ok(
      feed.body.items.some((e) => e.actor === ACTOR && e.detail === title && e.type === "manual"),
      "expected the entry in the admin's audit feed",
    );
  });

  it("refreshing budget verdicts records the counts it returned", async () => {
    const res = await api("/matching/budget/refresh", { method: "POST", token: ADMIN_TOKEN });
    assert.equal(res.status, 201);

    const [entry] = await entriesFor("คำนวณสถานะงบประมาณใหม่");
    assert.ok(entry, "expected an audit entry for the refresh");
    assert.equal(
      entry.detail,
      `ประเมิน ${res.body.assessed} รายการ · ติดธง ${res.body.flagged} รายการ`,
    );
  });

  it("writes nothing when the caller isn't allowed to act", async () => {
    const org = makeToken("org", ACTOR);
    assert.equal((await api("/matching/budget/refresh", { method: "POST", token: org })).status, 403);
    assert.equal((await entriesFor("คำนวณสถานะงบประมาณใหม่")).length, 1);
  });

  it("suspending a company account names that company, and reactivating it is a separate entry", async () => {
    const org = await insertUser("org", { name: "บริษัท ซีไอ ออดิท จำกัด" });

    const suspend = await api(`/accounts/${org.id}/suspend`, { method: "PATCH", token: ADMIN_TOKEN });
    assert.equal(suspend.status, 200, `suspend failed: ${JSON.stringify(suspend.body)}`);
    const [suspended] = await entriesFor("ระงับบัญชีบริษัท");
    assert.ok(suspended, "expected a suspend entry for the company");
    assert.equal(suspended.detail, org.name);

    const reactivate = await api(`/accounts/${org.id}/reactivate`, { method: "PATCH", token: ADMIN_TOKEN });
    assert.equal(reactivate.status, 200);
    const [reactivated] = await entriesFor("เปิดใช้งานบัญชีบริษัทอีกครั้ง");
    assert.ok(reactivated, "expected a separate entry for reactivating the company");
    assert.equal(reactivated.detail, org.name);
  });

  it("suspending a public viewer account uses the viewer-specific label", async () => {
    const viewer = await insertUser("viewer", { name: "ประชาชน ซีไอ" });

    const suspend = await api(`/accounts/${viewer.id}/suspend`, { method: "PATCH", token: ADMIN_TOKEN });
    assert.equal(suspend.status, 200, `suspend failed: ${JSON.stringify(suspend.body)}`);
    const [entry] = await entriesFor("ระงับบัญชีประชาชนทั่วไป");
    assert.ok(entry, "expected the viewer-specific suspend label, not the company one");
    assert.equal(entry.detail, viewer.name);
    assert.ok(
      !(await entriesFor("ระงับบัญชีบริษัท")).some((e) => e.detail === viewer.name),
      "a viewer suspension must not use the company label",
    );
  });

  it("approving a comment logs the author and an excerpt of the text", async () => {
    const torRes = await api("/tor", {
      method: "POST",
      token: ADMIN_TOKEN,
      body: {
        title: `จ้างพัฒนาระบบบันทึกการตรวจสอบความคิดเห็น CI ${Date.now()}`,
        agency: "สำนักงานทดสอบบันทึกการตรวจสอบ",
        budget: "฿1,000,000",
        deadline: "31 ธ.ค. 2575",
        daysLeft: 30,
        tags: ["software"],
        stage: "เปิดรับฟังความคิดเห็น",
        summary: "บันทึกการตรวจสอบ",
      },
    });
    assert.equal(torRes.status, 201, `create failed: ${JSON.stringify(torRes.body)}`);
    created.push(new ObjectId(torRes.body.id));

    const feedbackRes = await api(`/tor/${torRes.body.id}/feedback`, {
      method: "POST",
      body: { text: "ความคิดเห็นทดสอบสำหรับการตรวจสอบบันทึกการตรวจสอบ", author: "ผู้แสดงความคิดเห็น CI" },
    });
    assert.equal(feedbackRes.status, 201, `feedback create failed: ${JSON.stringify(feedbackRes.body)}`);
    createdFeedback.push(new ObjectId(feedbackRes.body.id));

    const approve = await api(`/feedback/${feedbackRes.body.id}`, {
      method: "PATCH",
      token: ADMIN_TOKEN,
      body: { status: "อนุมัติ" },
    });
    assert.equal(approve.status, 200, `approve failed: ${JSON.stringify(approve.body)}`);

    const [entry] = await entriesFor("อนุมัติความคิดเห็น");
    assert.ok(entry, "expected an audit entry for approving the comment");
    assert.equal(entry.detail, "ผู้แสดงความคิดเห็น CI: ความคิดเห็นทดสอบสำหรับการตรวจสอบบันทึกการตรวจสอบ");
  });

  it("rejecting a comment is a separate action from approving one", async () => {
    const torRes = await api("/tor", {
      method: "POST",
      token: ADMIN_TOKEN,
      body: {
        title: `จ้างพัฒนาระบบปฏิเสธความคิดเห็น CI ${Date.now()}`,
        agency: "สำนักงานทดสอบบันทึกการตรวจสอบ",
        budget: "฿1,000,000",
        deadline: "31 ธ.ค. 2575",
        daysLeft: 30,
        tags: ["software"],
        stage: "เปิดรับฟังความคิดเห็น",
        summary: "บันทึกการตรวจสอบ",
      },
    });
    assert.equal(torRes.status, 201);
    created.push(new ObjectId(torRes.body.id));

    const feedbackRes = await api(`/tor/${torRes.body.id}/feedback`, {
      method: "POST",
      body: { text: "ความคิดเห็นที่ควรถูกปฏิเสธในการทดสอบนี้" },
    });
    assert.equal(feedbackRes.status, 201);
    createdFeedback.push(new ObjectId(feedbackRes.body.id));

    const reject = await api(`/feedback/${feedbackRes.body.id}`, {
      method: "PATCH",
      token: ADMIN_TOKEN,
      body: { status: "ปฏิเสธ" },
    });
    assert.equal(reject.status, 200);

    const [entry] = await entriesFor("ปฏิเสธความคิดเห็น");
    assert.ok(entry, "expected an audit entry for rejecting the comment");
    assert.equal((await entriesFor("อนุมัติความคิดเห็น")).length, 1, "the earlier approval is untouched");
  });

  it("re-queuing a comment back to pending writes no audit entry", async () => {
    const torRes = await api("/tor", {
      method: "POST",
      token: ADMIN_TOKEN,
      body: {
        title: `จ้างพัฒนาระบบคิวความคิดเห็น CI ${Date.now()}`,
        agency: "สำนักงานทดสอบบันทึกการตรวจสอบ",
        budget: "฿1,000,000",
        deadline: "31 ธ.ค. 2575",
        daysLeft: 30,
        tags: ["software"],
        stage: "เปิดรับฟังความคิดเห็น",
        summary: "บันทึกการตรวจสอบ",
      },
    });
    assert.equal(torRes.status, 201);
    created.push(new ObjectId(torRes.body.id));

    const feedbackRes = await api(`/tor/${torRes.body.id}/feedback`, {
      method: "POST",
      body: { text: "ความคิดเห็นที่จะถูกส่งกลับเข้าคิวในการทดสอบนี้" },
    });
    assert.equal(feedbackRes.status, 201);
    createdFeedback.push(new ObjectId(feedbackRes.body.id));

    const requeue = await api(`/feedback/${feedbackRes.body.id}`, {
      method: "PATCH",
      token: ADMIN_TOKEN,
      body: { status: "รอตรวจสอบ" },
    });
    assert.equal(requeue.status, 200, `re-queue failed: ${JSON.stringify(requeue.body)}`);
    assert.equal(
      (await db().collection("auditLogEntries").find({ actor: ACTOR, detail: { $regex: "จะถูกส่งกลับเข้าคิว" } }).toArray()).length,
      0,
      "re-queuing to pending must not be attributed to anyone",
    );
  });
});
