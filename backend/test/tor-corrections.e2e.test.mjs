// End-to-end coverage for an admin correcting an announcement, run in CI
// against a freshly booted backend + MongoDB with SEED_DEMO_DATA on: which
// fields a save locks, who it says made the change, what the audit log
// records, and what marking a record "not software" takes it out of.

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

const ACTOR = `admin+fix-${Date.now()}@ci.test`;

function makeToken(role, sub, email, name) {
  const payload = {
    sub,
    email,
    name,
    role,
    exp: Math.floor(Date.now() / 1000) + 3600,
  };
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${data}.${createHmac("sha256", SESSION_SECRET).update(data).digest("base64url")}`;
}

const ADMIN_TOKEN = makeToken(
  "admin",
  "0123456789abcdef01234567",
  ACTOR,
  "สมศรี ผู้ดูแล",
);

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
      title: `จ้างพัฒนาระบบแก้ไขข้อมูล CI ${Date.now()}-${serial}`,
      agency: `สำนักงานทดสอบการแก้ไข ${serial}`,
      budget: "฿2,000,000",
      deadline: "31 ธ.ค. 2575",
      daysLeft: 30,
      tags: ["software"],
      stage: "เปิดรับฟังความคิดเห็น",
      summary: "ข้อมูลก่อนแก้ไข",
    },
  });
  assert.equal(res.status, 201, `create failed: ${JSON.stringify(res.body)}`);
  created.push(new ObjectId(res.body.id));
  return (await api(`/tor/${res.body.id}`)).body;
}

/** The whole form, as the edit page posts it: every field, changed or not. */
const formOf = (tor) => ({
  title: tor.title,
  agency: tor.agency,
  budget: tor.budget,
  deadline: tor.deadline,
  daysLeft: tor.daysLeft,
  tags: tor.tags,
  stage: tor.stage,
  summary: tor.summary,
  budgetStatus: tor.budgetStatus ?? "ปกติ",
  classification: tor.classification ?? "software",
});

const save = (id, body, token = ADMIN_TOKEN) =>
  api(`/tor/${id}`, { method: "PATCH", token, body });
/** The entries a correction wrote; creating the record writes one of its own. */
const auditFor = (title) =>
  db()
    .collection("auditLogEntries")
    .find({
      actor: ACTOR,
      action: { $ne: "เพิ่มประกาศ TOR" },
      detail: { $regex: title.replace(/[()]/g, ".") },
    })
    .toArray();

/** Every listed announcement's id, across pages. */
async function listedIds() {
  const ids = new Set();
  for (let page = 1; page < 100; page++) {
    const res = await api(`/tor?page=${page}&pageSize=100`);
    const items = Array.isArray(res.body) ? res.body : res.body.items;
    for (const item of items) ids.add(item.id);
    if (items.length < 100) break;
  }
  return ids;
}

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

describe("an admin correcting an announcement", () => {
  it("is admin-only", async () => {
    const tor = await createTor();
    const org = makeToken(
      "org",
      new ObjectId().toString(),
      "org@ci.test",
      "CI org",
    );
    assert.equal((await save(tor.id, { summary: "x" }, org)).status, 403);
  });

  it("saving the form unchanged writes and locks nothing", async () => {
    const tor = await createTor();
    const res = await save(tor.id, formOf(tor));
    assert.equal(res.status, 200);
    assert.equal(res.body.lastEdited, undefined);
    assert.equal(res.body.lockedFields, undefined);
    assert.equal((await auditFor(tor.title)).length, 0);
  });

  it("locks only the fields that changed, and says who changed them and when", async () => {
    const tor = await createTor();
    const res = await save(tor.id, {
      ...formOf(tor),
      summary: "ข้อมูลที่ถูกต้อง",
      budget: "฿2,500,000",
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.summary, "ข้อมูลที่ถูกต้อง");
    assert.deepEqual([...res.body.lockedFields].sort(), ["budget", "summary"]);
    assert.equal(res.body.lastEdited.by, "สมศรี ผู้ดูแล");
    assert.ok(Date.now() - new Date(res.body.lastEdited.at).getTime() < 60_000);

    const detail = (await api(`/tor/${tor.id}`)).body;
    assert.equal(detail.lastEdited.by, "สมศรี ผู้ดูแล");

    const [entry, ...rest] = await auditFor(tor.title);
    assert.equal(rest.length, 0);
    assert.equal(entry.action, "แก้ไขข้อมูลประกาศ TOR");
    assert.match(entry.detail, /งบประมาณ/);
    assert.match(entry.detail, /รายละเอียด/);
  });

  it("adds to the locks on a later correction instead of replacing them", async () => {
    const tor = await createTor();
    await save(tor.id, { summary: "แก้ครั้งแรก" });
    const res = await save(tor.id, { title: `${tor.title} (แก้)` });
    assert.deepEqual([...res.body.lockedFields].sort(), ["summary", "title"]);
  });

  it("refuses a classification it doesn't know", async () => {
    const tor = await createTor();
    assert.equal(
      (await save(tor.id, { classification: "hardware" })).status,
      400,
    );
  });
});

describe("marking an announcement as not software", () => {
  let tor;
  before(async () => {
    tor = await createTor();
  });

  it("takes it out of the listing and puts it on the admin's not-software list", async () => {
    assert.ok((await listedIds()).has(tor.id), "precondition: listed");

    const res = await save(tor.id, {
      ...formOf(tor),
      classification: "not-software",
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.classification, "not-software");
    assert.deepEqual(res.body.lockedFields, ["classification"]);

    assert.ok(!(await listedIds()).has(tor.id));
    const own = await api("/tor/not-software", { token: ADMIN_TOKEN });
    assert.equal(own.status, 200);
    assert.ok(own.body.some((t) => t.id === tor.id));

    const [entry] = await auditFor(tor.title);
    assert.equal(entry.action, "จัดประเภทประกาศ TOR ใหม่");
    assert.match(entry.detail, /ไม่ใช่งานซอฟต์แวร์/);
  });

  it("keeps the not-software list to admins", async () => {
    const org = makeToken(
      "org",
      new ObjectId().toString(),
      "org@ci.test",
      "CI org",
    );
    assert.equal((await api("/tor/not-software", { token: org })).status, 403);
  });

  it("goes back into the listing when marked as software again", async () => {
    await save(tor.id, { classification: "software" });
    assert.ok((await listedIds()).has(tor.id));
    const own = (await api("/tor/not-software", { token: ADMIN_TOKEN })).body;
    assert.ok(!own.some((t) => t.id === tor.id));
  });
});
