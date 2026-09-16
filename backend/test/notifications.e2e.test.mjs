// End-to-end coverage for the notification endpoints (backend/src/notifications),
// run in CI by .github/workflows/auth.yml against a freshly booted backend +
// MongoDB.
//
// Same approach as accounts.e2e.test.mjs / saved-tors.e2e.test.mjs: Node's
// built-in runner (`node --test`) and `fetch` only, hitting the running
// server over HTTP.
//
// Unlike saved-tors, NotificationsService never looks the account behind a
// session up — every route filters straight on the notifications collection
// by userId — so a guard/empty-list/unknown-id test can use a random,
// never-signed-up id exactly like saved-tors.e2e.test.mjs does. But there is
// no route for a client to create its own notification: create() is
// internal-only, and today the sole producer is AccountsService.review()
// (see accounts.service.ts). So any test that needs real *content* has to go
// through /auth/signup + an admin review — which is also exactly the flow
// these tests want to prove notifies the org correctly. Those are kept to a
// deliberate minimum (3 signups total) and reused across as many assertions
// as possible, since /auth/signup shares a rate-limit bucket with
// auth.e2e.test.mjs and accounts.e2e.test.mjs in the same CI run.
//
// Observed behaviour, not aspiration:
//   - All three routes are SessionGuard'd (any signed-in account) -> 401
//     without a token.
//   - PATCH .../:id/read is scoped to (id, userId): marking a well-formed id
//     that exists but belongs to someone else is indistinguishable from an
//     unknown id — both 404, and the other org's notification is untouched.
//   - PATCH .../:id/read is idempotent — marking an already-read notification
//     read again is still 204, not an error.
//   - PATCH .../read-all never errors, even with nothing to mark (204).

import assert from "node:assert/strict";
import { createHmac, randomBytes } from "node:crypto";
import { before, describe, it } from "node:test";

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:4000";
const API = `${BASE_URL}/api`;

// Mirrors backend/src/common/token.ts. Must match the SESSION_SECRET the
// server booted with (the workflow sets the same value for the tests).
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

/** A fresh, valid-looking ObjectId hex string — a distinct "user" per call. */
function randomUserId() {
  return randomBytes(12).toString("hex");
}

/** A signed-in session with no account (and no notifications) behind it. */
function randomSession() {
  const id = randomUserId();
  return { id, token: makeToken("org", id, `ci+ghost-${id}@example.com`) };
}

// A well-formed ObjectId that no notification will ever have.
const GHOST_ID = "0123456789abcdef01234567";

const ADMIN_TOKEN = makeToken("admin", GHOST_ID, "admin@ci.test");

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
    email: `ci+notifications-${unique}@example.com`,
    password: "Str0ngPass!",
    companyName: `CI Notifications Co ${unique}`,
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
async function findAccount(email) {
  const res = await api("/accounts", { token: ADMIN_TOKEN });
  assert.equal(res.status, 200, `list failed: ${JSON.stringify(res.body)}`);
  return res.body.find((a) => a.email === email.toLowerCase());
}

async function review(id, status) {
  const res = await api(`/accounts/${id}`, { method: "PATCH", token: ADMIN_TOKEN, body: { status } });
  assert.equal(res.status, 200, `review failed: ${JSON.stringify(res.body)}`);
  return res;
}

/** A real, signed-up org — the only way to produce actual notification content. */
async function provisionOrg() {
  const org = await signup();
  const account = await findAccount(org.email);
  assert.ok(account, "a freshly signed-up org appears in the admin listing");
  return { org, id: account.id, token: makeToken("org", account.id, org.email) };
}

async function list(token) {
  return api("/notifications", { token });
}

async function markRead(token, id) {
  return api(`/notifications/${id}/read`, { method: "PATCH", token });
}

async function markAllRead(token) {
  return api("/notifications/read-all", { method: "PATCH", token });
}

describe("session guard — all three routes", () => {
  it("GET /api/notifications rejects a request with no token (401)", async () => {
    assert.equal((await list(undefined)).status, 401);
  });

  it("GET /api/notifications rejects a tampered token (401)", async () => {
    const { token } = randomSession();
    assert.equal((await list(`${token}tampered`)).status, 401);
  });

  it("PATCH .../:id/read rejects a request with no token (401)", async () => {
    assert.equal((await markRead(undefined, GHOST_ID)).status, 401);
  });

  it("PATCH .../read-all rejects a request with no token (401)", async () => {
    assert.equal((await markAllRead(undefined)).status, 401);
  });
});

describe("GET /api/notifications — an account with nothing to show", () => {
  it("returns an empty array", async () => {
    const { token } = randomSession();
    const res = await list(token);

    assert.equal(res.status, 200);
    assert.deepEqual(res.body, []);
  });
});

describe("PATCH /api/notifications/:id/read — id validation", () => {
  it("returns 404 for a well-formed but unknown notification id", async () => {
    const { token } = randomSession();
    assert.equal((await markRead(token, GHOST_ID)).status, 404);
  });

  it("returns 404 for a malformed notification id", async () => {
    const { token } = randomSession();
    assert.equal((await markRead(token, "not-an-id")).status, 404);
  });
});

describe("PATCH /api/notifications/read-all — nothing to mark", () => {
  it("is a safe no-op (204)", async () => {
    const { token } = randomSession();
    assert.equal((await markAllRead(token)).status, 204);
  });
});

// One org, taken through its whole notification lifecycle in order: this is
// the only way to exercise real content (see file header), so every
// assertion that needs it is folded into this single ordered sequence
// instead of provisioning a fresh org per case.
describe("account review -> notification lifecycle", () => {
  let solo;

  before(async () => {
    solo = await provisionOrg();
  });

  it("starts with no notifications before any review", async () => {
    const res = await list(solo.token);
    assert.deepEqual(res.body, []);
  });

  it("approving the account creates one, correctly worded, unread notification", async () => {
    await review(solo.id, "approved");
    const res = await list(solo.token);

    assert.equal(res.status, 200);
    assert.equal(res.body.length, 1);
    const [n] = res.body;
    assert.match(n.id, /^[a-f0-9]{24}$/);
    assert.equal(n.type, "approval");
    assert.equal(n.read, false);
    assert.equal(n.title, "บัญชีของคุณได้รับการอนุมัติแล้ว");
    assert.ok(n.message.includes(solo.org.companyName));
    assert.equal(n.torId, undefined, "an approval notification is not about a specific TOR");
    assert.equal(n.userId, undefined, "the owning user id never leaves the service");
    assert.ok(n.createdAt);
  });

  it("rejecting the same account later adds a second, differently-worded notification, newest first", async () => {
    await review(solo.id, "rejected");
    const res = await list(solo.token);

    assert.equal(res.body.length, 2);
    assert.equal(res.body[0].title, "บัญชีของคุณไม่ผ่านการอนุมัติ");
    assert.equal(res.body[0].read, false);
    assert.equal(res.body[1].title, "บัญชีของคุณได้รับการอนุมัติแล้ว");
  });

  it("marking the newest notification read leaves the other one alone", async () => {
    const before2 = (await list(solo.token)).body;
    const res = await markRead(solo.token, before2[0].id);

    assert.equal(res.status, 204);
    assert.equal(res.body, undefined);

    const after = (await list(solo.token)).body;
    assert.equal(after[0].read, true);
    assert.equal(after[1].read, false);
  });

  it("marking it read again is still a no-op 204", async () => {
    const [newest] = (await list(solo.token)).body;
    const res = await markRead(solo.token, newest.id);
    assert.equal(res.status, 204);
  });

  it("read-all marks every remaining unread notification read", async () => {
    const res = await markAllRead(solo.token);

    assert.equal(res.status, 204);
    const after = (await list(solo.token)).body;
    assert.equal(after.length, 2);
    assert.ok(after.every((n) => n.read === true));
  });

  it("read-all again is still a no-op 204, and everything stays read", async () => {
    const res = await markAllRead(solo.token);

    assert.equal(res.status, 204);
    assert.ok((await list(solo.token)).body.every((n) => n.read === true));
  });
});

// One owner/other pair, reused across every cross-org isolation assertion.
describe("cross-org isolation", () => {
  let owner;
  let other;
  let notificationId;

  before(async () => {
    owner = await provisionOrg();
    other = await provisionOrg();
    await review(owner.id, "approved");
    [{ id: notificationId }] = (await list(owner.token)).body;
  });

  it("GET never returns another org's notifications", async () => {
    const res = await list(other.token);
    assert.deepEqual(res.body, []);
  });

  it("PATCH .../:id/read on another org's notification returns 404 and leaves it untouched", async () => {
    const res = await markRead(other.token, notificationId);
    assert.equal(res.status, 404);

    const stillUnread = await list(owner.token);
    assert.equal(stillUnread.body[0].read, false);
  });

  it("PATCH .../read-all never marks another org's notifications read", async () => {
    await markAllRead(other.token);

    const ownerList = await list(owner.token);
    assert.equal(
      ownerList.body[0].read,
      false,
      "owner's unread notification survives another org's read-all",
    );
  });
});
