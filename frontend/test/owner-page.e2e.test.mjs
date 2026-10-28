// End-to-end coverage for the Project Owner's /owner page, proving two
// independent gates and the rendered content together:
//   - proxy.ts (Next's renamed middleware): unauthenticated -> /login,
//     a non-owner session -> redirected to its own home, never seeing the
//     page shell at all.
//   - the backend's OwnerGuard on GET /api/owner/tors, and the owner/match/
//     feedback aggregation logic, are covered on their own in
//     backend/test/owner-dashboard.e2e.test.mjs and tor-owner.e2e.test.mjs —
//     this file only needs to prove the page actually renders what that
//     endpoint returns.
//
// Node's built-in runner + fetch against a running `next build && next start`
// (server components have no rendered HTML to assert on from source alone).
// Session cookie minted the same way auditor.e2e.test.mjs does.
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
  const payload = { sub, email: `owner-e2e-${role}@ci.test`, name: `CI ${role}`, role, iat, exp: iat + 3600 };
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", SESSION_SECRET).update(data).digest("base64url");
  return `${data}.${signature}`;
}

const OWNER = new ObjectId();
const OTHER_OWNER = new ObjectId();
const OWNER_TOKEN = makeToken("owner", OWNER.toString());
const OTHER_OWNER_TOKEN = makeToken("owner", OTHER_OWNER.toString());
const ADMIN_TOKEN = makeToken("admin", new ObjectId().toString());
const ORG_TOKEN = makeToken("org", new ObjectId().toString());
const AUDITOR_TOKEN = makeToken("auditor", new ObjectId().toString());
const VIEWER_TOKEN = makeToken("viewer", new ObjectId().toString());

/** Fetches a path with an optional session cookie, never following redirects. */
async function fetchPage(path, token) {
  const res = await fetch(`${FRONTEND_URL}${path}`, {
    headers: token ? { cookie: `torr_session=${token}; NEXT_LOCALE=en` } : { cookie: "NEXT_LOCALE=en" },
    redirect: "manual",
  });
  return { status: res.status, location: res.headers.get("location"), text: () => res.text() };
}

async function renderAsOwner(token = OWNER_TOKEN) {
  const res = await fetchPage("/owner", token);
  assert.equal(res.status, 200, `/owner should render for an owner session, got ${res.status}`);
  return res.text();
}

const inserted = [];

async function insertTor(overrides = {}) {
  const doc = {
    title: `Owner e2e fixture ${inserted.length}`,
    agency: `Owner Test Agency ${inserted.length}`,
    budget: "฿5,000,000",
    deadline: "31 ธ.ค. 2575",
    daysLeft: 30,
    match: 0,
    tags: [],
    stage: "ประกาศ TOR",
    summary: "fixture",
    createdAt: new Date(),
    ownerId: OWNER,
    ...overrides,
  };
  const { insertedId } = await mongo.db().collection("tors").insertOne(doc);
  inserted.push(insertedId);
  return insertedId;
}

async function insertFeedback(torId, counts) {
  const docs = Object.entries(counts).flatMap(([status, n]) =>
    Array.from({ length: n }, (_, i) => ({
      torId,
      author: `CI ${i}`,
      text: "ความคิดเห็นทดสอบ",
      status,
      createdAt: new Date(),
    })),
  );
  if (docs.length) await mongo.db().collection("feedback").insertMany(docs);
}

before(async () => {
  await mongo.connect();
});

after(async () => {
  await mongo.db().collection("tors").deleteMany({ _id: { $in: inserted } });
  await mongo.db().collection("feedback").deleteMany({ torId: { $in: inserted } });
  await mongo.close();
});

describe("/owner — route access", () => {
  it("redirects an unauthenticated visitor to /login", async () => {
    const res = await fetchPage("/owner");
    assert.equal(res.status, 307);
    assert.match(res.location, /\/login/);
  });

  it("redirects an admin session away — this area isn't theirs", async () => {
    const res = await fetchPage("/owner", ADMIN_TOKEN);
    assert.equal(res.status, 307);
    assert.doesNotMatch(res.location, /\/owner/);
  });

  it("redirects an org session away", async () => {
    const res = await fetchPage("/owner", ORG_TOKEN);
    assert.equal(res.status, 307);
    assert.doesNotMatch(res.location, /\/owner/);
  });

  it("redirects an auditor session away", async () => {
    const res = await fetchPage("/owner", AUDITOR_TOKEN);
    assert.equal(res.status, 307);
    assert.doesNotMatch(res.location, /\/owner/);
  });

  it("redirects a public viewer session away", async () => {
    const res = await fetchPage("/owner", VIEWER_TOKEN);
    assert.equal(res.status, 307);
    assert.doesNotMatch(res.location, /\/owner/);
  });

  it("renders for an owner session", async () => {
    const res = await fetchPage("/owner", OWNER_TOKEN);
    assert.equal(res.status, 200);
  });
});

describe("/owner — empty state", () => {
  it("shows the no-projects message for an owner with nothing linked", async () => {
    const html = await renderAsOwner(OTHER_OWNER_TOKEN);
    assert.ok(html.includes("No projects are linked to this account yet"));
    assert.ok(html.includes("Ask an admin to set this account as the owner on the TOR's edit page"));
  });
});

describe("/owner — renders what the backend returns", () => {
  let fixture;

  before(async () => {
    fixture = await insertTor({
      title: "Owner dashboard fixture TOR",
      agency: "Fixture Agency",
      stage: "ประกาศ TOR",
    });
    await insertFeedback(fixture, { อนุมัติ: 2, รอตรวจสอบ: 1 });
  });

  it("lists the owner's TOR with its title, agency, and stage", async () => {
    const html = await renderAsOwner();
    assert.ok(html.includes("Owner dashboard fixture TOR"));
    assert.ok(html.includes("Fixture Agency"));
    assert.ok(html.includes("ประกาศ TOR"));
  });

  it("shows the approved comment count in the row subtitle", async () => {
    const html = await renderAsOwner();
    assert.ok(html.includes("0 matched companies"));
    assert.ok(html.includes("2 comments"));
  });

  it("shows a pending-review badge for the unmoderated comment", async () => {
    const html = await renderAsOwner();
    assert.ok(html.includes("1 pending"));
  });

  it("links the row to the TOR's own page", async () => {
    const html = await renderAsOwner();
    assert.ok(html.includes(`href="/tor/${fixture.toString()}?in=app"`));
  });

  it("totals published and pending comments across the owner's TORs", async () => {
    const html = await renderAsOwner();
    assert.ok(html.includes("My TORs"));
    assert.ok(html.includes("Published comments"));
    assert.ok(html.includes("Comments pending review"));
  });

  it("never shows another owner's fixture", async () => {
    const html = await renderAsOwner(OTHER_OWNER_TOKEN);
    assert.ok(!html.includes("Owner dashboard fixture TOR"));
  });
});

describe("/owner — hidden announcements stay out", () => {
  it("excludes a soft-deleted TOR even though it's linked to this owner", async () => {
    const hidden = await insertTor({ title: "Owner hidden fixture", deletedAt: new Date() });
    const html = await renderAsOwner();
    assert.ok(!html.includes("Owner hidden fixture"));
    void hidden;
  });
});
