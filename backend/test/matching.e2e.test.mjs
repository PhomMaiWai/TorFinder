// End-to-end coverage for the company/announcement match-scoring logic
// (backend/src/matching), run in CI by .github/workflows/auth.yml against a
// freshly booted backend + MongoDB.
//
// Same approach as tor.e2e.test.mjs: Node's built-in runner + fetch over HTTP.
//
// scoreMatch() is deterministic by design — every point traces to a rule — so
// these tests pin exact scores. Each case builds its own announcement through
// POST /api/tor and passes an explicit company profile to
// POST /api/matching/tor/:id/score, so the numbers don't depend on other test
// files. The weights under test (work type .50, eligibility .35, budget .15;
// off-type cap 35, useful-score cutoff 40) live in
// src/matching/matching.constants.ts. A manual record carries no extracted
// qualifications, so eligibility sits at its "nothing stated" value of 0.6.

import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { before, describe, it } from "node:test";

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:4000";
const API = `${BASE_URL}/api`;

// Mirrors backend/src/common/token.ts — for the guarded routes: creating a TOR
// and the ranked-companies list take an admin, /opportunities any session. Must
// match the SESSION_SECRET the server booted with.
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

const GHOST_TOKEN = makeToken("org", "matching-ghost@ci.test");
const ADMIN_TOKEN = makeToken("admin", "matching-admin@ci.test");
const ORG_TOKEN = makeToken("org", "matching-org@ci.test");

// Digits only: it can't collide with a skill keyword, and every fixture title
// is "<one Thai/English phrase> <RUN>" so no two of them fuzzy-match on the
// TOR de-dup check (they share only this token).
const RUN = String(Date.now());
const AGENCY = `สำนักทดสอบการจับคู่ ${RUN}`;

// Seeded Arun (development + maintenance, ฿1M–10M) against a ฿1M title naming
// development, web and maintenance: .50*(.7 + .3*2/3) + .35*.6 + .15*1.
const ARUN_PORTAL_SCORE = 81;

// A well-formed ObjectId no record will have.
const MISSING_ID = "0123456789abcdef01234567";

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

// Skill-neutral filler for the fields scoring also reads — kept free of any
// keyword so each fixture's `needed` skills come only from its title.
function torBody(overrides = {}) {
  return {
    title: `เรื่องทดสอบ ${RUN}`,
    agency: AGENCY,
    budget: "฿1,000,000",
    deadline: "31 ธ.ค. 2569",
    daysLeft: 30,
    tags: ["ทั่วไป"],
    stage: "ประกาศ TOR",
    summary: "รายละเอียดประกาศ",
    ...overrides,
  };
}

async function createTor(overrides) {
  const res = await api("/tor", { method: "POST", body: torBody(overrides), token: ADMIN_TOKEN });
  assert.equal(res.status, 201, `create failed: ${JSON.stringify(res.body)}`);
  return res.body;
}

function scoreFor(torId, company) {
  return api(`/matching/tor/${torId}/score`, { method: "POST", body: company });
}

describe("POST /api/matching/tor/:id/score — work type (.50) and budget (.15)", () => {
  let webTor;

  before(async () => {
    // development + web + eservice, ฿1,000,000
    webTor = await createTor({ title: `จ้างพัฒนาเว็บไซต์บริการประชาชน ${RUN}` });
  });

  it("scores a company that does every kind of work the title names, in its budget range", async () => {
    const res = await scoreFor(webTor.id, {
      companyName: "เว็บสตูดิโอ",
      workTypes: ["development", "web", "eservice"],
      preferredBudgetMin: 500_000,
      preferredBudgetMax: 5_000_000,
    });

    assert.equal(res.status, 201);
    assert.equal(res.body.score, 86); // .50*1 + .35*.6 + .15*1
    assert.deepEqual(res.body.gaps, []);
    assert.equal(res.body.eligible, null, "nothing stated is not proof of eligibility");
    assert.ok(res.body.reasons.some((r) => r.includes("วงเงิน")), "credits the budget fit");
  });

  it("discounts a budget outside the company's range and says so", async () => {
    const res = await scoreFor(webTor.id, {
      companyName: "เว็บสตูดิโอใหญ่",
      workTypes: ["development", "web", "eservice"],
      preferredBudgetMin: 5_000_000,
      preferredBudgetMax: 20_000_000,
    });

    assert.equal(res.status, 201);
    assert.equal(res.body.score, 74); // .50*1 + .35*.6 + .15*.2
    assert.ok(res.body.gaps.some((g) => g.includes("อยู่นอกช่วง")));
  });

  it("credits partial overlap above nothing but below full coverage", async () => {
    const res = await scoreFor(webTor.id, {
      companyName: "ทีมเว็บ",
      workTypes: ["web"],
      preferredBudgetMin: 500_000,
      preferredBudgetMax: 5_000_000,
    });

    assert.equal(res.status, 201);
    assert.equal(res.body.score, 76); // .50*(.7 + .3/3) + .35*.6 + .15*1
  });

  it("caps a company that does none of the work named", async () => {
    const res = await scoreFor(webTor.id, {
      companyName: "ผู้ขายฮาร์ดแวร์",
      workTypes: ["hardware"],
      preferredBudgetMin: 500_000,
      preferredBudgetMax: 5_000_000,
    });

    assert.equal(res.status, 201);
    assert.equal(res.body.score, 35); // 36 before the off-type cap
    assert.ok(res.body.gaps.some((g) => g.includes("ไม่อยู่ในงานที่บริษัทระบุ")));
  });

  it("scores a profile that names no work type as neutral, not as a failure", async () => {
    const res = await scoreFor(webTor.id, { companyName: "บริษัทยังไม่กรอกข้อมูล" });

    assert.equal(res.status, 201);
    assert.equal(res.body.score, 55); // .50*.5 + .35*.6 + .15*.6
    assert.deepEqual(res.body.reasons, []);
  });

  it("rejects an unknown work type (400)", async () => {
    const res = await scoreFor(webTor.id, { companyName: "X", workTypes: ["construction"] });

    assert.equal(res.status, 400);
  });
});

describe("POST /api/matching/tor/:id/score — invariants & errors", () => {
  let tor;

  before(async () => {
    tor = await createTor({ title: `จ้างพัฒนาระบบงานเว็บสำนักงาน ${RUN}` });
  });

  it("always returns an integer score between 0 and 100", async () => {
    const res = await scoreFor(tor.id, {
      companyName: "Any Co",
      workTypes: ["web"],
      largestPastContract: 1_000_000,
    });

    assert.equal(res.status, 201);
    assert.ok(Number.isInteger(res.body.score));
    assert.ok(res.body.score >= 0 && res.body.score <= 100);
  });

  it("scores the same pair identically every time", async () => {
    const company = { companyName: "Repeat Co", workTypes: ["development", "web"] };
    const [a, b] = await Promise.all([scoreFor(tor.id, company), scoreFor(tor.id, company)]);

    assert.deepEqual(a.body, b.body);
  });

  it("accepts a profile with nothing but a name", async () => {
    const res = await scoreFor(tor.id, { companyName: "Bare Co" });

    assert.equal(res.status, 201);
    assert.ok(Number.isInteger(res.body.score));
  });

  it("rejects a profile with no company name (400)", async () => {
    const res = await scoreFor(tor.id, { workTypes: ["web"] });

    assert.equal(res.status, 400);
  });

  it("returns 404 for a well-formed but unknown announcement id", async () => {
    const res = await scoreFor(MISSING_ID, { companyName: "X" });

    assert.equal(res.status, 404);
  });

  it("returns 404 for a malformed announcement id", async () => {
    const res = await scoreFor("not-an-id", { companyName: "X" });

    assert.equal(res.status, 404);
  });
});

describe("GET /api/matching/tor/:id/companies — ranked candidates", () => {
  it("ranks a fitting approved company, sorted and above the useful-score cutoff", async () => {
    const webTor = await createTor({ title: `จ้างพัฒนาและบำรุงรักษาเว็บพอร์ทัลประชาชน ${RUN}` });

    const res = await api(`/matching/tor/${webTor.id}/companies`, { token: ADMIN_TOKEN });

    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body));
    // Seeded by backend/src/database/seed-data.ts: an approved org doing
    // development + maintenance, budget range ฿1M–10M.
    const arun = res.body.find((c) => c.companyName.includes("อรุณ"));
    assert.ok(arun, "the seeded development company should be a candidate");
    assert.equal(arun.score, ARUN_PORTAL_SCORE);
    assert.ok(Array.isArray(arun.reasons) && Array.isArray(arun.gaps));

    assert.ok(
      res.body.every((c) => c.score >= 40),
      "candidates below the useful-score cutoff are dropped",
    );
    for (let i = 1; i < res.body.length; i += 1) {
      assert.ok(res.body[i - 1].score >= res.body[i].score, "candidates come back best-first");
    }
  });

  it("omits a company whose score falls below the cutoff", async () => {
    const healthTor = await createTor({
      title: `จัดหาระบบเวชระเบียนโรงพยาบาล ${RUN}`,
      budget: "฿2,000,000",
    });

    const res = await api(`/matching/tor/${healthTor.id}/companies`, { token: ADMIN_TOKEN });

    assert.equal(res.status, 200);
    // The seeded development company does no health work -> capped at 35, filtered.
    assert.ok(!res.body.some((c) => c.companyName.includes("อรุณ")));
  });

  it("returns 404 for an unknown announcement id", async () => {
    const res = await api(`/matching/tor/${MISSING_ID}/companies`, { token: ADMIN_TOKEN });

    assert.equal(res.status, 404);
  });
});

describe("GET /api/matching/tor/:id/companies — admin only", () => {
  let tor;

  before(async () => {
    tor = await createTor({ title: `จ้างพัฒนาเว็บไซต์องค์กร ${RUN}` });
  });

  it("forbids a request with no token (403)", async () => {
    const res = await api(`/matching/tor/${tor.id}/companies`);

    assert.equal(res.status, 403);
  });

  it("forbids an organization token (403) — one company can't read the others' scores", async () => {
    const res = await api(`/matching/tor/${tor.id}/companies`, { token: ORG_TOKEN });

    assert.equal(res.status, 403);
  });
});

describe("POST /api/matching/budget/refresh — admin only", () => {
  it("forbids a request with no token (403)", async () => {
    const res = await api("/matching/budget/refresh", { method: "POST" });

    assert.equal(res.status, 403);
  });

  it("forbids an organization token (403)", async () => {
    const res = await api("/matching/budget/refresh", { method: "POST", token: ORG_TOKEN });

    assert.equal(res.status, 403);
  });

  it("lets an admin recompute the verdicts", async () => {
    const res = await api("/matching/budget/refresh", { method: "POST", token: ADMIN_TOKEN });

    assert.equal(res.status, 201);
  });
});

describe("matching routes that stay public", () => {
  it("serves a budget verdict without a session", async () => {
    const tor = await createTor({ title: `จ้างพัฒนาระบบบริการ ${RUN}` });
    const res = await api(`/matching/tor/${tor.id}/budget`);

    assert.equal(res.status, 200);
  });
});

describe("GET /api/matching/opportunities — caller's own matches", () => {
  it("requires a session (401)", async () => {
    const res = await api("/matching/opportunities");

    assert.equal(res.status, 401);
  });

  it("404s when the session's account no longer exists", async () => {
    const res = await api("/matching/opportunities", { token: GHOST_TOKEN });

    assert.equal(res.status, 404);
  });
});
