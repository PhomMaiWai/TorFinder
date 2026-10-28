// End-to-end coverage for the admin side of "report a problem" (FR-21): the
// /admin/reports review list, and the public "Report a problem" button on
// the TOR detail page. The feature's own logic — validation, guest vs.
// signed-in attribution, resolve/reopen + the audit entry each writes — is
// already covered thoroughly in backend/test/reports.e2e.test.mjs. This file
// only needs to prove the admin page actually renders what that endpoint
// returns, the way owner-page.e2e.test.mjs and admin-dashboard.e2e.test.mjs
// do for their own pages.
//
// resolveReport/reopenReport (report-list.tsx) are React Server Actions bound
// directly to a button's onClick, not a plain form POST or a frontend API
// route — there is no stable way to invoke one with a raw fetch the way
// saved-searches-api.e2e.test.mjs calls a route handler. So resolved/reopened
// state here is set up directly against the backend (PATCH /api/reports/:id,
// same as admin-dashboard.e2e.test.mjs does for account review), and this
// file only asserts the page renders that state correctly.
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

import { MongoClient } from "mongodb";

const FRONTEND_URL = process.env.E2E_FRONTEND_URL ?? "http://localhost:3000";
const BACKEND_URL = process.env.E2E_BACKEND_URL ?? "http://localhost:4000";
const BACKEND_API = `${BACKEND_URL}/api`;
const MONGODB_URI = process.env.MONGODB_URI ?? "mongodb://torr:torr@localhost:27017/torr?authSource=admin";
const SESSION_SECRET = process.env.SESSION_SECRET ?? "dev-only-insecure-secret-change-me";
const mongo = new MongoClient(MONGODB_URI);

const ADMIN_EMAIL = `admin+reports-${Date.now()}@ci.test`;

function makeToken(role, email) {
  const iat = Math.floor(Date.now() / 1000);
  const payload = { sub: "0123456789abcdef01234567", email, name: `CI ${role}`, role, iat, exp: iat + 3600 };
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", SESSION_SECRET).update(data).digest("base64url");
  return `${data}.${signature}`;
}

const ADMIN_TOKEN = makeToken("admin", ADMIN_EMAIL);
const ORG_TOKEN = makeToken("org", `org+reports-${Date.now()}@ci.test`);

async function backendApi(path, { method = "GET", body, token = ADMIN_TOKEN } = {}) {
  const headers = {};
  if (token) headers.authorization = `Bearer ${token}`;
  if (body !== undefined) headers["content-type"] = "application/json";
  const res = await fetch(`${BACKEND_API}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : undefined };
}

/** Fetches a path with an optional session cookie, never following redirects. */
async function fetchPage(path, token) {
  const res = await fetch(`${FRONTEND_URL}${path}`, {
    headers: token ? { cookie: `torr_session=${token}; NEXT_LOCALE=en` } : { cookie: "NEXT_LOCALE=en" },
    redirect: "manual",
  });
  return { status: res.status, location: res.headers.get("location"), text: () => res.text() };
}

async function renderAsAdmin(path) {
  const res = await fetchPage(path, ADMIN_TOKEN);
  assert.equal(res.status, 200, `${path} should render for an admin session, got ${res.status}`);
  return res.text();
}

const inserted = [];

async function insertTor(overrides = {}) {
  const doc = {
    title: `Report-list fixture TOR ${inserted.length}`,
    agency: "Report Test Agency",
    budget: "฿5,000,000",
    deadline: "31 ธ.ค. 2575",
    daysLeft: 30,
    stage: "ประกาศ TOR",
    summary: "fixture",
    sourceRef: `ci-report-${Date.now()}-${inserted.length}`,
    createdAt: new Date(),
    ...overrides,
  };
  const { insertedId } = await mongo.db().collection("tors").insertOne(doc);
  inserted.push(insertedId);
  return insertedId;
}

before(async () => {
  await mongo.connect();
});

after(async () => {
  await mongo.db().collection("tors").deleteMany({ _id: { $in: inserted } });
  await mongo.db().collection("torReports").deleteMany({ torId: { $in: inserted } });
  await mongo.db().collection("auditLogEntries").deleteMany({ actor: ADMIN_EMAIL });
  await mongo.close();
});

describe("/admin/reports — route access", () => {
  it("redirects an unauthenticated visitor to /login", async () => {
    const res = await fetchPage("/admin/reports");
    assert.equal(res.status, 307);
    assert.match(res.location, /\/login/);
  });

  it("redirects an org session away — this area isn't theirs", async () => {
    const res = await fetchPage("/admin/reports", ORG_TOKEN);
    assert.equal(res.status, 307);
    assert.doesNotMatch(res.location, /\/admin\/reports/);
  });

  it("renders for an admin session", async () => {
    const html = await renderAsAdmin("/admin/reports?status=all");
    assert.ok(html.includes("TOR reports"));
  });
});

describe("/admin/reports — renders what the backend returns", () => {
  let openTor, resolvedTor;
  let openMessage, resolvedMessage;

  before(async () => {
    openTor = await insertTor({ title: "Report-list fixture TOR — open" });
    resolvedTor = await insertTor({ title: "Report-list fixture TOR — resolved" });

    openMessage = `The budget listed here is wrong, CI fixture ${Date.now()}`;
    const openReport = await backendApi(`/tor/${openTor}/reports`, {
      method: "POST",
      token: null,
      body: { reason: "wrong-info", message: openMessage, contact: "ci-reporter@example.com" },
    });
    assert.equal(openReport.status, 201, `report create failed: ${JSON.stringify(openReport.body)}`);

    resolvedMessage = `This listing is a duplicate, CI fixture ${Date.now()}`;
    const resolvedReport = await backendApi(`/tor/${resolvedTor}/reports`, {
      method: "POST",
      token: null,
      body: { reason: "duplicate", message: resolvedMessage },
    });
    assert.equal(resolvedReport.status, 201);

    const resolve = await backendApi(`/reports/${resolvedReport.body.id}`, {
      method: "PATCH",
      body: { status: "resolved" },
    });
    assert.equal(resolve.status, 200, `resolve failed: ${JSON.stringify(resolve.body)}`);
  });

  it("lists an open report under the open tab, with its reason, TOR, and guest contact", async () => {
    const html = await renderAsAdmin("/admin/reports?status=open");
    assert.ok(html.includes(openMessage));
    assert.ok(html.includes("Report-list fixture TOR — open"));
    assert.ok(html.includes("Wrong information (budget, date, agency)"));
    assert.ok(html.includes("Guest"));
    assert.ok(html.includes("ci-reporter@example.com"));
  });

  it("does not list a resolved report under the open tab", async () => {
    const html = await renderAsAdmin("/admin/reports?status=open");
    assert.ok(!html.includes(resolvedMessage));
  });

  it("lists the resolved report under the resolved tab, with who resolved it", async () => {
    const html = await renderAsAdmin("/admin/reports?status=resolved");
    assert.ok(html.includes(resolvedMessage));
    assert.ok(html.includes("Duplicate of another notice"));
    assert.ok(html.includes("Resolved by"));
    assert.ok(html.includes(ADMIN_EMAIL));
  });

  it("does not list an open report under the resolved tab", async () => {
    const html = await renderAsAdmin("/admin/reports?status=resolved");
    assert.ok(!html.includes(openMessage));
  });

  it("lists both under the all tab", async () => {
    const html = await renderAsAdmin("/admin/reports?status=all");
    assert.ok(html.includes(openMessage));
    assert.ok(html.includes(resolvedMessage));
  });

  it("links each report to its own TOR page", async () => {
    const html = await renderAsAdmin("/admin/reports?status=all");
    assert.ok(html.includes(`href="/tor/${openTor.toString()}"`));
    assert.ok(html.includes(`href="/tor/${resolvedTor.toString()}"`));
  });
});

describe("/tor/[id] — the public report-a-problem entry point", () => {
  it("shows the report button on a real (sourceRef-backed) announcement", async () => {
    const tor = await insertTor({ title: "Report button fixture TOR" });
    const res = await fetchPage(`/tor/${tor.toString()}`);
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.ok(html.includes("Report a problem with this notice"));
  });
});
