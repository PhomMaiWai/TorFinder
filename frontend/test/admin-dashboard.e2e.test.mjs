// End-to-end coverage proving the admin dashboard's three data pages
// (backend/src/{egp,audit,accounts} via src/lib/admin-api.ts) actually render
// what the backend returns — real numbers and names when there's data, and
// each page's own empty-state copy when there isn't — rather than only being
// verified at the API layer (see backend/test/admin-dashboard.e2e.test.mjs,
// which covers the endpoints themselves).
//
// Node's built-in runner + fetch, same as the backend suites, but against a
// *running production build* of this app (`next build && next start`), since
// the pages are server components — there is no rendered HTML to assert on
// from source alone. The session cookie is minted with the exact scheme
// src/lib/auth.ts implements (HMAC-SHA256, base64url, "<payload>.<sig>") —
// identical to backend/src/common/token.ts — so one token works both as the
// frontend's `torr_session` cookie and, forwarded verbatim by
// src/lib/session-headers.ts, as the backend's bearer token. NEXT_LOCALE=en
// is set alongside it purely so assertions can pin exact English copy instead
// of Thai.
//
// Requires, all pointed at the same database:
//   - E2E_BACKEND_URL   a running backend (default http://localhost:4000)
//   - E2E_FRONTEND_URL  a running `next start` of this app (default http://localhost:3000)
//   - MONGODB_URI       the database both of the above are using
//   - SESSION_SECRET    must match what both processes booted with
//
// Unlike the backend suites, this one does NOT share a database with anything
// else: the first block asserts each page's actual zero-rows empty state,
// which only holds in a database nothing else has touched. Point it at a
// disposable Mongo + a backend started with SEED_DEMO_DATA=false, never at
// the shared CI database the backend/test:e2e run uses.

import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { after, before, describe, it } from "node:test";

import { MongoClient } from "mongodb";

const FRONTEND_URL = process.env.E2E_FRONTEND_URL ?? "http://localhost:3000";
const BACKEND_URL = process.env.E2E_BACKEND_URL ?? "http://localhost:4000";
const BACKEND_API = `${BACKEND_URL}/api`;
const MONGODB_URI = process.env.MONGODB_URI ?? "mongodb://torr:torr@localhost:27017/torr?authSource=admin";
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

const ADMIN_TOKEN = makeToken("admin", "dashboard-admin@ci.test");

async function backendApi(path, { method = "GET", body, token = ADMIN_TOKEN } = {}) {
  const headers = { authorization: `Bearer ${token}` };
  if (body !== undefined) headers["content-type"] = "application/json";

  const res = await fetch(`${BACKEND_API}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : undefined };
}

/** Renders a page as the seeded admin would see it, in English for stable assertions. */
async function renderPage(path) {
  const res = await fetch(`${FRONTEND_URL}${path}`, {
    headers: { cookie: `torr_session=${ADMIN_TOKEN}; NEXT_LOCALE=en` },
    redirect: "manual",
  });
  assert.equal(res.status, 200, `${path} should render for an admin session, got ${res.status}`);
  return res.text();
}

/**
 * The value inside a metric card, out of the actual server-rendered HTML —
 * not the RSC flight payload the same response also carries, which encodes
 * the tree as JSON rather than as adjacent tags and so never matches this
 * pattern. See AdminOverviewPage's metricCards.map: label, then a value <p>.
 */
function metricValue(html, label) {
  const match = new RegExp(`${label}</p><p[^>]*>([^<]*)</p>`).exec(html);
  return match?.[1] ?? null;
}

let orgSuffix = 0;
async function signupOrg(overrides = {}) {
  orgSuffix += 1;
  const unique = `${Date.now()}-${orgSuffix}`;
  const org = {
    email: `ci+dashboard-${unique}@example.com`,
    password: "Str0ngPass!",
    companyName: `CI Dashboard Rendering Co ${unique}`,
    taxId: "0105563001236",
    contactName: "CI Runner",
    phone: "0812345678",
    address: "1 CI Street, Bangkok",
    specialty: "QA Automation",
    size: "11-50 คน",
    ...overrides,
  };
  const res = await fetch(`${BACKEND_API}/auth/signup`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(org),
  });
  assert.equal(res.status, 201, `signup failed for ${org.email}`);
  return org;
}

async function findInDirectory(email) {
  const { status, body } = await backendApi("/accounts/directory");
  assert.equal(status, 200);
  const account = body.find((a) => a.email === email.toLowerCase());
  assert.ok(account, `expected ${email} in the directory`);
  return account;
}

let mongo;
before(async () => {
  mongo = new MongoClient(MONGODB_URI);
  await mongo.connect();
});

after(async () => {
  await mongo?.close();
});

describe("admin dashboard — empty state (requires a fresh, untouched database)", () => {
  before(async () => {
    const [directory, audit, metrics] = await Promise.all([
      backendApi("/accounts/directory"),
      backendApi("/audit"),
      backendApi("/egp/metrics"),
    ]);
    const clean =
      directory.body?.length === 0 && audit.body?.length === 0 && metrics.body?.status === "idle";
    assert.ok(
      clean,
      "this suite needs a database nothing has touched yet — point E2E_BACKEND_URL/MONGODB_URI at a " +
        "fresh instance (SEED_DEMO_DATA=false, no prior signups), not the shared backend/test:e2e database",
    );
  });

  it("/admin shows the never-synced, nothing-pending, no-users state", async () => {
    const html = await renderPage("/admin");

    assert.ok(html.includes(">Never run<"), "pipeline status should read 'Never run'");
    assert.ok(html.includes(">No import yet<"));
    assert.equal(metricValue(html, "New TORs today"), "0");
    assert.equal(metricValue(html, "Accounts awaiting review"), "0");
    assert.ok(html.includes(">queue is clear<"));
    assert.equal(metricValue(html, "Users"), "0");
    assert.ok(html.includes(">none suspended<"));
    assert.ok(html.includes("No imports recorded yet"), "the sync-history panel should show its empty state");
  });

  it("/admin/audit shows its empty state", async () => {
    const html = await renderPage("/admin/audit");
    assert.ok(html.includes("Nothing has happened yet"));
  });

  it("/admin/users shows its empty state", async () => {
    const html = await renderPage("/admin/users");
    assert.ok(html.includes("No matching users found"));
  });
});

describe("admin dashboard — renders real data", () => {
  let stillPending;
  let approvedThenSuspended;

  before(async () => {
    // Two real accounts via the real signup endpoint — not fixtures — one
    // left exactly as submitted, one taken through approval and suspension so
    // every status/role badge the pages can show has something real behind it.
    stillPending = await signupOrg();
    approvedThenSuspended = await signupOrg();

    const account = await findInDirectory(approvedThenSuspended.email);
    const approved = await backendApi(`/accounts/${account.id}`, {
      method: "PATCH",
      body: { status: "approved" },
    });
    assert.equal(approved.status, 200);

    const suspended = await backendApi(`/accounts/${account.id}/suspend`, { method: "PATCH" });
    assert.equal(suspended.status, 200);

    // A completed e-GP sync, inserted the same way EgpService.recordRun()
    // would have written it — the live portal is deliberately never called
    // from a test, so this is how "the pipeline has real history" gets
    // exercised honestly instead of skipped.
    await mongo.db().collection("syncRuns").insertOne({
      startedAt: new Date(),
      finishedAt: new Date(),
      status: "success",
      fetched: 12,
      imported: 5,
      updated: 3,
      failedFeeds: [],
    });
  });

  it("/admin reflects the real pending count, user count, suspension and sync history", async () => {
    const html = await renderPage("/admin");

    assert.ok(html.includes(">Healthy<"), "a successful sync should read as healthy");
    assert.equal(metricValue(html, "New TORs today"), "5", "importedToday should sum today's sync runs");
    assert.equal(
      metricValue(html, "Accounts awaiting review"),
      "1",
      "exactly one of the two signups was left pending",
    );
    assert.equal(metricValue(html, "Users"), "2", "both signups should count toward the total");
    assert.ok(html.includes(">1 suspended<"));
    assert.ok(html.includes("+5 new items"), "the sync-history row should show this run's imported count");
    assert.ok(html.includes("Succeeded"));
  });

  it("/admin/audit shows the manual approve/suspend entries and the automatic sync entry", async () => {
    const html = await renderPage("/admin/audit");

    // Audit entries carry the backend's own Thai copy verbatim — they are
    // data, not translation keys — so these assertions are Thai regardless
    // of the NEXT_LOCALE cookie.
    assert.ok(html.includes("อนุมัติบัญชีบริษัท"), "the approval should be logged");
    assert.ok(html.includes("ระงับบัญชีบริษัท"), "the suspension should be logged");
    assert.ok(html.includes(approvedThenSuspended.companyName), "the entry should name the actual company");
    assert.ok(html.includes("ซิงค์ข้อมูล e-GP สำเร็จ"), "the inserted sync run should appear as an automatic entry");
    assert.ok(html.includes(">Automatic<"));
    assert.ok(html.includes(">Admin<"));
  });

  it("/admin/users lists both accounts with their real names, roles and current status", async () => {
    const html = await renderPage("/admin/users");

    assert.ok(html.includes(stillPending.companyName));
    assert.ok(html.includes(approvedThenSuspended.companyName));
    assert.ok(html.includes(">Pending<"), "the untouched signup should still read pending");
    assert.ok(html.includes(">Suspended<"), "suspension should override the approved status in the badge");
    assert.ok(html.includes(">Account owner<"), "an org account should never be badged as an administrator");
  });
});
