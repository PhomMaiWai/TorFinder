// End-to-end coverage for the Auditor Office's /auditor page, proving two
// independent gates and the rendered content together:
//   - proxy.ts (Next's renamed middleware): unauthenticated -> /login,
//     a non-auditor session -> redirected to its own home, never seeing the
//     page shell at all.
//   - the backend's AuditorGuard on GET /api/tor/flagged, covered on its own
//     in backend/test/tor-flagged.e2e.test.mjs — this file only needs to
//     prove the page actually renders what that endpoint returns.
//
// Node's built-in runner + fetch against a running `next build && next start`
// (server components have no rendered HTML to assert on from source alone).
// Session cookie minted the same way admin-dashboard.e2e.test.mjs does.
//
// Requires, all pointed at the same database:
//   - E2E_BACKEND_URL   a running backend (default http://localhost:4000)
//   - E2E_FRONTEND_URL  a running `next start` of this app (default http://localhost:3000)
//   - MONGODB_URI       the database both of the above are using
//   - SESSION_SECRET    must match what both processes booted with

import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { after, before, describe, it } from "node:test";

import { MongoClient } from "mongodb";

const FRONTEND_URL = process.env.E2E_FRONTEND_URL ?? "http://localhost:3000";
const MONGODB_URI = process.env.MONGODB_URI ?? "mongodb://torr:torr@localhost:27017/torr?authSource=admin";
const SESSION_SECRET = process.env.SESSION_SECRET ?? "dev-only-insecure-secret-change-me";
const mongo = new MongoClient(MONGODB_URI);

function makeToken(role, email) {
  const iat = Math.floor(Date.now() / 1000);
  const payload = { sub: "000000000000000000000000", email, name: `CI ${role}`, role, iat, exp: iat + 3600 };
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", SESSION_SECRET).update(data).digest("base64url");
  return `${data}.${signature}`;
}

const AUDITOR_TOKEN = makeToken("auditor", "auditor-e2e@ci.test");
const ADMIN_TOKEN = makeToken("admin", "auditor-e2e-admin@ci.test");
const ORG_TOKEN = makeToken("org", "auditor-e2e-org@ci.test");

/** Fetches a path with an optional session cookie, never following redirects. */
async function fetchPage(path, token) {
  const res = await fetch(`${FRONTEND_URL}${path}`, {
    headers: token ? { cookie: `torr_session=${token}; NEXT_LOCALE=en` } : {},
    redirect: "manual",
  });
  return { status: res.status, location: res.headers.get("location"), text: () => res.text() };
}

async function renderAsAuditor(path) {
  const res = await fetchPage(path, AUDITOR_TOKEN);
  assert.equal(res.status, 200, `${path} should render for an auditor session, got ${res.status}`);
  return res.text();
}

const inserted = [];

async function insertTor(overrides = {}) {
  const doc = {
    title: `Auditor e2e fixture ${inserted.length}`,
    agency: `Auditor Test Agency ${inserted.length}`,
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

before(async () => {
  await mongo.connect();
});

after(async () => {
  await mongo.db().collection("tors").deleteMany({ _id: { $in: inserted } });
  await mongo.close();
});

describe("/auditor — route access", () => {
  it("redirects an unauthenticated visitor to /login", async () => {
    const res = await fetchPage("/auditor");
    assert.equal(res.status, 307);
    assert.match(res.location, /\/login/);
  });

  it("redirects an admin session away — this area isn't theirs", async () => {
    const res = await fetchPage("/auditor", ADMIN_TOKEN);
    assert.equal(res.status, 307);
    assert.doesNotMatch(res.location, /\/auditor/);
  });

  it("redirects an org session away", async () => {
    const res = await fetchPage("/auditor", ORG_TOKEN);
    assert.equal(res.status, 307);
    assert.doesNotMatch(res.location, /\/auditor/);
  });

  it("renders for an auditor session", async () => {
    const res = await fetchPage("/auditor", AUDITOR_TOKEN);
    assert.equal(res.status, 200);
  });
});

describe("/auditor — renders what the backend flags", () => {
  let budgetOnly, competitionOnly, both;

  before(async () => {
    budgetOnly = await insertTor({
      title: "Over-budget fixture",
      budgetStatus: "สูงกว่าปกติ",
      procurementMethod: "ประกวดราคาอิเล็กทรอนิกส์ (e-bidding)",
    });
    competitionOnly = await insertTor({
      title: "Low-competition fixture",
      budgetStatus: "ปกติ",
      procurementMethod: "เฉพาะเจาะจง",
    });
    both = await insertTor({
      title: "Both-flagged fixture",
      budgetStatus: "ต่ำกว่าปกติ",
      procurementMethod: "คัดเลือก",
    });
    // Never flagged on either ground — must never appear.
    await insertTor({
      title: "Unflagged fixture",
      budgetStatus: "ปกติ",
      procurementMethod: "ประกวดราคาอิเล็กทรอนิกส์ (e-bidding)",
    });
  });

  it("lists every flagged fixture, links to its TOR, and excludes the unflagged one", async () => {
    const html = await renderAsAuditor("/auditor");

    assert.ok(html.includes("Over-budget fixture"));
    assert.ok(html.includes("Low-competition fixture"));
    assert.ok(html.includes("Both-flagged fixture"));
    assert.ok(!html.includes("Unflagged fixture"));

    assert.ok(html.includes(`href="/tor/${budgetOnly}"`));
    assert.ok(html.includes(`href="/tor/${competitionOnly}"`));
    assert.ok(html.includes(`href="/tor/${both}"`));
  });

  it("shows the budget reason only on the budget-flagged fixture", async () => {
    const html = await renderAsAuditor("/auditor");
    assert.ok(html.includes("วงเงินงบประมาณสูงกว่าปกติ เมื่อเทียบกับโครงการลักษณะเดียวกัน"));
  });

  it("shows the competition reason, and the flagged method, on the competition fixture", async () => {
    const html = await renderAsAuditor("/auditor");
    assert.ok(html.includes("จัดซื้อจัดจ้างด้วยวิธีเฉพาะเจาะจง ซึ่งโดยลักษณะวิธีมีผู้เสนอราคาน้อยราย"));
    assert.ok(html.includes("เฉพาะเจาะจง"));
  });

  it("shows both reasons for the record flagged on both grounds", async () => {
    const html = await renderAsAuditor("/auditor");
    assert.ok(html.includes("วงเงินงบประมาณต่ำกว่าปกติ เมื่อเทียบกับโครงการลักษณะเดียวกัน"));
    assert.ok(html.includes("จัดซื้อจัดจ้างด้วยวิธีคัดเลือก ซึ่งโดยลักษณะวิธีมีผู้เสนอราคาน้อยราย"));
  });

  it("?flag=budget-high narrows to only the over-budget fixture", async () => {
    const html = await renderAsAuditor("/auditor?flag=budget-high");
    assert.ok(html.includes("Over-budget fixture"));
    assert.ok(!html.includes("Low-competition fixture"));
    assert.ok(!html.includes("Both-flagged fixture"));
  });

  it("?flag=competition narrows to the two competition-flagged fixtures", async () => {
    const html = await renderAsAuditor("/auditor?flag=competition");
    assert.ok(html.includes("Low-competition fixture"));
    assert.ok(html.includes("Both-flagged fixture"));
    assert.ok(!html.includes("Over-budget fixture"));
  });

  it("?flag=budget-low narrows to only the under-budget fixture", async () => {
    const html = await renderAsAuditor("/auditor?flag=budget-low");
    assert.ok(html.includes("Both-flagged fixture"));
    assert.ok(!html.includes("Over-budget fixture"));
    assert.ok(!html.includes("Low-competition fixture"));
  });
});
