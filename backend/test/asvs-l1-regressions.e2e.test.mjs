// Regression tests for the ASVS 5.0 Level 1 fixes (docs/security/asvs-l1.md),
// run in CI against a freshly booted backend + MongoDB:
//  - 6.3.1: failed logins are limited per email address, so changing IP does
//    not buy more guesses at one account.
// Requests carry their own X-Forwarded-For (trusted from loopback) so they get
// rate-limit buckets of their own instead of sharing the suite's. Every row
// made here is removed after.

import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import { MongoClient } from "mongodb";
import { formTimingHeaders } from "./helpers/form-token.mjs";

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:4000";
const API = `${BASE_URL}/api`;
const LOGIN_FAILURE_LIMIT = Number(process.env.LOGIN_FAILURE_LIMIT ?? "10");
const mongo = new MongoClient(process.env.MONGODB_URI ?? "mongodb://localhost:27017/torfinder");
const db = () => mongo.db();

async function api(path, { method = "GET", body, token, ip } = {}) {
  const headers = {};
  if (body !== undefined) headers["content-type"] = "application/json";
  if (token) headers.authorization = `Bearer ${token}`;
  Object.assign(headers, formTimingHeaders(path, method));
  if (ip) headers["x-forwarded-for"] = ip;
  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : undefined };
}

before(() => mongo.connect());
after(async () => {
  await mongo.close();
});

describe("ASVS 6.2.2 / 6.2.3 — POST /api/auth/password", () => {
  const email = `change-password-${Date.now()}@example.com`;
  const firstPassword = "first-Passphrase-42";
  const nextPassword = "second-Passphrase-42";
  const ip = "192.0.2.30";
  const loginAs = (password) => api("/auth/login", { method: "POST", ip, body: { email, password } });

  after(() => db().collection("users").deleteMany({ email }));

  it("needs the current password, refuses a common one, then ends every session", async () => {
    const signup = await api("/auth/signup", {
      method: "POST",
      ip,
      body: {
        email,
        password: firstPassword,
        companyName: "บริษัท ทดสอบเปลี่ยนรหัสผ่าน จำกัด",
        taxId: "0105563001236",
        contactName: "CI",
        phone: "0812345678",
        address: "กรุงเทพฯ",
        specialty: "software",
        size: "small",
      },
    });
    assert.equal(signup.status, 201, `signup failed: ${JSON.stringify(signup.body)}`);
    await db().collection("users").updateOne({ email }, { $set: { status: "approved", emailVerified: true } });

    const first = await loginAs(firstPassword);
    assert.equal(first.status, 200);
    const token = first.body.token;
    const change = (body) => api("/auth/password", { method: "POST", ip, token, body });

    assert.equal((await api("/auth/password", { method: "POST", ip, body: {} })).status, 401, "needs a session");
    assert.equal(
      (await change({ currentPassword: "not-my-password", newPassword: nextPassword })).status,
      400,
      "needs the right current password",
    );
    assert.equal(
      (await change({ currentPassword: firstPassword, newPassword: "password1" })).status,
      400,
      "refuses a common password",
    );
    assert.equal((await change({ currentPassword: firstPassword, newPassword: nextPassword })).status, 200);

    assert.equal((await api("/accounts/me", { token })).status, 401, "the old session is revoked");
    // Revocation is per second (token iat): sign in again in a later second, as a person would.
    await new Promise((resolve) => setTimeout(resolve, 1_100));
    assert.equal((await loginAs(firstPassword)).status, 401, "the old password no longer works");
    const next = await loginAs(nextPassword);
    assert.equal(next.status, 200);
    assert.equal((await api("/accounts/me", { token: next.body.token })).status, 200);
  });
});

describe("ASVS 6.3.1 — failed logins are limited per email address", () => {
  const login = (email, ip) =>
    api("/auth/login", { method: "POST", ip, body: { email, password: "definitely-wrong-password" } });

  it("locks an address after the limit, even from a new IP, and leaves other addresses alone", async () => {
    const target = `lockout-${Date.now()}@example.com`;
    for (let i = 0; i < LOGIN_FAILURE_LIMIT; i += 1) {
      assert.equal((await login(target, "198.51.100.20")).status, 401, `attempt ${i + 1}`);
    }

    assert.equal((await login(target, "198.51.100.20")).status, 429);
    assert.equal((await login(target, "203.0.113.99")).status, 429, "a fresh IP buys no more guesses");
    assert.equal((await login(`other-${Date.now()}@example.com`, "198.51.100.20")).status, 401);
  });
});
