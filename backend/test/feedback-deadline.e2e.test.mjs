// End-to-end coverage for the feedback deadline on a TOR (#140), run in CI
// against a freshly booted backend + MongoDB: which value the record and the
// listing report — the portal's own comment window first, what the model read
// off the draft second. Records are created through the admin route and the
// dates written straight into the collection; every row made here is removed.

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

/** A whole stored extraction, as ExtractionService writes one, with the comment deadline it read. */
const extractionWith = (feedbackDeadline) => ({
  scope: "พัฒนาระบบรับฟังความคิดเห็น",
  objectives: [],
  qualifications: [],
  deliverables: [],
  budgetAmount: null,
  referencePrice: null,
  contractPeriod: null,
  deadline: feedbackDeadline,
  deadlineTime: null,
  feedbackDeadline,
  evaluationCriteria: null,
  paymentTerms: [],
  bidSecurity: null,
  penalty: null,
  warrantyPeriod: null,
  contact: null,
  confidence: 0.9,
  model: "ci",
  documentUrl: "https://example.test/draft.pdf",
  extractedAt: new Date(),
  version: 7,
});

const created = [];
let serial = 0;
/** A fresh draft, with whichever deadlines the test writes onto it. */
async function createDraft(set = {}) {
  serial += 1;
  const res = await api("/tor", {
    method: "POST",
    token: ADMIN_TOKEN,
    body: {
      title: `จ้างพัฒนาระบบรับฟังความคิดเห็น CI ${Date.now()}-${serial}`,
      agency: `สำนักงานทดสอบความคิดเห็น ${serial}`,
      budget: "฿1,500,000",
      deadline: "31 ธ.ค. 2575",
      daysLeft: 30,
      tags: ["software"],
      stage: "เปิดรับฟังความคิดเห็น",
      summary: "ทดสอบวันสุดท้ายรับฟังความคิดเห็น",
    },
  });
  assert.equal(res.status, 201, `create failed: ${JSON.stringify(res.body)}`);
  const _id = new ObjectId(res.body.id);
  created.push(_id);
  if (Object.keys(set).length > 0) await db().collection("tors").updateOne({ _id }, { $set: set });
  return res.body.id;
}

/** The record as the listing reports it, paging until it turns up. */
async function listed(id) {
  for (let page = 1; page < 100; page++) {
    const res = await api(`/tor?page=${page}&pageSize=100`);
    const items = Array.isArray(res.body) ? res.body : res.body.items;
    const found = items.find((item) => item.id === id);
    if (found || items.length < 100) return found;
  }
  return undefined;
}

before(() => mongo.connect());
after(async () => {
  await db().collection("tors").deleteMany({ _id: { $in: created } });
  await db().collection("notifications").deleteMany({ torId: { $in: created } });
  await mongo.close();
});

describe("a TOR's feedback deadline", () => {
  it("is the portal's comment window when it published one", async () => {
    const id = await createDraft({ feedbackDeadline: "2026-11-05" });
    assert.equal((await api(`/tor/${id}`)).body.feedbackDeadline, "2026-11-05");
    assert.equal((await listed(id))?.feedbackDeadline, "2026-11-05");
  });

  it("falls back to what the model read off the draft", async () => {
    const id = await createDraft({ extraction: extractionWith("2026-11-12") });
    assert.equal((await api(`/tor/${id}`)).body.feedbackDeadline, "2026-11-12");
    assert.equal((await listed(id))?.feedbackDeadline, "2026-11-12");
  });

  it("prefers the portal's date over the model's", async () => {
    const id = await createDraft({ feedbackDeadline: "2026-11-05", extraction: extractionWith("2026-11-12") });
    assert.equal((await api(`/tor/${id}`)).body.feedbackDeadline, "2026-11-05");
    assert.equal((await listed(id))?.feedbackDeadline, "2026-11-05");
  });

  it("is absent when nobody stated one", async () => {
    const id = await createDraft();
    const detail = (await api(`/tor/${id}`)).body;
    assert.ok(!("feedbackDeadline" in detail) || detail.feedbackDeadline === undefined);
    const item = await listed(id);
    assert.ok(item, "the record should be listed");
    assert.equal(item.feedbackDeadline, undefined);
  });
});
