// End-to-end coverage for the Auditor Office's flagged-TOR list
// (GET /api/tor/flagged), run in CI against a freshly booted backend +
// MongoDB, same approach as tor.e2e.test.mjs.
//
// The guard itself (no token / wrong role -> 403, for every role) is already
// exhaustively unit-tested in role-guards.test.mjs — this file only covers
// what that one can't: that AuditorGuard is actually wired to this route, and
// the route's own contract — the `flag` filter, which reasons a record is
// flagged for, that budgetStatus/procurementMethod are only ever reported
// when they actually caused the flag, pagination, and that a soft-deleted
// record never appears however flagged it is.
//
// Fixtures go straight into Mongo rather than through POST /api/tor: the
// create DTO has no procurementMethod field at all, and a direct insert skips
// the duplicate-detection scan and notifyMatches() that POST triggers.

import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { after, before, describe, it } from "node:test";

import { MongoClient } from "mongodb";

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:4000";
const API = `${BASE_URL}/api`;
const SESSION_SECRET = process.env.SESSION_SECRET ?? "dev-only-insecure-secret-change-me";
const mongo = new MongoClient(process.env.MONGODB_URI ?? "mongodb://localhost:27017/torfinder");

function makeToken(role, email) {
  const iat = Math.floor(Date.now() / 1000);
  const payload = { sub: "000000000000000000000000", email, name: `CI ${role}`, role, iat, exp: iat + 3600 };
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", SESSION_SECRET).update(data).digest("base64url");
  return `${data}.${signature}`;
}

const ADMIN_TOKEN = makeToken("admin", "flagged-admin@ci.test");
const ORG_TOKEN = makeToken("org", "flagged-org@ci.test");
const AUDITOR_TOKEN = makeToken("auditor", "flagged-auditor@ci.test");

// Every fixture title carries this run id so a rerun against a persisted
// local database can't collide with a previous run's rows.
const RUN = Date.now().toString(36);

async function api(path, { token } = {}) {
  const headers = {};
  if (token) headers.authorization = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, { headers });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : undefined };
}

const inserted = [];

/** A minimal, otherwise-unremarkable TOR record, overridden per fixture. */
async function insertTor(overrides = {}) {
  const doc = {
    title: `Flagged fixture ${RUN} ${inserted.length}`,
    agency: "สำนักทดสอบ",
    budget: "฿5,000,000",
    deadline: "31 ธ.ค. 2575",
    daysLeft: 30,
    match: 0,
    tags: [],
    stage: "ประกาศ TOR",
    summary: "fixture",
    createdAt: new Date(),
    ...overrides,
  };
  const { insertedId } = await mongo.db().collection("tors").insertOne(doc);
  inserted.push(insertedId);
  return insertedId.toString();
}

function itemFor(body, id) {
  return body.items.find((item) => item.id === id);
}

before(async () => {
  await mongo.connect();
});

after(async () => {
  await mongo.db().collection("tors").deleteMany({ _id: { $in: inserted } });
  await mongo.close();
});

describe("GET /api/tor/flagged — auditor only", () => {
  it("forbids a request with no token (403)", async () => {
    const res = await api("/tor/flagged");
    assert.equal(res.status, 403);
  });

  it("forbids an organization token (403)", async () => {
    const res = await api("/tor/flagged", { token: ORG_TOKEN });
    assert.equal(res.status, 403);
  });

  it("forbids an admin token (403) — this list is auditor-only, not just privileged", async () => {
    const res = await api("/tor/flagged", { token: ADMIN_TOKEN });
    assert.equal(res.status, 403);
  });

  it("answers an auditor token (200)", async () => {
    const res = await api("/tor/flagged", { token: AUDITOR_TOKEN });
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.items));
  });
});

describe("GET /api/tor/flagged — which records appear, and why", () => {
  let budgetOnly, competitionOnly, both, unflagged, deletedButFlagged;

  before(async () => {
    budgetOnly = await insertTor({
      budgetStatus: "สูงกว่าปกติ",
      procurementMethod: "ประกวดราคาอิเล็กทรอนิกส์ (e-bidding)",
    });
    competitionOnly = await insertTor({ budgetStatus: "ปกติ", procurementMethod: "เฉพาะเจาะจง" });
    both = await insertTor({ budgetStatus: "ต่ำกว่าปกติ", procurementMethod: "คัดเลือก" });
    unflagged = await insertTor({
      budgetStatus: "ปกติ",
      procurementMethod: "ประกวดราคาอิเล็กทรอนิกส์ (e-bidding)",
    });
    deletedButFlagged = await insertTor({ budgetStatus: "สูงกว่าปกติ", deletedAt: new Date() });
  });

  it("includes every flagged record and excludes the rest", async () => {
    const res = await api("/tor/flagged", { token: AUDITOR_TOKEN });
    const ids = res.body.items.map((item) => item.id);

    assert.ok(ids.includes(budgetOnly));
    assert.ok(ids.includes(competitionOnly));
    assert.ok(ids.includes(both));
    assert.ok(!ids.includes(unflagged), "neither budget nor procurement method is a flag — shouldn't appear");
    assert.ok(!ids.includes(deletedButFlagged), "a soft-deleted record never appears, flagged or not");
  });

  it("only reports budgetStatus when it's actually why the record is flagged", async () => {
    const res = await api("/tor/flagged", { token: AUDITOR_TOKEN });

    const budgetItem = itemFor(res.body, budgetOnly);
    assert.equal(budgetItem.budgetStatus, "สูงกว่าปกติ");
    assert.deepEqual(budgetItem.reasons, ["วงเงินงบประมาณสูงกว่าปกติ เมื่อเทียบกับโครงการลักษณะเดียวกัน"]);

    const competitionItem = itemFor(res.body, competitionOnly);
    assert.equal(
      competitionItem.budgetStatus,
      undefined,
      "stored 'ปกติ' must never render as if it were a flag",
    );
  });

  it("only reports procurementMethod when it's actually why the record is flagged", async () => {
    const res = await api("/tor/flagged", { token: AUDITOR_TOKEN });

    const competitionItem = itemFor(res.body, competitionOnly);
    assert.equal(competitionItem.procurementMethod, "เฉพาะเจาะจง");
    assert.deepEqual(competitionItem.reasons, [
      "จัดซื้อจัดจ้างด้วยวิธีเฉพาะเจาะจง ซึ่งโดยลักษณะวิธีมีผู้เสนอราคาน้อยราย",
    ]);

    const budgetItem = itemFor(res.body, budgetOnly);
    assert.equal(
      budgetItem.procurementMethod,
      undefined,
      "a competitive e-bidding method must never render as if it were a flag",
    );
  });

  it("reports both reasons for a record flagged on both grounds", async () => {
    const res = await api("/tor/flagged", { token: AUDITOR_TOKEN });
    const bothItem = itemFor(res.body, both);

    assert.equal(bothItem.budgetStatus, "ต่ำกว่าปกติ");
    assert.equal(bothItem.procurementMethod, "คัดเลือก");
    assert.equal(bothItem.reasons.length, 2);
  });
});

describe("GET /api/tor/flagged — ?flag narrows the list", () => {
  let budgetHigh, budgetLow, competition;

  before(async () => {
    budgetHigh = await insertTor({ budgetStatus: "สูงกว่าปกติ" });
    budgetLow = await insertTor({ budgetStatus: "ต่ำกว่าปกติ" });
    competition = await insertTor({ budgetStatus: "ปกติ", procurementMethod: "คัดเลือก" });
  });

  it("flag=budget-high returns only the over-budget records", async () => {
    const res = await api("/tor/flagged?flag=budget-high", { token: AUDITOR_TOKEN });
    const ids = res.body.items.map((item) => item.id);
    assert.ok(ids.includes(budgetHigh));
    assert.ok(!ids.includes(budgetLow));
    assert.ok(!ids.includes(competition));
  });

  it("flag=budget-low returns only the under-budget records", async () => {
    const res = await api("/tor/flagged?flag=budget-low", { token: AUDITOR_TOKEN });
    const ids = res.body.items.map((item) => item.id);
    assert.ok(ids.includes(budgetLow));
    assert.ok(!ids.includes(budgetHigh));
  });

  it("flag=competition returns only the low-competition records", async () => {
    const res = await api("/tor/flagged?flag=competition", { token: AUDITOR_TOKEN });
    const ids = res.body.items.map((item) => item.id);
    assert.ok(ids.includes(competition));
    assert.ok(!ids.includes(budgetHigh));
    assert.ok(!ids.includes(budgetLow));
  });

  it("rejects an unknown flag value (400)", async () => {
    const res = await api("/tor/flagged?flag=nonsense", { token: AUDITOR_TOKEN });
    assert.equal(res.status, 400);
  });
});

describe("GET /api/tor/flagged — pagination", () => {
  let first, second, third;

  before(async () => {
    // Explicit, clearly-separated, deliberately future timestamps: the list
    // sorts newest-first, and these three must sort ahead of every other
    // budget-high fixture this file creates (which all default to "now"),
    // regardless of what order the test blocks happen to run in.
    const base = Date.now() + 10 * 60_000;
    first = await insertTor({ budgetStatus: "สูงกว่าปกติ", createdAt: new Date(base) });
    second = await insertTor({ budgetStatus: "สูงกว่าปกติ", createdAt: new Date(base - 1000) });
    third = await insertTor({ budgetStatus: "สูงกว่าปกติ", createdAt: new Date(base - 2000) });
  });

  it("limits items to pageSize and reports the true total", async () => {
    const res = await api("/tor/flagged?flag=budget-high&pageSize=2", { token: AUDITOR_TOKEN });
    assert.equal(res.body.items.length, 2);
    assert.ok(res.body.total >= 3, "total should count every matching record, not just this page");
    assert.equal(res.body.page, 1);
    assert.equal(res.body.pageSize, 2);
  });

  it("page 2 returns the remainder, newest-first", async () => {
    const pageOne = await api("/tor/flagged?flag=budget-high&pageSize=2&page=1", { token: AUDITOR_TOKEN });
    const pageTwo = await api("/tor/flagged?flag=budget-high&pageSize=2&page=2", { token: AUDITOR_TOKEN });

    const idsOne = pageOne.body.items.map((item) => item.id);
    const idsTwo = pageTwo.body.items.map((item) => item.id);
    assert.deepEqual(
      idsOne.filter((id) => idsTwo.includes(id)),
      [],
      "the two pages shouldn't overlap",
    );
    // The three fixtures above were inserted newest (`first`) to oldest
    // (`third`) by wall-clock backdating, so they sort first, second, third.
    assert.ok(idsOne.includes(first) && idsOne.includes(second));
    assert.ok(idsTwo.includes(third));
  });
});
