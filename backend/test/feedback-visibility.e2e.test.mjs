// End-to-end coverage for who may read which comments on one TOR, run in CI
// against a freshly booted backend + MongoDB. GET /api/tor/:torId/feedback is
// public for approved comments; asking for comments still waiting for review,
// or rejected, takes an admin session. Before this, anyone could pass
// ?status=รอตรวจสอบ and read the unmoderated queue. The TOR and its comments
// are created through the API and removed after.

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

function makeToken(role, sub, secret = SESSION_SECRET) {
  const payload = {
    sub,
    email: `${sub}@ci.test`,
    name: `CI ${role}`,
    role,
    exp: Math.floor(Date.now() / 1000) + 3600,
  };
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${data}.${createHmac("sha256", secret).update(data).digest("base64url")}`;
}

const ADMIN_TOKEN = makeToken("admin", "0123456789abcdef01234567");
const ORG_TOKEN = makeToken("org", "0123456789abcdef01234568");
const OWNER_TOKEN = makeToken("owner", "0123456789abcdef01234569");
const FORGED_ADMIN_TOKEN = makeToken("admin", "0123456789abcdef01234567", "not-the-secret");

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

const PENDING = encodeURIComponent("รอตรวจสอบ");
const REJECTED = encodeURIComponent("ปฏิเสธ");
const APPROVED = encodeURIComponent("อนุมัติ");

let torId;
let pendingId;
let approvedId;

before(async () => {
  await mongo.connect();

  const tor = await api("/tor", {
    method: "POST",
    token: ADMIN_TOKEN,
    body: {
      title: `E2E: ใครเห็นความคิดเห็นที่รอตรวจ ${Date.now()}`,
      agency: "สำนักงานทดสอบการมองเห็นความคิดเห็น",
      budget: "฿900,000",
      deadline: "31 ธ.ค. 2575",
      daysLeft: 30,
      tags: ["software"],
      stage: "เปิดรับฟังความคิดเห็น",
      summary: "ทดสอบสิทธิ์อ่านความคิดเห็น",
    },
  });
  assert.equal(tor.status, 201, `create failed: ${JSON.stringify(tor.body)}`);
  torId = tor.body.id;

  const post = (text) =>
    api(`/tor/${torId}/feedback`, { method: "POST", body: { text, author: "CI" } });

  const pending = await post("ความคิดเห็นที่ยังรอผู้ดูแลตรวจ ห้ามเผยแพร่");
  assert.equal(pending.status, 201);
  pendingId = pending.body.id;

  const approved = await post("ความคิดเห็นที่ผู้ดูแลอนุมัติแล้ว เผยแพร่ได้");
  assert.equal(approved.status, 201);
  approvedId = approved.body.id;
  const review = await api(`/feedback/${approvedId}`, {
    method: "PATCH",
    token: ADMIN_TOKEN,
    body: { status: "อนุมัติ" },
  });
  assert.equal(review.status, 200);
});

after(async () => {
  if (torId) {
    const _id = new ObjectId(torId);
    await db().collection("feedback").deleteMany({ torId: _id });
    await db().collection("notifications").deleteMany({ torId: _id });
    await db().collection("tors").deleteOne({ _id });
  }
  await db()
    .collection("auditLogEntries")
    .deleteMany({ detail: { $regex: "ผู้ดูแลอนุมัติแล้ว เผยแพร่ได้|ใครเห็นความคิดเห็นที่รอตรวจ" } });
  await mongo.close();
});

const ids = (body) => body.map(({ id }) => id);

describe("GET /api/tor/:torId/feedback — who sees which comments", () => {
  it("shows a guest only approved comments", async () => {
    const res = await api(`/tor/${torId}/feedback`);
    assert.equal(res.status, 200);
    assert.deepEqual(ids(res.body), [approvedId]);
  });

  it("lets a guest ask for approved comments by name", async () => {
    const res = await api(`/tor/${torId}/feedback?status=${APPROVED}`);
    assert.equal(res.status, 200);
    assert.deepEqual(ids(res.body), [approvedId]);
  });

  for (const [label, status] of [
    ["waiting for review", PENDING],
    ["rejected", REJECTED],
  ]) {
    it(`refuses a guest asking for ${label} comments`, async () => {
      const res = await api(`/tor/${torId}/feedback?status=${status}`);
      assert.equal(res.status, 403);
      assert.equal(JSON.stringify(res.body).includes("ห้ามเผยแพร่"), false);
    });
  }

  for (const [label, token] of [
    ["an organization", ORG_TOKEN],
    ["a project owner", OWNER_TOKEN],
    ["a forged admin token", FORGED_ADMIN_TOKEN],
  ]) {
    it(`refuses ${label} asking for comments waiting for review`, async () => {
      const res = await api(`/tor/${torId}/feedback?status=${PENDING}`, { token });
      assert.equal(res.status, 403);
    });
  }

  it("shows an admin the comments waiting for review", async () => {
    const res = await api(`/tor/${torId}/feedback?status=${PENDING}`, { token: ADMIN_TOKEN });
    assert.equal(res.status, 200);
    assert.deepEqual(ids(res.body), [pendingId]);
  });
});
