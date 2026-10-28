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

before(() => mongo.connect());
after(async () => {
  await db()
    .collection("tors")
    .deleteMany({ _id: { $in: created } });
  await db()
    .collection("notifications")
    .deleteMany({ torId: { $in: created } });
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
      feed.body.some((e) => e.actor === ACTOR && e.detail === title && e.type === "manual"),
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
});
