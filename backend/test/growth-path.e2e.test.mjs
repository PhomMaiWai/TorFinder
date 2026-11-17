// End-to-end coverage for GET /api/insights/growth (#261), run in CI against
// a freshly booted backend + MongoDB. Awards and open jobs are written
// straight into `tors` under agency names no seed uses, and the company is a
// real signed-up, approved account with its past-contract size set; every row
// made here is removed after.

import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { after, before, describe, it } from "node:test";

import { MongoClient, ObjectId } from "mongodb";

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:4000";
const API = `${BASE_URL}/api`;
const SESSION_SECRET = process.env.SESSION_SECRET ?? "dev-only-insecure-secret-change-me";
const mongo = new MongoClient(process.env.MONGODB_URI ?? "mongodb://localhost:27017/torfinder");
const tors = () => mongo.db().collection("tors");
const users = () => mongo.db().collection("users");

function makeToken(role, sub, email) {
  const payload = { sub, email: email ?? `${role}@ci.test`, name: `CI ${role}`, role, exp: Math.floor(Date.now() / 1000) + 3600 };
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", SESSION_SECRET).update(data).digest("base64url");
  return `${data}.${signature}`;
}

const GHOST_ID = "0123456789abcdef01234567";
const ADMIN_TOKEN = makeToken("admin", GHOST_ID, "admin@ci.test");

async function api(path, { method = "GET", body, token } = {}) {
  const headers = {};
  if (body !== undefined) headers["content-type"] = "application/json";
  if (token) headers.authorization = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : undefined };
}

const RUN = Date.now();
const QUIET = `สำนักงานทดสอบเติบโต แข่งน้อย CI-${RUN}`;
const BUSY = `สำนักงานทดสอบเติบโต แข่งสูง CI-${RUN}`;
const BIG = `สำนักงานทดสอบเติบโต งานใหญ่ CI-${RUN}`;

/** One awarded record for `amount` baht, won by `vendor`. */
function award(agency, n, vendor, amount, year = 2025) {
  const signedAt = new Date(`${year}-02-01T00:00:00Z`);
  return {
    title: `จ้างพัฒนาระบบ CI-${RUN}-award-${n}`,
    agency,
    budget: `฿${amount}`,
    budgetAmount: amount,
    deadline: "ไม่ระบุ",
    daysLeft: 0,
    match: 0,
    tags: [],
    stage: "ประกาศผู้ชนะ",
    summary: "บันทึกทดสอบ",
    createdAt: signedAt,
    projectNumber: `CI-${RUN}-A${n}`,
    contracts: [{ vendor, number: null, signedAt, amount, startsAt: null, endsAt: null, durationDays: null }],
  };
}

/** One announcement still open to bids (no closing date known yet). */
function openJob(agency, n, amount) {
  return {
    title: `จ้างพัฒนาระบบ CI-${RUN}-open-${n}`,
    agency,
    budget: `฿${amount}`,
    budgetAmount: amount,
    deadline: "ไม่ระบุ",
    daysLeft: 0,
    match: 0,
    tags: [],
    stage: "ประกาศ TOR",
    summary: "บันทึกทดสอบ",
    createdAt: new Date(),
    projectNumber: `CI-${RUN}-O${n}`,
  };
}

let org;

before(async () => {
  await mongo.connect();
  const email = `ci+growth-${RUN}@example.com`;
  const signup = await api("/auth/signup", {
    method: "POST",
    body: {
      email,
      password: "Str0ngPass!",
      companyName: `CI Growth Co ${RUN}`,
      taxId: "0105563001236",
      contactName: "CI Runner",
      phone: "0812345678",
      address: "1 CI Street, Bangkok",
      specialty: "Software",
      size: "1-10 คน",
    },
  });
  assert.equal(signup.status, 201);
  const account = (await api("/accounts?status=pending", { token: ADMIN_TOKEN })).body.find((a) => a.email === email);
  assert.equal((await api(`/accounts/${account.id}`, { method: "PATCH", token: ADMIN_TOKEN, body: { status: "approved" } })).status, 200);
  await users().updateOne({ _id: new ObjectId(account.id) }, { $set: { "company.largestPastContract": 1_000_000 } });
  org = { id: account.id, email, token: makeToken("org", account.id, email) };

  await tors().insertMany([
    award(QUIET, 1, `บริษัท เงียบ ${RUN} จำกัด`, 600_000, 2024),
    award(QUIET, 2, `บริษัท เงียบ ${RUN} จำกัด`, 700_000, 2025),
    award(QUIET, 3, `บริษัท สอง ${RUN} จำกัด`, 800_000, 2025),
    ...["ก", "ข", "ค", "ง"].map((name, i) => award(BUSY, 10 + i, `บริษัท ${name} ${RUN} จำกัด`, 900_000)),
    award(BIG, 20, `บริษัท ใหญ่ ${RUN} จำกัด`, 40_000_000),
    award(BIG, 21, `บริษัท ใหญ่สอง ${RUN} จำกัด`, 60_000_000),
    openJob(QUIET, 1, 750_000),
    openJob(QUIET, 2, 1_800_000),
    openJob(BIG, 3, 30_000_000),
  ]);
});

after(async () => {
  await tors().deleteMany({ title: { $regex: `CI-${RUN}-` } });
  await users().deleteOne({ email: org.email });
  await mongo.close();
});

describe("GET /api/insights/growth", () => {
  it("is for company accounts only", async () => {
    // A role guard refuses a missing token and the wrong role alike.
    assert.equal((await api("/insights/growth")).status, 403);
    assert.equal((await api("/insights/growth", { token: ADMIN_TOKEN })).status, 403);
  });

  it("404s for a company session whose account no longer exists", async () => {
    assert.equal((await api("/insights/growth", { token: makeToken("org", GHOST_ID) })).status, 404);
  });

  it("sizes the path by the company's largest past contract", async () => {
    const { status, body } = await api("/insights/growth", { token: org.token });
    assert.equal(status, 200);
    assert.equal(body.cap, 1_000_000);
    assert.equal(body.capSource, "pastContract");
    assert.equal(body.nextCap, 2_000_000);
  });

  it("recommends the agency with more jobs per rival, ahead of the crowded one, and never the big-job one", async () => {
    const { body } = await api("/insights/growth", { token: org.token });
    // Only the top few agencies are listed, and other records in the database
    // may take places, so the crowded one may be cut — but never ranked first.
    const ours = body.agencies.filter((row) => row.agency.includes(`CI-${RUN}`)).map((row) => row.agency);
    assert.equal(ours[0], QUIET);
    assert.ok(!ours.includes(BIG), "no job there is the company's size");

    const quiet = body.agencies.find((row) => row.agency === QUIET);
    assert.equal(quiet.rightSized, 3);
    assert.equal(quiet.rivals, 2);
    assert.equal(quiet.rehires, 1, "the same company won there in 2024 and 2025");
    assert.deepEqual(quiet.years, [2025, 2024]);
  });

  it("lists open jobs at this size and one step up, never the far bigger one", async () => {
    const { body } = await api("/insights/growth", { token: org.token });
    const mine = (list) => list.filter((job) => job.title.includes(`CI-${RUN}`));

    const now = mine(body.jobs.now);
    assert.equal(now.length, 1);
    assert.equal(now[0].agency, QUIET);
    assert.equal(now[0].atRecommendedAgency, true);

    const next = mine(body.jobs.next);
    assert.equal(next.length, 1);
    assert.equal(next[0].budgetAmount, 1_800_000);
    assert.equal(next[0].atRecommendedAgency, true);
  });
});
