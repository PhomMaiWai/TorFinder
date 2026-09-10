// End-to-end coverage for the company/announcement match-scoring logic
// (backend/src/matching), run in CI by .github/workflows/auth.yml against a
// freshly booted backend + MongoDB.
//
// Same approach as tor.e2e.test.mjs: Node's built-in runner + fetch over HTTP.
//
// scoreMatch() is deterministic by design — every point traces to a rule — so
// these tests pin exact scores. Each case builds its own announcement through
// POST /api/tor and passes an explicit company profile to
// POST /api/matching/tor/:id/score, so the numbers don't depend on seed data
// or on other test files. The weights under test (skills .65, size .25,
// wording .10; useful-score cutoff 40) live in src/matching/matching.constants.ts.

import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { before, describe, it } from "node:test";

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:4000";
const API = `${BASE_URL}/api`;

// Mirrors backend/src/common/token.ts — used only for the /opportunities guard
// checks. Must match the SESSION_SECRET the server booted with.
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

// Digits only: it can't collide with a skill keyword, and every fixture title
// is "<one Thai/English phrase> <RUN>" so no two of them fuzzy-match on the
// TOR de-dup check (they share only this token).
const RUN = String(Date.now());
const AGENCY = `สำนักทดสอบการจับคู่ ${RUN}`;

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
  const res = await api("/tor", { method: "POST", body: torBody(overrides) });
  assert.equal(res.status, 201, `create failed: ${JSON.stringify(res.body)}`);
  return res.body;
}

function scoreFor(torId, company) {
  return api(`/matching/tor/${torId}/score`, { method: "POST", body: company });
}

describe("POST /api/matching/tor/:id/score — skill fit (weight .65)", () => {
  let webTor;

  before(async () => {
    webTor = await createTor({ title: `จ้างพัฒนาเว็บไซต์บริการประชาชน ${RUN}` });
  });

  it("scores a company that covers every implied skill at a credible size", async () => {
    const res = await scoreFor(webTor.id, {
      companyName: "เว็บสตูดิโอ",
      specialty: "Web Application",
      size: "11-50 คน",
    });

    assert.equal(res.status, 201);
    assert.equal(res.body.score, 90); // .65*1 + .25*1 + .10*0
    assert.deepEqual(res.body.gaps, []);
    assert.equal(res.body.reasons.length, 2);
    assert.ok(res.body.reasons.some((r) => r.includes("เว็บแอปพลิเคชัน")), "names the matched skill");
    assert.ok(res.body.reasons.some((r) => r.includes("วงเงิน")), "credits the size/budget fit");
  });

  it("drops the skill component to zero when nothing overlaps, and lists the gap", async () => {
    const res = await scoreFor(webTor.id, {
      companyName: "ผู้รับเหมาก่อสร้าง",
      specialty: "งานก่อสร้างและตกแต่งภายใน",
      size: "11-50 คน",
    });

    assert.equal(res.status, 201);
    assert.equal(res.body.score, 25); // .65*0 + .25*1 + .10*0
    assert.equal(res.body.gaps.length, 1);
    assert.ok(res.body.gaps[0].includes("เว็บแอปพลิเคชัน"), "the missing skill is spelled out");
  });

  it("scores an announcement that implies no skill as neutral, not as a failure", async () => {
    const plainTor = await createTor({ title: `จัดซื้อวัสดุสำนักงานทั่วไป ${RUN}`, budget: "ไม่ระบุ" });

    const res = await scoreFor(plainTor.id, {
      companyName: "ห้างหุ้นส่วนบริการทั่วไป",
      specialty: "บริการทั่วไป",
      size: "11-50 คน",
    });

    assert.equal(res.status, 201);
    assert.equal(res.body.score, 45); // .65*0.5 + .25*0.5 (no budget) + .10*0
    assert.deepEqual(res.body.reasons, []);
    assert.deepEqual(res.body.gaps, []);
  });
});

describe("POST /api/matching/tor/:id/score — company size vs budget (weight .25)", () => {
  it("discounts, rather than zeroes, a budget above the company's size ceiling", async () => {
    const bigTor = await createTor({ title: `จ้างทำเว็บไซต์หน่วยงาน ${RUN}`, budget: "฿100,000,000" });

    const res = await scoreFor(bigTor.id, {
      companyName: "ทีมเล็ก",
      specialty: "Web Application",
      size: "1-10 คน", // ceiling ฿5M, so sizeFit = 5M / 100M = 0.05
    });

    assert.equal(res.status, 201);
    assert.equal(res.body.score, 66); // round(.65*1 + .25*0.05 + .10*0)
    assert.equal(res.body.reasons.length, 1, "the size/budget line is withheld when over ceiling");
    assert.ok(res.body.gaps.some((g) => g.includes("สูงกว่าขนาดงาน")));
  });

  it("maps an unrecognised company size onto the mid-size ceiling", async () => {
    const tor = await createTor({ title: `ปรับปรุงระบบงานเว็บภายใน ${RUN}`, budget: "฿30,000,000" });

    const res = await scoreFor(tor.id, {
      companyName: "องค์กรไม่ระบุขนาด",
      specialty: "Web Application",
      size: "ไม่ได้ระบุขนาด", // unknown -> falls back to ฿20M, so 30M is over -> sizeFit = 20/30
    });

    assert.equal(res.status, 201);
    // 82, not 90: the fallback ceiling still discounts. An unknown size treated
    // as "no ceiling" would leave sizeFit at 1.
    assert.equal(res.body.score, 82);
  });
});

describe("POST /api/matching/tor/:id/score — wording tie-breaker (weight .10)", () => {
  let tor;

  before(async () => {
    // English title so the specialty's words can appear in it verbatim; no
    // skill keyword, so skillFit stays neutral and only wording moves.
    tor = await createTor({ title: `Traffic Analytics Platform ${RUN}`, budget: "฿10,000,000" });
  });

  it("adds points when the specialty's words show up in the title", async () => {
    const res = await scoreFor(tor.id, {
      companyName: "Overlap Co",
      specialty: "Traffic Analytics", // both words are in the title
      size: "1-10 คน", // ceiling ฿5M -> sizeFit = 5M / 10M = 0.5
    });

    assert.equal(res.status, 201);
    assert.equal(res.body.score, 55); // .65*0.5 + .25*0.5 + .10*1
  });

  it("gives nothing for a specialty whose words are absent from the title", async () => {
    const res = await scoreFor(tor.id, {
      companyName: "No Overlap Co",
      specialty: "งานออกแบบกราฟิก",
      size: "1-10 คน",
    });

    assert.equal(res.status, 201);
    assert.equal(res.body.score, 45); // same as above minus the .10 wording term
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
      specialty: "Web Application",
      size: "11-50 คน",
    });

    assert.equal(res.status, 201);
    assert.ok(Number.isInteger(res.body.score));
    assert.ok(res.body.score >= 0 && res.body.score <= 100);
  });

  it("scores the same pair identically every time", async () => {
    const company = { companyName: "Repeat Co", specialty: "Web Application", size: "11-50 คน" };
    const [a, b] = await Promise.all([scoreFor(tor.id, company), scoreFor(tor.id, company)]);

    assert.deepEqual(a.body, b.body);
  });

  it("accepts a profile with no specialty or size", async () => {
    const res = await scoreFor(tor.id, { companyName: "Bare Co" });

    assert.equal(res.status, 201);
    assert.ok(Number.isInteger(res.body.score));
  });

  it("rejects a profile with no company name (400)", async () => {
    const res = await scoreFor(tor.id, { specialty: "Web Application", size: "11-50 คน" });

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
    const webTor = await createTor({ title: `จ้างพัฒนาเว็บพอร์ทัลประชาชน ${RUN}` });

    const res = await api(`/matching/tor/${webTor.id}/companies`);

    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body));
    // Seeded by backend/src/database/seed-data.ts: an approved org whose
    // specialty is "Web Application".
    const arun = res.body.find((c) => c.companyName.includes("อรุณ"));
    assert.ok(arun, "the seeded web-dev company should be a candidate");
    assert.equal(arun.score, 90);
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
      title: `จ้างพัฒนาระบบเวชระเบียนโรงพยาบาล ${RUN}`,
      budget: "฿2,000,000",
    });

    const res = await api(`/matching/tor/${healthTor.id}/companies`);

    assert.equal(res.status, 200);
    // The seeded web-dev company scores 25 here (no skill overlap) -> filtered.
    assert.ok(!res.body.some((c) => c.companyName.includes("อรุณ")));
  });

  it("returns 404 for an unknown announcement id", async () => {
    const res = await api(`/matching/tor/${MISSING_ID}/companies`);

    assert.equal(res.status, 404);
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
