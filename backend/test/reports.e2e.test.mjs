// End-to-end coverage for reporting a problem with a TOR (#223, FR-21), run in
// CI against a freshly booted backend + MongoDB: who may report, what a report
// stores and who it is attributed to, what is refused, and who may read them.
// Records are created through the admin route; every row made here is removed
// after. The rate limit is the comment route's and isn't exercised here: CI
// raises it so the whole suite fits one window.

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

function makeToken(role, sub, email = `${sub}@ci.test`, name = `CI ${role}`) {
  const payload = { sub, email, name, role, exp: Math.floor(Date.now() / 1000) + 3600 };
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${data}.${createHmac("sha256", SESSION_SECRET).update(data).digest("base64url")}`;
}

const ADMIN_TOKEN = makeToken("admin", "0123456789abcdef01234567");
const REPORTER_ID = new ObjectId();
const REPORTER_EMAIL = `reporter-${Date.now()}@ci.test`;
const ORG_TOKEN = makeToken("org", REPORTER_ID.toString(), REPORTER_EMAIL, "CI ผู้แจ้งปัญหา");

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
      title: `จ้างพัฒนาระบบแจ้งปัญหา CI ${Date.now()}-${serial}`,
      agency: `สำนักงานทดสอบแจ้งปัญหา ${serial}`,
      budget: "฿900,000",
      deadline: "31 ธ.ค. 2575",
      daysLeft: 30,
      tags: ["software"],
      stage: "ประกาศ TOR",
      summary: "ทดสอบการแจ้งปัญหา",
    },
  });
  assert.equal(res.status, 201, `create failed: ${JSON.stringify(res.body)}`);
  created.push(new ObjectId(res.body.id));
  return res.body;
}

const REPORT = { reason: "wrong-info", message: "วันที่ปิดรับไม่ตรงกับประกาศต้นฉบับ" };
const report = (torId, body = REPORT, token) => api(`/tor/${torId}/reports`, { method: "POST", body, token });
const stored = (id) => db().collection("torReports").findOne({ _id: new ObjectId(id) });

before(() => mongo.connect());
after(async () => {
  await db().collection("torReports").deleteMany({ torId: { $in: created } });
  await db().collection("auditLogEntries").deleteMany({ actor: "0123456789abcdef01234567@ci.test" });
  await db().collection("tors").deleteMany({ _id: { $in: created } });
  await db().collection("notifications").deleteMany({ torId: { $in: created } });
  await mongo.close();
});

describe("POST /api/tor/:torId/reports — reporting a problem", () => {
  it("takes a guest's report, open, with the contact they left", async () => {
    const tor = await createTor();
    const res = await report(tor.id, { ...REPORT, contact: "guest@example.com" });
    assert.equal(res.status, 201);
    assert.equal(res.body.status, "open");
    assert.equal(res.body.torId, tor.id);
    assert.equal(res.body.reporter, undefined);

    const doc = await stored(res.body.id);
    assert.equal(doc.reason, "wrong-info");
    assert.equal(doc.message, REPORT.message);
    assert.equal(doc.contact, "guest@example.com");
    assert.equal(doc.reporter, undefined);
  });

  it("attributes a signed-in report to the session, not to anything in the body", async () => {
    const tor = await createTor();
    const res = await report(
      tor.id,
      { ...REPORT, reporter: { email: "someone-else@ci.test" }, status: "resolved" },
      ORG_TOKEN,
    );
    assert.equal(res.status, 201);
    assert.equal(res.body.status, "open");
    assert.deepEqual(res.body.reporter, { email: REPORTER_EMAIL, name: "CI ผู้แจ้งปัญหา" });

    const doc = await stored(res.body.id);
    assert.equal(doc.reporter.userId.toString(), REPORTER_ID.toString());
    assert.equal(doc.reporter.email, REPORTER_EMAIL);
  });

  it("treats a token that doesn't verify as a guest", async () => {
    const tor = await createTor();
    const res = await report(tor.id, REPORT, `${ORG_TOKEN}tampered`);
    assert.equal(res.status, 201);
    assert.equal(res.body.reporter, undefined);
  });

  it("refuses an unknown reason, a too-short message, and a missing message (400)", async () => {
    const tor = await createTor();
    assert.equal((await report(tor.id, { ...REPORT, reason: "spam" })).status, 400);
    assert.equal((await report(tor.id, { ...REPORT, message: "ผิด" })).status, 400);
    assert.equal((await report(tor.id, { reason: "other" })).status, 400);
  });

  it("answers 404 for a TOR that doesn't exist, or an id that isn't one", async () => {
    assert.equal((await report(new ObjectId().toString())).status, 404);
    assert.equal((await report("not-an-id")).status, 404);
  });
});

describe("GET /api/reports — the admins' list", () => {
  it("is admin-only", async () => {
    assert.equal((await api("/reports")).status, 403);
    assert.equal((await api("/reports", { token: ORG_TOKEN })).status, 403);
  });

  it("lists reports newest first, each with its TOR's title, and filters by status", async () => {
    const tor = await createTor();
    const first = await report(tor.id, { reason: "broken-link", message: "ลิงก์เอกสารประกาศเปิดไม่ได้" });
    const second = await report(tor.id, { reason: "duplicate", message: "ประกาศนี้ซ้ำกับอีกรายการหนึ่ง" });

    const res = await api("/reports?status=open&pageSize=100", { token: ADMIN_TOKEN });
    assert.equal(res.status, 200);
    assert.ok(res.body.total >= 2);
    assert.ok(res.body.items.every((item) => item.status === "open"));

    const ids = res.body.items.map((item) => item.id);
    assert.ok(ids.indexOf(second.body.id) < ids.indexOf(first.body.id), "newest first");
    const item = res.body.items.find((entry) => entry.id === first.body.id);
    assert.equal(item.torTitle, tor.title);
    assert.equal(item.reason, "broken-link");

    const resolved = await api("/reports?status=resolved&pageSize=100", { token: ADMIN_TOKEN });
    assert.ok(!resolved.body.items.some((entry) => entry.torId === tor.id));
  });

  it("refuses a status it doesn't know (400)", async () => {
    assert.equal((await api("/reports?status=closed", { token: ADMIN_TOKEN })).status, 400);
  });
});

describe("PATCH /api/reports/:id — resolving and reopening (#163)", () => {
  const ADMIN_EMAIL = "0123456789abcdef01234567@ci.test";
  const setStatus = (id, status, token = ADMIN_TOKEN) =>
    api(`/reports/${id}`, { method: "PATCH", body: { status }, token });
  const auditFor = (action, title) =>
    db().collection("auditLogEntries").find({ actor: ADMIN_EMAIL, action, detail: { $regex: `^${title}` } }).toArray();

  it("is admin-only", async () => {
    const tor = await createTor();
    const filed = await report(tor.id);
    assert.equal((await setStatus(filed.body.id, "resolved", "")).status, 403);
    assert.equal((await setStatus(filed.body.id, "resolved", ORG_TOKEN)).status, 403);
    assert.equal((await stored(filed.body.id)).status, "open");
  });

  it("resolves a report, says who and when, and logs it", async () => {
    const tor = await createTor();
    const filed = await report(tor.id);
    const res = await setStatus(filed.body.id, "resolved");
    assert.equal(res.status, 200);
    assert.equal(res.body.status, "resolved");
    assert.equal(res.body.resolvedBy, ADMIN_EMAIL);
    assert.ok(Date.now() - new Date(res.body.resolvedAt).getTime() < 60_000);

    const [entry, ...rest] = await auditFor("ปิดเรื่องแจ้งปัญหา TOR", tor.title);
    assert.equal(rest.length, 0);
    assert.equal(entry.detail, `${tor.title}: ${REPORT.message}`);

    const listed = await api("/reports?status=resolved&pageSize=100", { token: ADMIN_TOKEN });
    assert.ok(listed.body.items.some((item) => item.id === filed.body.id));
  });

  it("logs nothing when the status is already the one asked for", async () => {
    const tor = await createTor();
    const filed = await report(tor.id);
    await setStatus(filed.body.id, "resolved");
    assert.equal((await setStatus(filed.body.id, "resolved")).status, 200);
    assert.equal((await auditFor("ปิดเรื่องแจ้งปัญหา TOR", tor.title)).length, 1);
  });

  it("reopens a resolved report, clearing who resolved it", async () => {
    const tor = await createTor();
    const filed = await report(tor.id);
    await setStatus(filed.body.id, "resolved");
    const res = await setStatus(filed.body.id, "open");
    assert.equal(res.status, 200);
    assert.equal(res.body.status, "open");
    assert.equal(res.body.resolvedBy, undefined);
    assert.equal(res.body.resolvedAt, undefined);
    assert.equal((await auditFor("เปิดเรื่องแจ้งปัญหา TOR อีกครั้ง", tor.title)).length, 1);
  });

  it("refuses a status it doesn't know (400), and an unknown report (404)", async () => {
    const tor = await createTor();
    const filed = await report(tor.id);
    assert.equal((await setStatus(filed.body.id, "closed")).status, 400);
    assert.equal((await setStatus(new ObjectId().toString(), "resolved")).status, 404);
    assert.equal((await setStatus("not-an-id", "resolved")).status, 404);
  });
});
