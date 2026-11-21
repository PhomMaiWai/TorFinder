// End-to-end coverage for the signup/login flow, run in CI by
// .github/workflows/auth.yml against a freshly booted backend + MongoDB.
//
// No test framework: Node's built-in runner (`node --test`) and `fetch` only.
// The backend is expected to be listening at E2E_BASE_URL with SEED_DEMO_DATA
// on, so the seeded demo accounts below exist.

import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import { formTimingHeaders } from "./helpers/form-token.mjs";

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:4000";
const API = `${BASE_URL}/api`;

// Kept comfortably above the number of login/signup calls the functional tests
// make, so only the dedicated brute-force test below trips the limiter. Must
// match AUTH_THROTTLE_LIMIT in the workflow.
const THROTTLE_LIMIT = Number(process.env.AUTH_THROTTLE_LIMIT ?? "30");

/** Seeded by backend/src/database/seed-data.ts when SEED_DEMO_DATA=true. */
const SEED = {
  admin: { email: "admin@bma.go.th", password: "Admin-Demo-2026!" },
  owner: { email: "owner@bma.go.th", password: "Owner-Demo-2026!" },
  auditor: { email: "auditor@bma.go.th", password: "Auditor-Demo-2026!" },
  approvedOrg: { email: "contact@arundigital.co.th", password: "Arun-Demo-2026!" },
  pendingOrg: { email: "contact@techworks.co.th", password: "Tech-Demo-2026!" },
};

async function api(path, { method = "GET", body, token } = {}) {
  const headers = {};
  if (body !== undefined) headers["content-type"] = "application/json";
  if (token) headers.authorization = `Bearer ${token}`;
  Object.assign(headers, formTimingHeaders(path, method));

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

let orgSuffix = 0;
function newOrg(overrides = {}) {
  orgSuffix += 1;
  const unique = `${Date.now()}-${orgSuffix}`;
  return {
    email: `ci+${unique}@example.com`,
    password: "Str0ngPass!2026",
    companyName: `CI Test Co ${unique}`,
    taxId: "0105563001236",
    contactName: "CI Runner",
    phone: "0812345678",
    address: "1 CI Street, Bangkok",
    specialty: "QA Automation",
    size: "1-10",
    ...overrides,
  };
}

async function login(credentials) {
  return api("/auth/login", { method: "POST", body: credentials });
}

describe("POST /api/auth/signup", () => {
  it("registers a new organization and leaves it pending", async () => {
    const org = newOrg();
    const res = await api("/auth/signup", { method: "POST", body: org });

    assert.equal(res.status, 201);
    assert.equal(res.body.status, "pending");
    assert.equal(res.body.companyName, org.companyName);
  });

  // ASVS 6.3.8: a registered address gets the same answer as a new one, so the
  // form can't be used to find out who has an account. Nothing is created.
  it("answers a duplicate email exactly like a new signup, without creating an account", async () => {
    const org = newOrg({ email: SEED.approvedOrg.email });
    const res = await api("/auth/signup", { method: "POST", body: org });

    assert.equal(res.status, 201);
    assert.deepEqual(res.body, { status: "pending", companyName: org.companyName });

    // The existing account is untouched: its own password still signs in.
    const existing = await login(SEED.approvedOrg);
    assert.equal(existing.status, 200);
    const signupPassword = await login({ email: SEED.approvedOrg.email, password: org.password });
    assert.equal(signupPassword.status, 401);
  });

  it("rejects a malformed email", async () => {
    const res = await api("/auth/signup", {
      method: "POST",
      body: newOrg({ email: "not-an-email" }),
    });

    assert.equal(res.status, 400);
  });

  it("rejects a password shorter than 12 characters (ASVS 4.0.3 2.1.1, docs/SECURITY.md G2)", async () => {
    // 11 characters, not a common password: only the length rule can refuse it.
    const res = await api("/auth/signup", {
      method: "POST",
      body: newOrg({ password: "Zq7!mPw2#Lk" }),
    });

    assert.equal(res.status, 400);
    assert.match(JSON.stringify(res.body), /12/);
  });

  it("rejects a tax id that is not 13 digits", async () => {
    const res = await api("/auth/signup", {
      method: "POST",
      body: newOrg({ taxId: "12345" }),
    });

    assert.equal(res.status, 400);
  });

  it("rejects a phone number that is not 10 digits", async () => {
    const res = await api("/auth/signup", {
      method: "POST",
      body: newOrg({ phone: "12345" }),
    });

    assert.equal(res.status, 400);
  });

  it("ignores client-supplied role/status and stays pending", async () => {
    const org = newOrg();
    const res = await api("/auth/signup", {
      method: "POST",
      body: { ...org, role: "admin", status: "approved" },
    });

    assert.equal(res.status, 201);
    assert.equal(res.body.status, "pending");

    // And the account genuinely cannot sign in yet.
    const attempt = await login({ email: org.email, password: org.password });
    assert.equal(attempt.status, 403);
  });
});

describe("POST /api/auth/login", () => {
  it("signs in a seeded approved organization and returns a token", async () => {
    const res = await login(SEED.approvedOrg);

    assert.equal(res.status, 200);
    assert.equal(typeof res.body.token, "string");
    assert.ok(res.body.token.length > 0);
    assert.equal(res.body.user.email, SEED.approvedOrg.email);
    assert.equal(res.body.user.role, "org");
  });

  it("signs in the seeded admin with an admin role", async () => {
    const res = await login(SEED.admin);

    assert.equal(res.status, 200);
    assert.equal(res.body.user.role, "admin");
  });

  for (const role of ["owner", "auditor"]) {
    it(`signs in the seeded ${role}, and the session token carries that role`, async () => {
      const res = await login(SEED[role]);

      assert.equal(res.status, 200);
      assert.equal(res.body.user.role, role);

      const payload = JSON.parse(Buffer.from(res.body.token.split(".")[0], "base64url").toString());
      assert.equal(payload.role, role);
    });
  }

  it("rejects a wrong password with 401", async () => {
    const res = await login({ email: SEED.approvedOrg.email, password: "wrong-password" });

    assert.equal(res.status, 401);
  });

  it("rejects an unknown email with 401", async () => {
    const res = await login({ email: "nobody@example.com", password: "whatever12" });

    assert.equal(res.status, 401);
  });

  it("refuses a pending account with 403", async () => {
    const res = await login(SEED.pendingOrg);

    assert.equal(res.status, 403);
  });

  it("rejects a request with no password (400)", async () => {
    const res = await api("/auth/login", {
      method: "POST",
      body: { email: SEED.approvedOrg.email },
    });

    assert.equal(res.status, 400);
  });

  it("rejects a request with no email (400)", async () => {
    const res = await api("/auth/login", {
      method: "POST",
      body: { password: "whatever12" },
    });

    assert.equal(res.status, 400);
  });
});

describe("session token from login", () => {
  let adminToken;
  let orgToken;

  before(async () => {
    adminToken = (await login(SEED.admin)).body.token;
    orgToken = (await login(SEED.approvedOrg)).body.token;
    assert.ok(adminToken, "admin login should return a token");
    assert.ok(orgToken, "org login should return a token");
  });

  it("lets an admin token reach an admin-only route", async () => {
    const res = await api("/accounts", { token: adminToken });

    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body));
  });

  it("forbids an organization token on an admin-only route (403)", async () => {
    const res = await api("/accounts", { token: orgToken });

    assert.equal(res.status, 403);
  });

  it("forbids a request with no token (401)", async () => {
    const res = await api("/accounts");

    assert.equal(res.status, 401);
  });

  it("forbids a tampered token (401)", async () => {
    const res = await api("/accounts", { token: `${orgToken}tampered` });

    assert.equal(res.status, 401);
  });
});

describe("brute-force protection", () => {
  it("starts returning 429 once the per-window login limit is exceeded", async () => {
    const attempts = THROTTLE_LIMIT + 15;
    const statuses = [];
    for (let i = 0; i < attempts; i += 1) {
      const res = await login({ email: "brute-force@example.com", password: "nope-nope" });
      statuses.push(res.status);
    }

    assert.ok(
      statuses.includes(429),
      `expected at least one 429 within ${attempts} rapid attempts, saw ${JSON.stringify(
        [...new Set(statuses)],
      )}`,
    );
  });
});
