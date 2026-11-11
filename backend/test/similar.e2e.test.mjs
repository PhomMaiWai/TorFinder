// End-to-end coverage for "find similar" (POST /api/tor/similar, issue #255),
// against a freshly booted backend + MongoDB as CI runs it. CI leaves Vertex AI
// off, so these pin the keyword ranking — the path every deployment without a
// GCP project uses, and the one the AI path falls back to.
//
// Other test files create TORs in the same database, so assertions only look
// at where this file's own fixtures land relative to each other.

import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { before, describe, it } from "node:test";

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:4000";
const API = `${BASE_URL}/api`;
const SESSION_SECRET = process.env.SESSION_SECRET ?? "dev-only-insecure-secret-change-me";

function makeToken(role, email) {
  const payload = {
    sub: "000000000000000000000000",
    email,
    name: `CI ${role}`,
    role,
    exp: Math.floor(Date.now() / 1000) + 3600,
  };
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", SESSION_SECRET).update(data).digest("base64url");
  return `${data}.${signature}`;
}

const ADMIN_TOKEN = makeToken("admin", "similar-admin@ci.test");

// Digits only, so the tokenizer drops it and it never counts as a shared word.
const RUN = String(Date.now());

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
  let parsed;
  try {
    parsed = text ? JSON.parse(text) : undefined;
  } catch {
    parsed = text;
  }
  return { status: res.status, body: parsed };
}

async function createTor(title, agency, summary) {
  const res = await api("/tor", {
    method: "POST",
    token: ADMIN_TOKEN,
    body: {
      title: `${title} ${RUN}`,
      agency: `${agency} ${RUN}`,
      budget: "฿1,000,000",
      deadline: "31 ธ.ค. 2569",
      daysLeft: 30,
      tags: [],
      stage: "ประกาศ TOR",
      summary,
    },
  });
  assert.equal(res.status, 201, `create failed: ${JSON.stringify(res.body)}`);
  return res.body;
}

const similar = (body) => api("/tor/similar", { method: "POST", body });

/** Where a TOR landed in the results, or Infinity when it isn't there at all. */
const rankOf = (results, id) => {
  const index = results.findIndex((r) => r.id === id);
  return index === -1 ? Infinity : index;
};

describe("POST /api/tor/similar", () => {
  let elearningA;
  let elearningB;
  let cctv;

  before(async () => {
    elearningA = await createTor(
      "จ้างพัฒนาระบบอีเลิร์นนิง (e-Learning) บทเรียนออนไลน์",
      "สำนักการศึกษาทดสอบเอ",
      "พัฒนาบทเรียนออนไลน์และระบบอีเลิร์นนิงสำหรับครูและนักเรียน",
    );
    elearningB = await createTor(
      "จ้างจัดทำบทเรียนออนไลน์ e-Learning สำหรับนักเรียนโรงเรียนในสังกัด",
      "สำนักงานทดสอบบี",
      "ระบบอีเลิร์นนิงพร้อมบทเรียนออนไลน์ แบบทดสอบ และรายงานผลการเรียน",
    );
    cctv = await createTor(
      "จ้างซ่อมบำรุงกล้องโทรทัศน์วงจรปิด CCTV",
      "สำนักเทศกิจทดสอบซี",
      "ตรวจซ่อมและบำรุงรักษากล้องวงจรปิดพร้อมเครื่องบันทึกภาพ",
    );
  });

  it("ranks TORs about the same kind of work above unrelated ones for pasted text", async () => {
    const res = await similar({
      text: "บริษัทเคยพัฒนาระบบอีเลิร์นนิงและบทเรียนออนไลน์ให้โรงเรียน มีแบบทดสอบและรายงานผลการเรียน",
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.method, "keyword", "CI runs without Vertex AI");
    assert.equal(res.body.basedOn, null);
    const { results } = res.body;
    assert.ok(rankOf(results, elearningA.id) < rankOf(results, cctv.id));
    assert.ok(rankOf(results, elearningB.id) < rankOf(results, cctv.id));

    const hit = results.find((r) => r.id === elearningB.id);
    assert.ok(hit.similarity > 0 && hit.similarity <= 100);
    assert.ok(hit.sharedTerms.includes("บทเรียน"), `shared terms: ${hit.sharedTerms.join(", ")}`);
    assert.equal(typeof hit.title, "string");
    assert.equal(typeof hit.agency, "string");
  });

  it("orders results by similarity, best first", async () => {
    const res = await similar({ text: "ระบบอีเลิร์นนิง บทเรียนออนไลน์" });
    const scores = res.body.results.map((r) => r.similarity);
    assert.deepEqual(scores, [...scores].sort((a, b) => b - a));
  });

  it("finds TORs like a picked TOR, leaving the TOR itself out", async () => {
    const res = await similar({ torId: elearningA.id });

    assert.equal(res.status, 200);
    assert.deepEqual(res.body.basedOn, { id: elearningA.id, title: elearningA.title });
    const { results } = res.body;
    assert.equal(rankOf(results, elearningA.id), Infinity);
    assert.ok(rankOf(results, elearningB.id) < rankOf(results, cctv.id));
  });

  it("caps the number of results at the limit asked for", async () => {
    const res = await similar({ text: "ระบบอีเลิร์นนิง บทเรียนออนไลน์", limit: 1 });
    assert.equal(res.status, 200);
    assert.ok(res.body.results.length <= 1);
  });

  it("returns nothing rather than noise when no word is shared", async () => {
    const res = await similar({ text: "qwxyzzy plughfrobnicate" });
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.results, []);
  });

  it("refuses a request with both text and a TOR, or with neither", async () => {
    assert.equal((await similar({ text: "ระบบอีเลิร์นนิง บทเรียนออนไลน์", torId: elearningA.id })).status, 400);
    assert.equal((await similar({})).status, 400);
  });

  it("refuses text too short to describe a project", async () => {
    assert.equal((await similar({ text: "เว็บ" })).status, 400);
  });

  it("refuses an invalid TOR id and 404s an unknown one", async () => {
    assert.equal((await similar({ torId: "not-an-id" })).status, 400);
    assert.equal((await similar({ torId: "0123456789abcdef01234567" })).status, 404);
  });
});
