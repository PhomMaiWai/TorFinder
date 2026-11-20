// ASVS 8.3.2: a change that affects what an account may do applies to its
// very next request. Revocation is read from the database on every request
// (no cache), so a revocation written by any backend process counts at once,
// and taking back a company's approval ends its sessions. Run against the
// freshly booted backend + MongoDB, like the other e2e suites.

import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { after, before, describe, it } from "node:test";

import { MongoClient } from "mongodb";

import { passwordFields } from "../dist/common/password.js";

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:4000";
const API = `${BASE_URL}/api`;
const mongo = new MongoClient(process.env.MONGODB_URI ?? "mongodb://localhost:27017/torfinder");
const users = () => mongo.db().collection("users");

const SESSION_SECRET = process.env.SESSION_SECRET ?? "dev-only-insecure-secret-change-me";
const PASSWORD = "Revoke-Check-5831";
// Its own client address, so these sign-ins don't share the per-IP login limit.
const CLIENT_IP = "198.51.100.212";

function mintAdminToken() {
  const now = Math.floor(Date.now() / 1000);
  const payload = { sub: "0123456789abcdef01234567", email: "admin@ci.test", name: "CI admin", role: "admin", iat: now, exp: now + 3600 };
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${data}.${createHmac("sha256", SESSION_SECRET).update(data).digest("base64url")}`;
}

async function api(path, { method = "GET", body, token } = {}) {
  const headers = { "x-forwarded-for": CLIENT_IP };
  if (body !== undefined) headers["content-type"] = "application/json";
  if (token) headers.authorization = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : undefined };
}

/** An approved company with a password, written straight into the database. */
async function approvedCompany() {
  const email = `ci+revoke-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`;
  const { insertedId } = await users().insertOne({
    email,
    name: "CI Revoke Co",
    role: "org",
    status: "approved",
    emailVerified: true,
    ...(await passwordFields(PASSWORD)),
    company: { companyName: "CI Revoke Co", taxId: "0105563001236", contactName: "CI", phone: "0812345678", address: "1 CI Street", specialty: "software", size: "1-10 คน" },
    createdAt: new Date(),
  });
  // Sessions are checked against the second they were issued, so start one after this second.
  await new Promise((resolve) => setTimeout(resolve, 1100));
  const login = await api("/auth/login", { method: "POST", body: { email, password: PASSWORD } });
  assert.equal(login.status, 200, JSON.stringify(login.body));
  return { id: insertedId, email, token: login.body.token };
}

before(() => mongo.connect());
after(() => mongo.close());

describe("authorization changes apply immediately (ASVS 8.3.2)", () => {
  const created = [];
  after(() => users().deleteMany({ _id: { $in: created } }));

  it("a revocation written to the database counts on the very next request (no cache)", async () => {
    const company = await approvedCompany();
    created.push(company.id);
    assert.equal((await api("/accounts/me", { token: company.token })).status, 200);

    // What another backend process's revoke() writes; this process has just served the token.
    await users().updateOne({ _id: company.id }, { $set: { sessionMinIssuedAt: new Date(Date.now() + 1000) } });
    assert.equal((await api("/accounts/me", { token: company.token })).status, 401);
  });

  it("taking back a company's approval ends its session at once", async () => {
    const company = await approvedCompany();
    created.push(company.id);
    assert.equal((await api("/accounts/me", { token: company.token })).status, 200);

    const review = await api(`/accounts/${company.id}`, { method: "PATCH", token: mintAdminToken(), body: { status: "rejected" } });
    assert.equal(review.status, 200, JSON.stringify(review.body));
    assert.equal((await api("/accounts/me", { token: company.token })).status, 401);
  });
});
