// Regression tests for the ASVS 5.0 Level 2 quick wins (docs/security/asvs-l2.md),
// run in CI against a freshly booted backend + MongoDB:
//  - 7.3.1: a session idle longer than SESSION_IDLE_MINUTES is refused;
//  - 14.3.2: API answers carry Cache-Control: no-store;
//  - 6.2.11: passwords built on context-specific words are refused;
//  - 2.2.3: a preferred budget minimum above the maximum is refused.
// Requests carry their own X-Forwarded-For so they don't share the suite's
// rate-limit bucket. Every account made here is removed after.

import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { after, before, describe, it } from "node:test";

import { MongoClient } from "mongodb";

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:4000";
const API = `${BASE_URL}/api`;
const SESSION_SECRET = process.env.SESSION_SECRET ?? "dev-only-insecure-secret-change-me";
const IDLE_SECONDS = Number(process.env.SESSION_IDLE_MINUTES ?? "30") * 60;
const mongo = new MongoClient(process.env.MONGODB_URI ?? "mongodb://localhost:27017/torfinder");
const db = () => mongo.db();
const IP = "192.0.2.60";
const stamp = Date.now();
const emails = [];

function token(fields) {
  const data = Buffer.from(JSON.stringify(fields)).toString("base64url");
  return `${data}.${createHmac("sha256", SESSION_SECRET).update(data).digest("base64url")}`;
}

async function api(path, { method = "GET", body, bearer } = {}) {
  const headers = { "x-forwarded-for": IP };
  if (body !== undefined) headers["content-type"] = "application/json";
  if (bearer) headers.authorization = `Bearer ${bearer}`;
  const res = await fetch(`${API}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  let parsed;
  try {
    parsed = text ? JSON.parse(text) : undefined;
  } catch {
    parsed = text;
  }
  return { status: res.status, headers: res.headers, body: parsed };
}

const signupBody = (email, password) => ({
  email,
  password,
  companyName: `บริษัท ทดสอบ L2 ${stamp}`,
  taxId: "0105563001236",
  contactName: "CI",
  phone: "0812345678",
  address: "กรุงเทพฯ",
  specialty: "software",
  size: "1-10",
});

before(() => mongo.connect());
after(async () => {
  await db().collection("users").deleteMany({ email: { $in: emails } });
  await mongo.close();
});

describe("ASVS 7.3.1 — inactivity timeout", () => {
  const now = () => Math.floor(Date.now() / 1000);
  const session = (act) =>
    token({ sub: "0123456789abcdef01234570", email: "idle@ci.test", name: "CI", role: "viewer", iat: now() - 3 * 3600, act, exp: now() + 3600 });

  it("accepts a session used within the idle window", async () => {
    assert.equal((await api("/notifications", { bearer: session(now() - 60) })).status, 200);
  });

  it("refuses a session idle for longer than the window, even before it expires", async () => {
    assert.equal((await api("/notifications", { bearer: session(now() - IDLE_SECONDS - 60) })).status, 401);
  });
});

describe("ASVS 14.3.2 — API answers are not cached", () => {
  it("sends Cache-Control: no-store", async () => {
    const res = await api("/tor?page=1&pageSize=1");
    assert.equal(res.headers.get("cache-control"), "no-store");
  });
});

describe("ASVS 6.2.11 — context-specific passwords", () => {
  it("refuses a password built on the site's name", async () => {
    const email = `l2-ctx-a-${stamp}@example.com`;
    emails.push(email);
    const res = await api("/auth/signup", { method: "POST", body: signupBody(email, "TorFinder2026!") });
    assert.equal(res.status, 400);
    assert.match(String(res.body?.message), /ชื่อระบบ/);
  });

  it("refuses a password built on the account's own email", async () => {
    const email = `wiriyaporn${stamp % 1000}@example.com`;
    emails.push(email);
    const res = await api("/auth/signup", { method: "POST", body: signupBody(email, `wiriyaporn${stamp % 1000}!!`) });
    assert.equal(res.status, 400);
  });

  it("still accepts a long passphrase that merely contains such a word", async () => {
    const email = `l2-ctx-b-${stamp}@example.com`;
    emails.push(email);
    const res = await api("/auth/signup", { method: "POST", body: signupBody(email, "my bangkok river walk at dawn") });
    assert.equal(res.status, 201, JSON.stringify(res.body));
  });
});

describe("ASVS 2.2.3 — preferred budget range", () => {
  it("refuses a minimum above the maximum, also against the stored value", async () => {
    const email = `l2-budget-${stamp}@example.com`;
    const password = "quiet-Harbor-lantern-58";
    emails.push(email);
    assert.equal((await api("/auth/signup", { method: "POST", body: signupBody(email, password) })).status, 201);
    await db().collection("users").updateOne({ email }, { $set: { status: "approved", emailVerified: true } });
    const login = await api("/auth/login", { method: "POST", body: { email, password } });
    assert.equal(login.status, 200);
    const patch = (body) => api("/accounts/me", { method: "PATCH", bearer: login.body.token, body });

    assert.equal((await patch({ preferredBudgetMin: 5_000_000, preferredBudgetMax: 1_000_000 })).status, 400);
    assert.equal((await patch({ preferredBudgetMax: 1_000_000 })).status, 200);
    assert.equal((await patch({ preferredBudgetMin: 2_000_000 })).status, 400, "checked against the stored maximum");
    assert.equal((await patch({ preferredBudgetMin: 500_000 })).status, 200);
  });
});
