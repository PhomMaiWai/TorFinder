// End-to-end coverage for match alerts, run in CI against a freshly booted
// backend + MongoDB with SEED_DEMO_DATA on.
//
// An admin-created announcement goes through the same notifyMatches() an
// import does, so these tests create one and read what the seeded approved
// company was told. Tokens are minted the way notifications.e2e does, to stay
// off the login rate limiter; the company's id comes from the database. The
// company's settings are put back and the test announcements removed after.

import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { after, before, describe, it } from "node:test";

import { MongoClient, ObjectId } from "mongodb";

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:4000";
const API = `${BASE_URL}/api`;
const SESSION_SECRET = process.env.SESSION_SECRET ?? "dev-only-insecure-secret-change-me";
const mongo = new MongoClient(process.env.MONGODB_URI ?? "mongodb://localhost:27017/torfinder");

/** Seeded by backend/src/database/seed-data.ts: approved, develops and maintains software. */
const COMPANY_EMAIL = "contact@arundigital.co.th";

function makeToken(role, sub, email) {
  const payload = { sub, email, name: `CI ${role}`, role, exp: Math.floor(Date.now() / 1000) + 3600 };
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${data}.${createHmac("sha256", SESSION_SECRET).update(data).digest("base64url")}`;
}

const ADMIN_TOKEN = makeToken("admin", "0123456789abcdef01234567", "admin@ci.test");
let companyId;
let companyToken;
const created = [];

async function api(path, { method = "GET", body, token } = {}) {
  const headers = {};
  if (body !== undefined) headers["content-type"] = "application/json";
  if (token) headers.authorization = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : undefined };
}

let serial = 0;
/** A software project the seeded company fits, at the given stage. */
async function createTor(stage) {
  serial += 1;
  const res = await api("/tor", {
    method: "POST",
    token: ADMIN_TOKEN,
    body: {
      title: `จ้างพัฒนาระบบสารสนเทศและเว็บแอปพลิเคชัน CI ${Date.now()}-${serial}`,
      agency: `สำนักงานทดสอบการแจ้งเตือน ${serial}`,
      budget: "฿5,000,000",
      deadline: "31 ธ.ค. 2575",
      daysLeft: 30,
      tags: ["software", "web"],
      stage,
      summary: "พัฒนาระบบสารสนเทศ เว็บแอปพลิเคชัน และบำรุงรักษาระบบ",
    },
  });
  assert.equal(res.status, 201, `create failed: ${JSON.stringify(res.body)}`);
  created.push(new ObjectId(res.body.id));
  return res.body.id;
}

async function scoreOf(torId) {
  const res = await api(`/matching/tor/${torId}/companies`, { token: ADMIN_TOKEN });
  assert.equal(res.status, 200);
  const company = res.body.find((entry) => entry.companyName.includes("อรุณ") || entry.companyName.match(/arun/i));
  return company?.score;
}

async function alertsFor(torId) {
  const res = await api("/notifications", { token: companyToken });
  assert.equal(res.status, 200);
  return res.body.filter((n) => n.type === "match" && n.torId === torId);
}

const setAlerts = (settings) => api("/accounts/me", { method: "PATCH", token: companyToken, body: settings });

before(async () => {
  await mongo.connect();
  const company = await mongo.db().collection("users").findOne({ email: COMPANY_EMAIL });
  assert.ok(company, "the seeded company exists");
  companyId = company._id.toString();
  companyToken = makeToken("org", companyId, COMPANY_EMAIL);
});

after(async () => {
  await setAlerts({ matchAlerts: true, matchThreshold: 70 });
  await mongo.db().collection("tors").deleteMany({ _id: { $in: created } });
  await mongo.db().collection("notifications").deleteMany({ torId: { $in: created } });
  await mongo.close();
});

describe("match alert settings in the profile", () => {
  it("rejects a threshold outside 40–95 and a switch that isn't a boolean", async () => {
    assert.equal((await setAlerts({ matchThreshold: 30 })).status, 400);
    assert.equal((await setAlerts({ matchThreshold: 96 })).status, 400);
    assert.equal((await setAlerts({ matchAlerts: "yes" })).status, 400);
  });

  it("stores the switch and threshold on the company profile", async () => {
    const res = await setAlerts({ matchAlerts: true, matchThreshold: 40 });
    assert.equal(res.status, 200);
    assert.equal(res.body.company.matchAlerts, true);
    assert.equal(res.body.company.matchThreshold, 40);
  });
});

describe("alerts on a new announcement", () => {
  it("tells the company about a matching draft, with the score and the announcement", async () => {
    await setAlerts({ matchAlerts: true, matchThreshold: 40 });
    const torId = await createTor("เปิดรับฟังความคิดเห็น");
    const score = await scoreOf(torId);
    assert.ok(score >= 40, `precondition: the test project should fit the company (scored ${score})`);

    const alerts = await alertsFor(torId);
    assert.equal(alerts.length, 1);
    assert.equal(alerts[0].score, score);
    assert.match(alerts[0].title, new RegExp(`${score}%`));
    assert.match(alerts[0].title, /เปิดรับฟังความคิดเห็น/);
  });

  it("stays quiet when the company turned alerts off", async () => {
    await setAlerts({ matchAlerts: false });
    const torId = await createTor("ประกาศ TOR");
    assert.equal((await alertsFor(torId)).length, 0);
  });

  it("stays quiet below the company's own threshold", async () => {
    await setAlerts({ matchAlerts: true, matchThreshold: 95 });
    const torId = await createTor("ประกาศ TOR");
    const score = await scoreOf(torId);
    if (score >= 95) return; // Can't test the threshold with a project this good a fit.
    assert.equal((await alertsFor(torId)).length, 0);
  });
});
