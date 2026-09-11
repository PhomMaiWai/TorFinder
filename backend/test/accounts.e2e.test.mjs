// End-to-end coverage for the company-profile CRUD endpoints and the admin
// approval flow (backend/src/accounts), run in CI by .github/workflows/auth.yml
// against a freshly booted backend + MongoDB.
//
// Same approach as auth.e2e.test.mjs / tor.e2e.test.mjs: Node's built-in runner
// (`node --test`) and `fetch` only, hitting the running server over HTTP.
//
// Session tokens are minted directly (see makeToken) rather than obtained from
// /auth/login, to keep this suite off that route's rate limiter — except the
// one "approval gates login" test, which is the whole point of the flow.
//
// Observed behaviour, not aspiration:
//   - GET/PATCH /api/accounts/me are SessionGuard'd -> 401 without a token.
//   - GET/PATCH /api/accounts and PATCH /api/accounts/:id are AdminGuard'd
//     -> 403 without an admin token.
//   - companyName/taxId are locked once set: the service silently drops them
//     from a PATCH, but the DTO still validates them first, so a *malformed*
//     locked field is a 400 even though a valid one would have been ignored.
//   - PATCH /api/accounts/me only type-checks contactName/phone/address/etc.;
//     unlike signup it does not enforce a 10-digit phone.

import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { before, describe, it } from "node:test";

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:4000";
const API = `${BASE_URL}/api`;

// Mirrors backend/src/common/token.ts. Must match the SESSION_SECRET the server
// booted with (the workflow sets the same value for the tests).
const SESSION_SECRET = process.env.SESSION_SECRET ?? "dev-only-insecure-secret-change-me";

function makeToken(role, sub, email) {
  const payload = {
    sub,
    email: email ?? `${role}@ci.test`,
    name: `CI ${role}`,
    role,
    exp: Math.floor(Date.now() / 1000) + 3600,
  };
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", SESSION_SECRET).update(data).digest("base64url");
  return `${data}.${signature}`;
}

// A well-formed ObjectId that no account will ever have — used both as a
// "missing" id and as the subject of a token with no account behind it.
const GHOST_ID = "0123456789abcdef01234567";

const ADMIN_TOKEN = makeToken("admin", GHOST_ID, "admin@ci.test");
const ORG_TOKEN_NO_ACCOUNT = makeToken("org", GHOST_ID, "ghost@ci.test");

/** Seeded by backend/src/database/seed-data.ts when SEED_DEMO_DATA=true. */
const SEED = {
  admin: { email: "admin@bma.go.th" },
  approvedOrg: { email: "contact@arundigital.co.th" },
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
    email: `ci+accounts-${unique}@example.com`,
    password: "Str0ngPass!",
    companyName: `CI Accounts Co ${unique}`,
    taxId: "0105563001236",
    contactName: "CI Runner",
    phone: "0812345678",
    address: "1 CI Street, Bangkok",
    specialty: "QA Automation",
    size: "11-50 คน",
    ...overrides,
  };
}

/** Registers a fresh organization; it starts pending. Returns the sent payload. */
async function signup(overrides = {}) {
  const org = newOrg(overrides);
  const res = await api("/auth/signup", { method: "POST", body: org });
  assert.equal(res.status, 201, `signup failed: ${JSON.stringify(res.body)}`);
  return org;
}

/** The signup response carries no id, so admins find an account by its email. */
async function findAccount(email, { status } = {}) {
  const query = status ? `?status=${status}` : "";
  const res = await api(`/accounts${query}`, { token: ADMIN_TOKEN });
  assert.equal(res.status, 200, `list failed: ${JSON.stringify(res.body)}`);
  return res.body.find((a) => a.email === email.toLowerCase());
}

async function review(id, status) {
  return api(`/accounts/${id}`, { method: "PATCH", token: ADMIN_TOKEN, body: { status } });
}

// An approved organization this suite fully owns: minted org token, known
// company payload, safe to mutate. Created once, reused across the /me blocks.
let owned;

before(async () => {
  const org = await signup();
  const account = await findAccount(org.email);
  assert.ok(account, "a freshly signed-up org appears in the admin listing");
  assert.equal(account.status, "pending", "new orgs start pending");

  const approved = await review(account.id, "approved");
  assert.equal(approved.status, 200, `approve failed: ${JSON.stringify(approved.body)}`);
  assert.equal(approved.body.status, "approved");

  owned = { org, id: account.id, token: makeToken("org", account.id, org.email) };
});

describe("GET /api/accounts — list, admin only", () => {
  it("forbids a request with no token (403)", async () => {
    const res = await api("/accounts");
    assert.equal(res.status, 403);
  });

  it("forbids an organization token (403)", async () => {
    const res = await api("/accounts", { token: ORG_TOKEN_NO_ACCOUNT });
    assert.equal(res.status, 403);
  });

  it("returns an array of organization accounts for an admin", async () => {
    const res = await api("/accounts", { token: ADMIN_TOKEN });

    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body));
    assert.ok(res.body.length > 0);
  });

  it("lists only organizations, never admin accounts", async () => {
    const res = await api("/accounts", { token: ADMIN_TOKEN });

    assert.ok(!res.body.some((a) => a.email === SEED.admin.email));
  });

  it("never leaks password material", async () => {
    const res = await api("/accounts", { token: ADMIN_TOKEN });

    for (const account of res.body) {
      assert.equal(account.passwordHash, undefined);
      assert.equal(account.passwordSalt, undefined);
    }
  });

  it("filters to pending accounts with ?status=pending", async () => {
    const res = await api("/accounts?status=pending", { token: ADMIN_TOKEN });

    assert.equal(res.status, 200);
    assert.ok(res.body.every((a) => a.status === "pending"));
    assert.ok(res.body.some((a) => a.email === SEED.pendingOrg.email));
  });

  it("filters to approved accounts with ?status=approved", async () => {
    const res = await api("/accounts?status=approved", { token: ADMIN_TOKEN });

    assert.equal(res.status, 200);
    assert.ok(res.body.every((a) => a.status === "approved"));
    assert.ok(res.body.some((a) => a.email === SEED.approvedOrg.email));
  });

  it("rejects an unknown status (400)", async () => {
    const res = await api("/accounts?status=banana", { token: ADMIN_TOKEN });

    assert.equal(res.status, 400);
  });
});

describe("GET /api/accounts/me — own profile", () => {
  it("rejects a request with no token (401)", async () => {
    const res = await api("/accounts/me");
    assert.equal(res.status, 401);
  });

  it("rejects a tampered token (401)", async () => {
    const res = await api("/accounts/me", { token: `${owned.token}tampered` });
    assert.equal(res.status, 401);
  });

  it("returns the caller's own account and company profile", async () => {
    const res = await api("/accounts/me", { token: owned.token });

    assert.equal(res.status, 200);
    assert.equal(res.body.id, owned.id);
    assert.equal(res.body.email, owned.org.email);
    assert.equal(res.body.status, "approved");
    assert.equal(res.body.company.companyName, owned.org.companyName);
    assert.equal(res.body.company.taxId, owned.org.taxId);
  });

  it("never returns password material", async () => {
    const res = await api("/accounts/me", { token: owned.token });

    assert.equal(res.body.passwordHash, undefined);
    assert.equal(res.body.passwordSalt, undefined);
  });

  it("returns 404 when the token has no account behind it", async () => {
    const res = await api("/accounts/me", { token: ADMIN_TOKEN });

    assert.equal(res.status, 404);
  });
});

describe("PATCH /api/accounts/me — update own profile", () => {
  it("rejects a request with no token (401)", async () => {
    const res = await api("/accounts/me", { method: "PATCH", body: { contactName: "x" } });
    assert.equal(res.status, 401);
  });

  it("updates the editable fields and echoes the new values", async () => {
    const patch = {
      contactName: "แก้ไข ผู้ติดต่อ",
      phone: "0891112222",
      address: "99 ถนนใหม่ กรุงเทพฯ",
      specialty: "Cloud Platform",
      size: "51-200 คน",
      techStack: ["Cloud", "API", "Security"],
      pastExperience: "ผลงานทดสอบจากชุดทดสอบอัตโนมัติ",
    };
    const res = await api("/accounts/me", { method: "PATCH", token: owned.token, body: patch });

    assert.equal(res.status, 200);
    assert.equal(res.body.company.contactName, patch.contactName);
    assert.equal(res.body.company.phone, patch.phone);
    assert.equal(res.body.company.address, patch.address);
    assert.equal(res.body.company.specialty, patch.specialty);
    assert.equal(res.body.company.size, patch.size);
    assert.deepEqual(res.body.company.techStack, patch.techStack);
    assert.equal(res.body.company.pastExperience, patch.pastExperience);
  });

  it("persists the update to a following GET", async () => {
    await api("/accounts/me", {
      method: "PATCH",
      token: owned.token,
      body: { contactName: "ชื่อที่บันทึกไว้" },
    });
    const res = await api("/accounts/me", { token: owned.token });

    assert.equal(res.body.company.contactName, "ชื่อที่บันทึกไว้");
  });

  it("merges — a partial patch leaves other fields untouched", async () => {
    await api("/accounts/me", {
      method: "PATCH",
      token: owned.token,
      body: { specialty: "Data Platform" },
    });
    const res = await api("/accounts/me", { token: owned.token });

    assert.equal(res.body.company.specialty, "Data Platform");
    assert.equal(res.body.company.taxId, owned.org.taxId, "taxId was not part of the patch");
  });

  it("strips unknown fields (email included — it is account identity)", async () => {
    const res = await api("/accounts/me", {
      method: "PATCH",
      token: owned.token,
      body: { contactName: "ยังแก้ได้", email: "hacker@evil.test", nonsense: "ignored" },
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.email, owned.org.email);
    assert.equal(res.body.contactName, undefined);
    assert.equal(res.body.nonsense, undefined);
    assert.equal(res.body.company.contactName, "ยังแก้ได้");
  });

  it("silently ignores a locked companyName", async () => {
    const res = await api("/accounts/me", {
      method: "PATCH",
      token: owned.token,
      body: { companyName: "บริษัท ยึดครอง จำกัด" },
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.company.companyName, owned.org.companyName);
  });

  it("silently ignores a locked taxId", async () => {
    const res = await api("/accounts/me", {
      method: "PATCH",
      token: owned.token,
      body: { taxId: "9999999999999" },
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.company.taxId, owned.org.taxId);
  });

  it("still 400s on a malformed taxId, even though a valid one is ignored", async () => {
    const res = await api("/accounts/me", {
      method: "PATCH",
      token: owned.token,
      body: { taxId: "123" },
    });

    assert.equal(res.status, 400);
  });

  it("rejects an empty companyName (400)", async () => {
    const res = await api("/accounts/me", {
      method: "PATCH",
      token: owned.token,
      body: { companyName: "" },
    });

    assert.equal(res.status, 400);
  });

  it("rejects a techStack that is not all strings (400)", async () => {
    const res = await api("/accounts/me", {
      method: "PATCH",
      token: owned.token,
      body: { techStack: ["Cloud", 123] },
    });

    assert.equal(res.status, 400);
  });

  it("rejects a non-string contactName (400)", async () => {
    const res = await api("/accounts/me", {
      method: "PATCH",
      token: owned.token,
      body: { contactName: 123 },
    });

    assert.equal(res.status, 400);
  });

  it("accepts a short phone — /me does not enforce the 10-digit rule signup does", async () => {
    const res = await api("/accounts/me", {
      method: "PATCH",
      token: owned.token,
      body: { phone: "123" },
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.company.phone, "123");
  });

  it("treats an empty patch as a no-op read (200)", async () => {
    const res = await api("/accounts/me", { method: "PATCH", token: owned.token, body: {} });

    assert.equal(res.status, 200);
    assert.equal(res.body.id, owned.id);
  });

  it("returns 404 when the token has no organization account behind it", async () => {
    const res = await api("/accounts/me", {
      method: "PATCH",
      token: ADMIN_TOKEN,
      body: { contactName: "x" },
    });

    assert.equal(res.status, 404);
  });
});

describe("PATCH /api/accounts/:id — review, admin only", () => {
  it("forbids a request with no token (403)", async () => {
    const res = await api(`/accounts/${GHOST_ID}`, { method: "PATCH", body: { status: "approved" } });
    assert.equal(res.status, 403);
  });

  it("forbids an organization token (403)", async () => {
    const res = await api(`/accounts/${GHOST_ID}`, {
      method: "PATCH",
      token: ORG_TOKEN_NO_ACCOUNT,
      body: { status: "approved" },
    });
    assert.equal(res.status, 403);
  });

  it("approves a pending account and stamps reviewedAt", async () => {
    const org = await signup();
    const account = await findAccount(org.email, { status: "pending" });
    assert.ok(account, "the new org is in the pending list");

    const res = await review(account.id, "approved");

    assert.equal(res.status, 200);
    assert.equal(res.body.status, "approved");
    assert.ok(res.body.reviewedAt, "response carries reviewedAt");
  });

  it("rejects a pending account", async () => {
    const org = await signup();
    const account = await findAccount(org.email);

    const res = await review(account.id, "rejected");

    assert.equal(res.status, 200);
    assert.equal(res.body.status, "rejected");
  });

  it("lets an admin reverse an earlier decision", async () => {
    const org = await signup();
    const account = await findAccount(org.email);

    await review(account.id, "approved");
    const res = await review(account.id, "rejected");

    assert.equal(res.status, 200);
    assert.equal(res.body.status, "rejected");
  });

  it("moves the account between the status-filtered listings", async () => {
    const org = await signup();
    const account = await findAccount(org.email, { status: "pending" });

    await review(account.id, "approved");

    const pending = await api("/accounts?status=pending", { token: ADMIN_TOKEN });
    const approved = await api("/accounts?status=approved", { token: ADMIN_TOKEN });
    assert.ok(!pending.body.some((a) => a.id === account.id), "gone from pending");
    assert.ok(approved.body.some((a) => a.id === account.id), "now in approved");
  });

  it("rejects 'pending' as a review decision (400)", async () => {
    const res = await review(owned.id, "pending");
    assert.equal(res.status, 400);
  });

  it("rejects an unknown decision (400)", async () => {
    const res = await review(owned.id, "banana");
    assert.equal(res.status, 400);
  });

  it("rejects a missing decision (400)", async () => {
    const res = await api(`/accounts/${owned.id}`, {
      method: "PATCH",
      token: ADMIN_TOKEN,
      body: {},
    });
    assert.equal(res.status, 400);
  });

  it("returns 404 for a well-formed but unknown id", async () => {
    const res = await review(GHOST_ID, "approved");
    assert.equal(res.status, 404);
  });

  it("returns 404 for a malformed id", async () => {
    const res = await review("not-an-id", "approved");
    assert.equal(res.status, 404);
  });
});

describe("approval gates login — the flow end to end", () => {
  it("a pending org cannot sign in, but can once an admin approves it", async () => {
    const org = await signup();

    const beforeApproval = await api("/auth/login", {
      method: "POST",
      body: { email: org.email, password: org.password },
    });
    assert.equal(beforeApproval.status, 403, "pending account is refused at login");

    const account = await findAccount(org.email);
    const reviewed = await review(account.id, "approved");
    assert.equal(reviewed.body.status, "approved");

    const afterApproval = await api("/auth/login", {
      method: "POST",
      body: { email: org.email, password: org.password },
    });
    assert.equal(afterApproval.status, 200, "approved account can sign in");
    assert.equal(typeof afterApproval.body.token, "string");
    assert.equal(afterApproval.body.user.email, org.email);
  });
});
