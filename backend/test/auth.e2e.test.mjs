// End-to-end coverage for the signup/login flow, run in CI by
// .github/workflows/auth.yml against a freshly booted backend + MongoDB.
//
// No test framework: Node's built-in runner (`node --test`) and `fetch` only.
// The backend is expected to be listening at E2E_BASE_URL with SEED_DEMO_DATA
// on, so the seeded demo accounts below exist.

import assert from "node:assert/strict";
import { before, describe, it } from "node:test";

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:4000";
const API = `${BASE_URL}/api`;

// Kept comfortably above the number of login/signup calls the functional tests
// make, so only the dedicated brute-force test below trips the limiter. Must
// match AUTH_THROTTLE_LIMIT in the workflow.
const THROTTLE_LIMIT = Number(process.env.AUTH_THROTTLE_LIMIT ?? "30");

/** Seeded by backend/src/database/seed-data.ts when SEED_DEMO_DATA=true. */
const SEED = {
  admin: { email: "admin@bma.go.th", password: "Admin1234!" },
  approvedOrg: { email: "contact@arundigital.co.th", password: "Org12345!" },
  pendingOrg: { email: "contact@techworks.co.th", password: "Tech12345!" },
};

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

let orgSuffix = 0;
function newOrg(overrides = {}) {
  orgSuffix += 1;
  const unique = `${Date.now()}-${orgSuffix}`;
  return {
    email: `ci+${unique}@example.com`,
    password: "Str0ngPass!",
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

  it("rejects a duplicate email with 409", async () => {
    const res = await api("/auth/signup", {
      method: "POST",
      body: newOrg({ email: SEED.approvedOrg.email }),
    });

    assert.equal(res.status, 409);
  });

  it("rejects a malformed email", async () => {
    const res = await api("/auth/signup", {
      method: "POST",
      body: newOrg({ email: "not-an-email" }),
    });

    assert.equal(res.status, 400);
  });

  it("rejects a password shorter than 8 characters", async () => {
    const res = await api("/auth/signup", {
      method: "POST",
      body: newOrg({ password: "short1" }),
    });

    assert.equal(res.status, 400);
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

  it("forbids a request with no token (403)", async () => {
    const res = await api("/accounts");

    assert.equal(res.status, 403);
  });

  it("forbids a tampered token (403)", async () => {
    const res = await api("/accounts", { token: `${orgToken}tampered` });

    assert.equal(res.status, 403);
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
