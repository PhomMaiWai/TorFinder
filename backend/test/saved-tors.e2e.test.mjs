// End-to-end coverage for the saved-TOR endpoints (backend/src/saved-tors),
// run in CI by .github/workflows/auth.yml against a freshly booted backend +
// MongoDB.
//
// Same approach as accounts.e2e.test.mjs / tor.e2e.test.mjs: Node's built-in
// runner (`node --test`) and `fetch` only, hitting the running server over
// HTTP. Session tokens are minted directly (see makeToken) rather than
// obtained from /auth/login — SavedTorsController only ever reads the
// session's `sub` as an opaque user id and never looks the account up, so a
// minted token with a random (never-signed-up) id is a perfectly good,
// fully-isolated "user" for these tests. TOR records are never seeded, so
// every one referenced here is one this suite created.
//
// Observed behaviour, not aspiration:
//   - All three routes are SessionGuard'd (any signed-in account, admin or
//     org) -> 401 without a token, not the 403 the admin-only routes use.
//   - POST validates the TOR exists (404 for an unknown/malformed id) before
//     saving; DELETE only validates the id is *well-formed* — unsaving a
//     TOR that was never saved (or never existed) is still a no-op 204.
//   - Saving twice is idempotent (unique (userId, torId) index) and does not
//     duplicate the entry in the list.

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

// A well-formed ObjectId that no TOR record will ever have.
const MISSING_TOR_ID = "0123456789abcdef01234567";

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

let torCounter = 0;
function newTor(overrides = {}) {
  torCounter += 1;
  return {
    title: `จ้างพัฒนาระบบทดสอบบันทึกรายการ #${torCounter}`,
    agency: "สำนักการทดสอบ",
    budget: "฿1,000,000",
    deadline: "31 ธ.ค. 2569",
    daysLeft: 30,
    tags: ["Web Application", "QA"],
    stage: "ประกาศ TOR",
    summary: "รายการทดสอบที่สร้างโดยชุดทดสอบอัตโนมัติ",
    ...overrides,
  };
}

async function createTor(overrides = {}) {
  const res = await api("/tor", { method: "POST", body: newTor(overrides) });
  assert.equal(res.status, 201, `create failed: ${JSON.stringify(res.body)}`);
  return res.body;
}

/** A fresh org-role session with nothing saved yet, isolated from every other test. */
function newSession() {
  const id = randomUserId();
  return { id, token: makeToken("org", id, `ci+saved-${id}@example.com`) };
}

async function save(token, torId) {
  return api(`/saved-tors/${torId}`, { method: "POST", token });
}

async function unsave(token, torId) {
  return api(`/saved-tors/${torId}`, { method: "DELETE", token });
}

async function list(token) {
  return api("/saved-tors", { token });
}

describe("GET /api/saved-tors — list own saved TORs", () => {
  it("rejects a request with no token (401)", async () => {
    const res = await list(undefined);
    assert.equal(res.status, 401);
  });

  it("rejects a tampered token (401)", async () => {
    const { token } = newSession();
    const res = await list(`${token}tampered`);
    assert.equal(res.status, 401);
  });

  it("returns an empty array for a user who has saved nothing", async () => {
    const { token } = newSession();
    const res = await list(token);

    assert.equal(res.status, 200);
    assert.deepEqual(res.body, []);
  });

  it("returns saved ids, newest first", async () => {
    const { token } = newSession();
    const first = await createTor();
    const second = await createTor();

    assert.equal((await save(token, first.id)).status, 204);
    assert.equal((await save(token, second.id)).status, 204);

    const res = await list(token);

    assert.equal(res.status, 200);
    assert.deepEqual(res.body, [second.id, first.id]);
  });
});

describe("POST /api/saved-tors/:torId — save", () => {
  it("rejects a request with no token (401)", async () => {
    const tor = await createTor();
    const res = await save(undefined, tor.id);
    assert.equal(res.status, 401);
  });

  it("saves the TOR with no response body (204)", async () => {
    const { token } = newSession();
    const tor = await createTor();

    const res = await save(token, tor.id);

    assert.equal(res.status, 204);
    assert.equal(res.body, undefined);
  });

  it("shows up in the caller's own list afterward", async () => {
    const { token } = newSession();
    const tor = await createTor();

    await save(token, tor.id);
    const res = await list(token);

    assert.ok(res.body.includes(tor.id));
  });

  it("is idempotent — saving twice does not duplicate the entry", async () => {
    const { token } = newSession();
    const tor = await createTor();

    assert.equal((await save(token, tor.id)).status, 204);
    assert.equal((await save(token, tor.id)).status, 204);

    const res = await list(token);
    assert.equal(res.body.filter((id) => id === tor.id).length, 1);
  });

  it("returns 404 for a well-formed but unknown TOR id", async () => {
    const { token } = newSession();
    const res = await save(token, MISSING_TOR_ID);
    assert.equal(res.status, 404);
  });

  it("returns 404 for a malformed TOR id", async () => {
    const { token } = newSession();
    const res = await save(token, "not-an-id");
    assert.equal(res.status, 404);
  });

  it("never saves into another user's list", async () => {
    const owner = newSession();
    const other = newSession();
    const tor = await createTor();

    await save(owner.token, tor.id);
    const res = await list(other.token);

    assert.ok(!res.body.includes(tor.id));
  });
});

describe("DELETE /api/saved-tors/:torId — unsave", () => {
  it("rejects a request with no token (401)", async () => {
    const tor = await createTor();
    const res = await unsave(undefined, tor.id);
    assert.equal(res.status, 401);
  });

  it("removes a saved TOR with no response body (204)", async () => {
    const { token } = newSession();
    const tor = await createTor();
    await save(token, tor.id);

    const res = await unsave(token, tor.id);

    assert.equal(res.status, 204);
    assert.equal(res.body, undefined);
  });

  it("is gone from the caller's list afterward", async () => {
    const { token } = newSession();
    const tor = await createTor();
    await save(token, tor.id);

    await unsave(token, tor.id);
    const res = await list(token);

    assert.ok(!res.body.includes(tor.id));
  });

  it("unsaving something never saved is a no-op, not an error (204)", async () => {
    const { token } = newSession();
    const tor = await createTor();

    const res = await unsave(token, tor.id);

    assert.equal(res.status, 204);
  });

  it("unsaving an unknown-but-well-formed TOR id is also a no-op (204) — unlike save's 404", async () => {
    const { token } = newSession();
    const res = await unsave(token, MISSING_TOR_ID);
    assert.equal(res.status, 204);
  });

  it("still 404s on a malformed TOR id", async () => {
    const { token } = newSession();
    const res = await unsave(token, "not-an-id");
    assert.equal(res.status, 404);
  });

  it("never removes from another user's list", async () => {
    const owner = newSession();
    const other = newSession();
    const tor = await createTor();
    await save(owner.token, tor.id);

    await unsave(other.token, tor.id);
    const res = await list(owner.token);

    assert.ok(res.body.includes(tor.id), "the owner's save survives another user's unsave");
  });
});

describe("save/unsave round trip", () => {
  let token;

  before(() => {
    ({ token } = newSession());
  });

  it("save then unsave then save leaves exactly one entry", async () => {
    const tor = await createTor();

    await save(token, tor.id);
    await unsave(token, tor.id);
    await save(token, tor.id);

    const res = await list(token);
    assert.equal(res.body.filter((id) => id === tor.id).length, 1);
  });

  it("an admin-role token works the same way — the guard accepts any signed-in account", async () => {
    const adminSession = { id: randomUserId() };
    adminSession.token = makeToken("admin", adminSession.id, "admin-ci@ci.test");
    const tor = await createTor();

    assert.equal((await save(adminSession.token, tor.id)).status, 204);
    const res = await list(adminSession.token);
    assert.ok(res.body.includes(tor.id));
  });
});
