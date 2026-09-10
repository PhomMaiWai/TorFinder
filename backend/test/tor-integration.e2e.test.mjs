// End-to-end coverage for how TOR records from the two data sources — an
// admin's free-text form and the e-GP import — are reconciled inside one
// collection, run in CI by .github/workflows/auth.yml against a freshly booted
// backend + MongoDB.
//
// Same approach as tor.e2e.test.mjs: Node's built-in runner + fetch over HTTP.
//
// Scope. The live e-GP fetch path (EgpClient -> portal, EgpService.sync) is
// deliberately kept idle in CI — the workflow sets EGP_POLL_MINUTES=0 and
// EGP_POLL_ON_STARTUP=false — so it is not exercised here beyond an opt-in
// smoke test (E2E_EGP_LIVE=1). What is covered is the deterministic seam a
// sync feeds into: the title/agency normalization and fuzzy-match layer
// (src/tor/tor-dedup.ts) that stops an admin entry and an imported record
// from describing the same real project twice, plus the manual/egp source
// split on the listing.

import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { before, describe, it } from "node:test";

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:4000";
const API = `${BASE_URL}/api`;

// Mirrors backend/src/common/token.ts — mint an admin token directly rather
// than going through the rate-limited login route. Must match the
// SESSION_SECRET the server booted with (the workflow sets the same value).
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

const ADMIN_TOKEN = makeToken("admin", "integration-admin@ci.test");

// TOR records are never seeded, so the only rows are ones the tests create.
// Every fixture title carries this run id so a rerun against a persisted local
// database can't collide with a previous run's rows — and the deliberate
// near-duplicates below are near-duplicates of *this* run's baseline.
const RUN = Date.now().toString(36);

// Two agencies that share no word and neither contains the other, so
// isLikelySameAgency() cleanly separates them.
const AGENCY = "Procurement Data Integration Office";
const OTHER_AGENCY = "City Hall Facilities Bureau";

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

function torBody(overrides = {}) {
  return {
    title: `Untitled ${RUN}`,
    agency: AGENCY,
    budget: "฿1,000,000",
    deadline: "31 ธ.ค. 2569",
    daysLeft: 30,
    tags: ["Web Application", "QA"],
    stage: "ประกาศ TOR",
    summary: "Fixture created by the TOR data-integration suite.",
    ...overrides,
  };
}

function postTor(overrides = {}) {
  return api("/tor", { method: "POST", body: torBody(overrides) });
}

async function createTor(overrides = {}) {
  const res = await postTor(overrides);
  assert.equal(res.status, 201, `create failed: ${JSON.stringify(res.body)}`);
  return res.body;
}

function conflictMessage(body) {
  return Array.isArray(body?.message) ? body.message[0] : body?.message;
}

describe("POST /api/tor — cross-source duplicate rejection", () => {
  let baseline;

  before(async () => {
    baseline = await createTor({ title: `Digital Permit Tracking System ${RUN}` });
  });

  it("names the existing record when it rejects a byte-identical re-entry (409)", async () => {
    const res = await postTor({ title: `Digital Permit Tracking System ${RUN}` });

    assert.equal(res.status, 409);
    const message = conflictMessage(res.body);
    assert.ok(message.includes(baseline.id), `message should cite the existing id: ${message}`);
    assert.ok(message.includes(RUN), `message should quote the existing title: ${message}`);
  });

  it("rejects a title that differs only in punctuation and case (409)", async () => {
    const res = await postTor({
      title: `digital permit tracking system (${RUN})`,
      agency: AGENCY.toLowerCase(),
    });

    assert.equal(res.status, 409);
  });

  it("rejects a title that appends the clause e-GP tacks on (409)", async () => {
    const res = await postTor({
      title: `Digital Permit Tracking System ${RUN} ด้วยวิธีประกวดราคาอิเล็กทรอนิกส์`,
    });

    assert.equal(res.status, 409);
  });

  it("rejects a reworded title with the same words in a new order (409)", async () => {
    await createTor({ title: `Traffic Signal Analytics Platform ${RUN}` });

    const res = await postTor({ title: `Platform Analytics for Traffic Signal ${RUN}` });

    assert.equal(res.status, 409);
  });

  it("allows an unrelated project at the same agency (201)", async () => {
    const res = await postTor({ title: `Warehouse Robotics Fleet Upgrade ${RUN}` });

    assert.equal(res.status, 201);
  });

  it("allows the same title at an agency that isn't a match (201)", async () => {
    const res = await postTor({
      title: `Digital Permit Tracking System ${RUN}`,
      agency: OTHER_AGENCY,
    });

    assert.equal(res.status, 201, `expected the agency mismatch to clear dedup: ${JSON.stringify(res.body)}`);
  });

  it("stops flagging the duplicate once the original is soft-deleted", async () => {
    const original = await createTor({ title: `Standalone Records Archive ${RUN}` });

    const blocked = await postTor({ title: `Standalone Records Archive ${RUN}` });
    assert.equal(blocked.status, 409, "a live original should still block the re-entry");

    const removed = await api(`/tor/${original.id}`, { method: "DELETE", token: ADMIN_TOKEN });
    assert.equal(removed.status, 200);

    const readmitted = await postTor({ title: `Standalone Records Archive ${RUN}` });
    assert.equal(readmitted.status, 201, "the duplicate scan should ignore soft-deleted rows");
  });

  it("treats '#1' and '#10' as different projects, not one containing the other", async () => {
    // Stem is a single token (underscores survive normalization), so the two
    // titles share exactly one of three words — well under the word-overlap
    // threshold — leaving containment as the only thing that could match them,
    // and "..._#1" is not a word-boundary substring of "..._#10".
    const first = await createTor({ title: `PhaseRolloutPlan_${RUN} #1` });

    const exact = await postTor({ title: `PhaseRolloutPlan_${RUN} #1` });
    assert.equal(exact.status, 409, `title+agency wiring sanity check: ${JSON.stringify(exact.body)}`);
    assert.ok(conflictMessage(exact.body).includes(first.id));

    const tenth = await postTor({ title: `PhaseRolloutPlan_${RUN} #10` });
    assert.equal(tenth.status, 201, "'#10' must not be read as containing '#1'");
  });
});

describe("GET /api/tor — manual vs e-GP source split", () => {
  let manual;

  before(async () => {
    manual = await createTor({ title: `Source Split Fixture ${RUN}` });
  });

  it("classifies a record created through POST /api/tor as a manual source", async () => {
    const all = await api("/tor?pageSize=100");
    const asManual = await api("/tor?source=manual&pageSize=100");
    const asEgp = await api("/tor?source=egp&pageSize=100");

    assert.equal(all.status, 200);
    assert.ok(all.body.some((t) => t.id === manual.id), "unfiltered listing should include it");
    assert.ok(asManual.body.some((t) => t.id === manual.id), "source=manual should include it");
    assert.ok(!asEgp.body.some((t) => t.id === manual.id), "source=egp should not include it");
  });

  it("keeps the manual and e-GP filters disjoint", async () => {
    const asManual = await api("/tor?source=manual&pageSize=100");
    const asEgp = await api("/tor?source=egp&pageSize=100");

    assert.equal(asManual.status, 200);
    assert.equal(asEgp.status, 200);

    const egpIds = new Set(asEgp.body.map((t) => t.id));
    const overlap = asManual.body.filter((t) => egpIds.has(t.id));
    assert.deepEqual(overlap, [], "no record should be both manual and imported");
  });
});

describe("POST /api/egp/sync — live import contract (opt-in)", () => {
  // Off in CI: this reaches the real Bangkok e-GP portal. Run locally with
  // E2E_EGP_LIVE=1 to exercise it.
  const skip = process.env.E2E_EGP_LIVE !== "1";

  it("is routed and answers with a sync result or a portal-unavailable error", { skip, timeout: 180_000 }, async () => {
    const res = await api("/egp/sync", { method: "POST" });

    assert.notEqual(res.status, 404, "the sync endpoint should be mounted");
    assert.ok([200, 503].includes(res.status), `unexpected status ${res.status}: ${JSON.stringify(res.body)}`);

    if (res.status === 200) {
      for (const key of ["fetched", "imported", "updated"]) {
        assert.equal(typeof res.body[key], "number", `${key} should be a number`);
      }
      assert.ok(Array.isArray(res.body.failed), "failed should be an array");
    }
  });
});
