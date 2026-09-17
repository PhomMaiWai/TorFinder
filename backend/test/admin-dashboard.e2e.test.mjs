// End-to-end coverage for three read endpoints the admin dashboard depends on
// that no existing suite touches: the full user directory (backend/src/accounts,
// distinct from the org-only approval queue accounts.e2e.test.mjs already
// covers), the e-GP pipeline metrics card (backend/src/egp), and the audit log
// (backend/src/audit). Run in CI by .github/workflows/auth.yml against a
// freshly booted backend + MongoDB.
//
// Same approach as accounts.e2e.test.mjs: Node's built-in runner + fetch over
// HTTP, admin session tokens minted directly rather than obtained through the
// rate-limited login route.
//
// This suite shares the database with every other e2e file and
// `test:e2e` runs them with --test-concurrency=1 (sequential, not parallel),
// so assertions here are written to hold regardless of what earlier files in
// the run already wrote — never "the audit log is empty" or "the directory
// has exactly N accounts", only "the thing this test just did shows up
// correctly among whatever else is there".

import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { describe, it } from "node:test";

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:4000";
const API = `${BASE_URL}/api`;

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

const ADMIN_TOKEN = makeToken("admin", "admin-dashboard-admin@ci.test");
const ORG_TOKEN = makeToken("org", "admin-dashboard-org@ci.test");

/** Seeded by backend/src/database/seed-data.ts when SEED_DEMO_DATA=true (set in CI). */
const SEED_ADMIN_EMAIL = "admin@bma.go.th";

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
async function signupOrg() {
  orgSuffix += 1;
  const unique = `${Date.now()}-${orgSuffix}`;
  const org = {
    email: `ci+admindash-${unique}@example.com`,
    password: "Str0ngPass!",
    companyName: `CI Admin Dashboard Co ${unique}`,
    taxId: "0105563001236",
    contactName: "CI Runner",
    phone: "0812345678",
    address: "1 CI Street, Bangkok",
    specialty: "QA Automation",
    size: "11-50 คน",
  };
  const res = await api("/auth/signup", { method: "POST", body: org });
  assert.equal(res.status, 201, `signup failed: ${JSON.stringify(res.body)}`);
  return org;
}

async function findInAccountsList(email) {
  const res = await api("/accounts", { token: ADMIN_TOKEN });
  assert.equal(res.status, 200, `list failed: ${JSON.stringify(res.body)}`);
  return res.body.find((a) => a.email === email.toLowerCase());
}

describe("GET /api/accounts/directory — admin only, every account regardless of role", () => {
  it("forbids a request with no token (403)", async () => {
    const res = await api("/accounts/directory");
    assert.equal(res.status, 403);
  });

  it("forbids an organization token (403)", async () => {
    const res = await api("/accounts/directory", { token: ORG_TOKEN });
    assert.equal(res.status, 403);
  });

  it("includes the seeded admin account, unlike GET /api/accounts which is org-only", async () => {
    const res = await api("/accounts/directory", { token: ADMIN_TOKEN });
    assert.equal(res.status, 200);

    const admin = res.body.find((a) => a.email === SEED_ADMIN_EMAIL);
    assert.ok(admin, "the seeded admin account should appear in the full directory");
    assert.equal(admin.role, "admin");

    const orgOnlyList = await api("/accounts", { token: ADMIN_TOKEN });
    assert.equal(
      orgOnlyList.body.some((a) => a.email === SEED_ADMIN_EMAIL),
      false,
      "the org-only approval queue must never include an admin account",
    );
  });

  it("includes a freshly signed-up organization alongside admins", async () => {
    const org = await signupOrg();

    const res = await api("/accounts/directory", { token: ADMIN_TOKEN });
    assert.equal(res.status, 200);

    const entry = res.body.find((a) => a.email === org.email.toLowerCase());
    assert.ok(entry, "a freshly signed-up org should appear in the directory immediately, before any review");
    assert.equal(entry.role, "org");
    assert.equal(entry.status, "pending");
  });

  it("never leaks password material for any account, admin included", async () => {
    const res = await api("/accounts/directory", { token: ADMIN_TOKEN });
    assert.equal(res.status, 200);

    for (const account of res.body) {
      assert.equal(account.passwordHash, undefined, `${account.email} leaked passwordHash`);
      assert.equal(account.passwordSalt, undefined, `${account.email} leaked passwordSalt`);
    }
  });
});

describe("GET /api/egp/metrics — admin only, the pipeline card", () => {
  it("forbids a request with no token (403)", async () => {
    const res = await api("/egp/metrics");
    assert.equal(res.status, 403);
  });

  it("forbids an organization token (403)", async () => {
    const res = await api("/egp/metrics", { token: ORG_TOKEN });
    assert.equal(res.status, 403);
  });

  it("returns the pipeline card's shape for an admin", async () => {
    const res = await api("/egp/metrics", { token: ADMIN_TOKEN });
    assert.equal(res.status, 200);

    assert.ok(
      ["idle", "success", "partial", "failed"].includes(res.body.status),
      `unexpected status: ${res.body.status}`,
    );
    assert.ok(
      res.body.lastRunAt === null || typeof res.body.lastRunAt === "string",
      "lastRunAt should be null or an ISO string",
    );
    assert.equal(typeof res.body.importedToday, "number");
    assert.ok(Array.isArray(res.body.history));

    for (const entry of res.body.history) {
      assert.equal(typeof entry.startedAt, "string");
      assert.equal(typeof entry.finishedAt, "string");
      assert.ok(["success", "partial", "failed"].includes(entry.status));
      for (const key of ["fetched", "imported", "updated"]) {
        assert.equal(typeof entry[key], "number", `history entry.${key} should be a number`);
      }
      assert.ok(Array.isArray(entry.failedFeeds));
    }
  });

  // Only true while no e-GP sync has ever run against this database — real in
  // CI (EGP_POLL_ON_STARTUP=false and /egp/sync is never called there outside
  // the opt-in live test), so this pins the documented "idle" default exactly.
  it("reports idle with no history when e-GP has never synced", { skip: process.env.E2E_EGP_LIVE === "1" }, async () => {
    const res = await api("/egp/metrics", { token: ADMIN_TOKEN });
    assert.equal(res.status, 200);

    assert.equal(res.body.status, "idle");
    assert.equal(res.body.lastRunAt, null);
    assert.equal(res.body.importedToday, 0);
    assert.deepEqual(res.body.history, []);
  });
});

describe("GET /api/audit — admin only, the admin dashboard's activity log", () => {
  it("forbids a request with no token (403)", async () => {
    const res = await api("/audit");
    assert.equal(res.status, 403);
  });

  it("forbids an organization token (403)", async () => {
    const res = await api("/audit", { token: ORG_TOKEN });
    assert.equal(res.status, 403);
  });

  it("returns an array of dated entries for an admin", async () => {
    const res = await api("/audit", { token: ADMIN_TOKEN });
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body));

    for (const entry of res.body) {
      assert.equal(typeof entry.action, "string");
      assert.equal(typeof entry.detail, "string");
      assert.equal(typeof entry.actor, "string");
      assert.ok(["manual", "auto"].includes(entry.type));
      assert.ok(!Number.isNaN(new Date(entry.date).getTime()), `unparseable date: ${entry.date}`);
    }
  });

  it("records an admin's account review as a manual entry, attributed to that admin", async () => {
    const org = await signupOrg();
    const account = await findInAccountsList(org.email);
    assert.ok(account, "the freshly signed-up org should be visible to the admin listing");

    const reviewed = await api(`/accounts/${account.id}`, {
      method: "PATCH",
      token: ADMIN_TOKEN,
      body: { status: "approved" },
    });
    assert.equal(reviewed.status, 200, `approve failed: ${JSON.stringify(reviewed.body)}`);

    const audit = await api("/audit", { token: ADMIN_TOKEN });
    assert.equal(audit.status, 200);

    const entry = audit.body.find(
      (e) => e.type === "manual" && e.detail === org.companyName && e.action === "อนุมัติบัญชีบริษัท",
    );
    assert.ok(entry, `expected an audit entry for approving "${org.companyName}"`);
    assert.equal(entry.actor, "admin-dashboard-admin@ci.test", "the entry should be attributed to the acting admin");
  });

  it("puts a newer manual entry ahead of an older one", async () => {
    const first = await signupOrg();
    const firstAccount = await findInAccountsList(first.email);
    const firstReview = await api(`/accounts/${firstAccount.id}`, {
      method: "PATCH",
      token: ADMIN_TOKEN,
      body: { status: "rejected" },
    });
    assert.equal(firstReview.status, 200);

    const second = await signupOrg();
    const secondAccount = await findInAccountsList(second.email);
    const secondReview = await api(`/accounts/${secondAccount.id}`, {
      method: "PATCH",
      token: ADMIN_TOKEN,
      body: { status: "rejected" },
    });
    assert.equal(secondReview.status, 200);

    const audit = await api("/audit", { token: ADMIN_TOKEN });
    const firstIndex = audit.body.findIndex((e) => e.detail === first.companyName);
    const secondIndex = audit.body.findIndex((e) => e.detail === second.companyName);

    assert.ok(firstIndex !== -1 && secondIndex !== -1, "both entries should be present");
    assert.ok(secondIndex < firstIndex, "the entry created second should sort ahead of the one created first");
  });
});
