// End-to-end coverage for this app's own /api/saved-searches route handlers —
// the cookie-session -> Authorization:Bearer forwarding, and the response
// passthrough (including the backend's 204-on-delete special case).
//
// The backend's actual saved-searches logic (validation, the 50-item cap,
// per-account name uniqueness, cross-account isolation) is already covered on
// its own in backend/test/saved-searches.e2e.test.mjs — this file only needs
// to prove the frontend's proxy wiring forwards and passes through correctly.
//
// SavedSearches (frontend/src/components/saved/saved-searches.tsx) fetches
// and renders client-side, so there's nothing for a plain SSR-HTML fetch to
// assert on for the list/apply/delete UI itself (see owner-page.e2e.test.mjs
// for that pattern, used elsewhere). This file instead calls the frontend's
// own route handlers directly, the same way a signed-in browser's fetch()
// would, and checks what comes back.
//
// Node's built-in runner + fetch against a running `next build && next start`.
// Session cookie minted the same way owner-page.e2e.test.mjs does.
//
// Requires, all pointed at the same database:
//   - E2E_BACKEND_URL   a running backend (default http://localhost:4000)
//   - E2E_FRONTEND_URL  a running `next start` of this app (default http://localhost:3000)
//   - MONGODB_URI       the database both of the above are using
//   - SESSION_SECRET    must match what both processes booted with

import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { after, before, describe, it } from "node:test";

import { MongoClient, ObjectId } from "mongodb";

const FRONTEND_URL = process.env.E2E_FRONTEND_URL ?? "http://localhost:3000";
const MONGODB_URI =
  process.env.MONGODB_URI ?? "mongodb://torr:torr@localhost:27017/torr?authSource=admin";
const SESSION_SECRET = process.env.SESSION_SECRET ?? "dev-only-insecure-secret-change-me";
const mongo = new MongoClient(MONGODB_URI);

function makeToken(role, sub) {
  const iat = Math.floor(Date.now() / 1000);
  const payload = { sub, email: `${sub}@ci.test`, name: `CI ${role}`, role, iat, exp: iat + 3600 };
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", SESSION_SECRET).update(data).digest("base64url");
  return `${data}.${signature}`;
}

const ALICE = new ObjectId();
const BOB = new ObjectId();
const ALICE_TOKEN = makeToken("org", ALICE.toString());
const BOB_TOKEN = makeToken("org", BOB.toString());

/** Calls this app's own /api/saved-searches* route handlers via a session cookie, like a browser would. */
async function api(path, { method = "GET", body, token } = {}) {
  const headers = {};
  if (token) headers.cookie = `torr_session=${token}`;
  if (body !== undefined) headers["content-type"] = "application/json";
  const res = await fetch(`${FRONTEND_URL}/api${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : undefined };
}

const inserted = [];

before(async () => {
  await mongo.connect();
});

after(async () => {
  await mongo.db().collection("savedSearches").deleteMany({ _id: { $in: inserted } });
  await mongo.close();
});

describe("GET/POST /api/saved-searches — session cookie forwarding", () => {
  it("answers 401 with no session, for both GET and POST", async () => {
    assert.equal((await api("/saved-searches")).status, 401);
    assert.equal(
      (await api("/saved-searches", { method: "POST", body: { name: "x", filters: {} } })).status,
      401,
    );
  });

  it("creates a saved search for the signed-in account and echoes it back", async () => {
    const res = await api("/saved-searches", {
      method: "POST",
      token: ALICE_TOKEN,
      body: { name: "  Frontend fixture  ", filters: { query: "ซอฟต์แวร์", sort: "deadline" } },
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.name, "Frontend fixture");
    assert.deepEqual(res.body.filters, { query: "ซอฟต์แวร์", sort: "deadline" });
    inserted.push(new ObjectId(res.body.id));
  });

  it("lists only the signed-in account's own saved searches", async () => {
    const mine = await api("/saved-searches", { token: ALICE_TOKEN });
    assert.equal(mine.status, 200);
    assert.ok(mine.body.some((s) => s.name === "Frontend fixture"));

    const bobs = await api("/saved-searches", { token: BOB_TOKEN });
    assert.equal(bobs.status, 200);
    assert.ok(!bobs.body.some((s) => s.name === "Frontend fixture"));
  });

  it("passes a backend validation failure straight through as 400", async () => {
    const res = await api("/saved-searches", {
      method: "POST",
      token: ALICE_TOKEN,
      body: { name: "", filters: {} },
    });
    assert.equal(res.status, 400);
  });
});

describe("DELETE /api/saved-searches/:id — session cookie forwarding", () => {
  let id;

  before(async () => {
    const res = await api("/saved-searches", {
      method: "POST",
      token: ALICE_TOKEN,
      body: { name: "Frontend delete fixture", filters: {} },
    });
    assert.equal(res.status, 201);
    id = res.body.id;
    inserted.push(new ObjectId(id));
  });

  it("answers 401 with no session", async () => {
    assert.equal((await api(`/saved-searches/${id}`, { method: "DELETE" })).status, 401);
  });

  it("refuses to delete another account's saved search", async () => {
    const res = await api(`/saved-searches/${id}`, { method: "DELETE", token: BOB_TOKEN });
    assert.equal(res.status, 404);
    const stillThere = await api("/saved-searches", { token: ALICE_TOKEN });
    assert.ok(stillThere.body.some((s) => s.id === id));
  });

  it("deletes with a 204 and no body, then 404 on a second delete", async () => {
    const first = await api(`/saved-searches/${id}`, { method: "DELETE", token: ALICE_TOKEN });
    assert.equal(first.status, 204);
    assert.equal(first.body, undefined);

    const second = await api(`/saved-searches/${id}`, { method: "DELETE", token: ALICE_TOKEN });
    assert.equal(second.status, 404);
  });
});
