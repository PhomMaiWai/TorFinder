// End-to-end coverage for the TOR CRUD endpoints (backend/src/tor), run in CI
// by .github/workflows/auth.yml against a freshly booted backend + MongoDB.
//
// Same approach as auth.e2e.test.mjs: Node's built-in runner + fetch, hitting
// the running server over HTTP. TOR records are never seeded, so the database
// starts empty and every record here is one these tests created.
//
// Creating, editing, hiding and restoring an announcement, and listing the
// hidden ones, are admin-only; reading one is public.

import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { before, describe, it } from "node:test";

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:4000";
const API = `${BASE_URL}/api`;

// Mirrors backend/src/common/token.ts. Minting tokens directly keeps these
// tests off the login route, whose rate limiter the auth suite deliberately
// trips. Must match the SESSION_SECRET the server booted with (the workflow
// sets the same value for both).
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

const ADMIN_TOKEN = makeToken("admin", "admin@ci.test");
const ORG_TOKEN = makeToken("org", "org@ci.test");

// A well-formed ObjectId that no record will ever have.
const MISSING_ID = "0123456789abcdef01234567";

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
    title: `จ้างพัฒนาระบบทดสอบ CI #${torCounter}`,
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
  const res = await api("/tor", { method: "POST", body: newTor(overrides), token: ADMIN_TOKEN });
  assert.equal(res.status, 201, `create failed: ${JSON.stringify(res.body)}`);
  return res.body;
}

describe("POST /api/tor — create", () => {
  it("creates an announcement and returns its id", async () => {
    const payload = newTor();
    const res = await api("/tor", { method: "POST", body: payload, token: ADMIN_TOKEN });

    assert.equal(res.status, 201);
    assert.match(res.body.id, /^[a-f0-9]{24}$/);
    assert.equal(res.body.title, payload.title);
    assert.equal(res.body.agency, payload.agency);
    assert.equal(res.body.match, 0);
    assert.ok(res.body.createdAt, "response carries a createdAt");
  });

  it("ignores a client-supplied match score", async () => {
    const res = await api("/tor", { method: "POST", body: newTor({ match: 99 }), token: ADMIN_TOKEN });

    assert.equal(res.status, 201);
    assert.equal(res.body.match, 0);
  });

  it("rejects a missing title (400)", async () => {
    const { title, ...rest } = newTor();
    void title;
    const res = await api("/tor", { method: "POST", body: rest, token: ADMIN_TOKEN });

    assert.equal(res.status, 400);
  });

  it("rejects an empty title (400)", async () => {
    const res = await api("/tor", { method: "POST", body: newTor({ title: "" }), token: ADMIN_TOKEN });

    assert.equal(res.status, 400);
  });

  it("accepts each of the five stages and stores it as given", async () => {
    const stages = [
      "\u0e41\u0e1c\u0e19\u0e01\u0e32\u0e23\u0e08\u0e31\u0e14\u0e0b\u0e37\u0e49\u0e2d\u0e08\u0e31\u0e14\u0e08\u0e49\u0e32\u0e07",
      "\u0e40\u0e1b\u0e34\u0e14\u0e23\u0e31\u0e1a\u0e1f\u0e31\u0e07\u0e04\u0e27\u0e32\u0e21\u0e04\u0e34\u0e14\u0e40\u0e2b\u0e47\u0e19",
      "\u0e1b\u0e23\u0e30\u0e01\u0e32\u0e28\u0e23\u0e32\u0e04\u0e32\u0e01\u0e25\u0e32\u0e07",
      "\u0e1b\u0e23\u0e30\u0e01\u0e32\u0e28 TOR",
      "\u0e1b\u0e23\u0e30\u0e01\u0e32\u0e28\u0e1c\u0e39\u0e49\u0e0a\u0e19\u0e30",
    ];
    for (const stage of stages) {
      const created = await createTor({ stage });
      const read = await api(`/tor/${created.id}`);
      assert.equal(read.body.stage, stage);
    }
  });

  it("reads back a five-entry timeline with the record's stage current", async () => {
    const created = await createTor({ stage: "\u0e1b\u0e23\u0e30\u0e01\u0e32\u0e28 TOR" });
    const read = await api(`/tor/${created.id}`);

    assert.equal(read.body.currentStage, read.body.stage);
    assert.equal(read.body.timeline.length, 5);
    assert.deepEqual(read.body.timeline.filter((entry) => entry.current).map((entry) => entry.stage), [read.body.stage]);
    assert.ok(read.body.timeline.every((entry) => typeof entry.reached === "boolean"));
  });

  it("carries the timeline on the list too", async () => {
    await createTor();
    const list = await api("/tor");
    assert.ok(list.body.length > 0);
    assert.ok(list.body.every((tor) => tor.timeline?.length === 5 && tor.currentStage === tor.stage));
  });

  it("rejects a stage outside the allowed set (400)", async () => {
    const res = await api("/tor", { method: "POST", body: newTor({ stage: "draft" }), token: ADMIN_TOKEN });

    assert.equal(res.status, 400);
  });

  it("rejects a negative daysLeft (400)", async () => {
    const res = await api("/tor", { method: "POST", body: newTor({ daysLeft: -1 }), token: ADMIN_TOKEN });

    assert.equal(res.status, 400);
  });

  it("rejects a non-integer daysLeft (400)", async () => {
    const res = await api("/tor", { method: "POST", body: newTor({ daysLeft: 3.5 }), token: ADMIN_TOKEN });

    assert.equal(res.status, 400);
  });

  it("rejects tags that are not all strings (400)", async () => {
    const res = await api("/tor", { method: "POST", body: newTor({ tags: [123] }), token: ADMIN_TOKEN });

    assert.equal(res.status, 400);
  });

  it("rejects an unknown budgetStatus (400)", async () => {
    const res = await api("/tor", { method: "POST", body: newTor({ budgetStatus: "high" }), token: ADMIN_TOKEN });

    assert.equal(res.status, 400);
  });
});

describe("GET /api/tor — list", () => {
  let created;

  before(async () => {
    created = await createTor();
  });

  it("returns an array that includes the new record", async () => {
    const res = await api("/tor");

    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body));
    assert.ok(res.body.some((t) => t.id === created.id), "new record is in the listing");
  });

  it("honours pageSize", async () => {
    const res = await api("/tor?pageSize=1");

    assert.equal(res.status, 200);
    assert.ok(res.body.length <= 1);
  });

  it("rejects pageSize above 100 (400)", async () => {
    const res = await api("/tor?pageSize=500");

    assert.equal(res.status, 400);
  });

  it("rejects page below 1 (400)", async () => {
    const res = await api("/tor?page=0");

    assert.equal(res.status, 400);
  });

  it("rejects a non-numeric page (400)", async () => {
    const res = await api("/tor?page=abc");

    assert.equal(res.status, 400);
  });

  it("source=manual includes an admin-entered record", async () => {
    const res = await api("/tor?source=manual");

    assert.equal(res.status, 200);
    assert.ok(res.body.some((t) => t.id === created.id));
  });

  it("source=egp excludes an admin-entered record", async () => {
    const res = await api("/tor?source=egp");

    assert.equal(res.status, 200);
    assert.ok(!res.body.some((t) => t.id === created.id));
  });

  it("rejects an unknown source (400)", async () => {
    const res = await api("/tor?source=elsewhere");

    assert.equal(res.status, 400);
  });
});

describe("GET /api/tor/:id — read one", () => {
  let created;

  before(async () => {
    created = await createTor();
  });

  it("returns the record by id", async () => {
    const res = await api(`/tor/${created.id}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.id, created.id);
    assert.equal(res.body.title, created.title);
  });

  it("returns 404 for a well-formed but unknown id", async () => {
    const res = await api(`/tor/${MISSING_ID}`);

    assert.equal(res.status, 404);
  });

  it("returns 404 for a malformed id", async () => {
    const res = await api("/tor/not-an-id");

    assert.equal(res.status, 404);
  });
});

describe("PATCH /api/tor/:id — update", () => {
  let created;

  before(async () => {
    created = await createTor();
  });

  it("updates a field and returns the new value", async () => {
    const res = await api(`/tor/${created.id}`, {
      method: "PATCH",
      token: ADMIN_TOKEN,
      body: { title: "ชื่อโครงการที่แก้ไขแล้ว" },
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.title, "ชื่อโครงการที่แก้ไขแล้ว");
  });

  // Patched through `budget`, not `daysLeft`: days left is recomputed from the
  // deadline on every read, so a stored value never comes back as written.
  it("leaves untouched fields alone", async () => {
    await api(`/tor/${created.id}`, { method: "PATCH", body: { budget: "฿2,000,000" }, token: ADMIN_TOKEN });
    const res = await api(`/tor/${created.id}`);

    assert.equal(res.body.budget, "฿2,000,000");
    assert.equal(res.body.agency, created.agency, "agency was not part of the patch");
  });

  it("strips unknown fields", async () => {
    const res = await api(`/tor/${created.id}`, {
      method: "PATCH",
      token: ADMIN_TOKEN,
      body: { summary: "สรุปใหม่", nonsense: "ignored" },
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.summary, "สรุปใหม่");
    assert.equal(res.body.nonsense, undefined);
  });

  it("rejects an invalid stage (400)", async () => {
    const res = await api(`/tor/${created.id}`, {
      method: "PATCH",
      token: ADMIN_TOKEN,
      body: { stage: "draft" },
    });

    assert.equal(res.status, 400);
  });

  it("returns 404 for an unknown id", async () => {
    const res = await api(`/tor/${MISSING_ID}`, {
      method: "PATCH",
      token: ADMIN_TOKEN,
      body: { title: "x" },
    });

    assert.equal(res.status, 404);
  });
});

describe("POST /api/tor and PATCH /api/tor/:id — admin only", () => {
  let target;

  before(async () => {
    target = await createTor();
  });

  it("forbids creating without a token (403)", async () => {
    const res = await api("/tor", { method: "POST", body: newTor() });

    assert.equal(res.status, 403);
  });

  it("forbids creating with an organization token (403)", async () => {
    const res = await api("/tor", { method: "POST", body: newTor(), token: ORG_TOKEN });

    assert.equal(res.status, 403);
  });

  it("checks the session before the body — an invalid payload without a token is 403, not 400", async () => {
    const res = await api("/tor", { method: "POST", body: newTor({ title: "" }) });

    assert.equal(res.status, 403);
  });

  it("forbids editing without a token (403)", async () => {
    const res = await api(`/tor/${target.id}`, { method: "PATCH", body: { title: "แก้โดยไม่มีสิทธิ์" } });

    assert.equal(res.status, 403);
  });

  it("forbids editing with an organization token (403)", async () => {
    const res = await api(`/tor/${target.id}`, {
      method: "PATCH",
      body: { title: "แก้โดยบริษัท" },
      token: ORG_TOKEN,
    });

    assert.equal(res.status, 403);
  });

  it("leaves the record untouched after a refused edit", async () => {
    const res = await api(`/tor/${target.id}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.title, target.title);
  });
});

describe("DELETE /api/tor/:id — soft delete, admin only", () => {
  let target;

  before(async () => {
    target = await createTor();
  });

  it("forbids a request with no token (403)", async () => {
    const res = await api(`/tor/${target.id}`, { method: "DELETE" });

    assert.equal(res.status, 403);
  });

  it("forbids an organization token (403)", async () => {
    const res = await api(`/tor/${target.id}`, { method: "DELETE", token: ORG_TOKEN });

    assert.equal(res.status, 403);
  });

  it("lets an admin hide the record", async () => {
    const res = await api(`/tor/${target.id}`, { method: "DELETE", token: ADMIN_TOKEN });

    assert.equal(res.status, 200);
    assert.ok(res.body.deletedAt, "response carries deletedAt");
  });

  it("drops the record from the public listing", async () => {
    const res = await api("/tor?pageSize=100");

    assert.ok(!res.body.some((t) => t.id === target.id));
  });

  it("still resolves the record by id (soft, not hard, delete)", async () => {
    const res = await api(`/tor/${target.id}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.id, target.id);
  });

  it("returns 404 deleting an unknown id", async () => {
    const res = await api(`/tor/${MISSING_ID}`, { method: "DELETE", token: ADMIN_TOKEN });

    assert.equal(res.status, 404);
  });
});

describe("GET /api/tor/deleted — admin only", () => {
  let hidden;

  before(async () => {
    hidden = await createTor();
    await api(`/tor/${hidden.id}`, { method: "DELETE", token: ADMIN_TOKEN });
  });

  it("forbids an organization token (403)", async () => {
    const res = await api("/tor/deleted", { token: ORG_TOKEN });

    assert.equal(res.status, 403);
  });

  it("lists the hidden record for an admin", async () => {
    const res = await api("/tor/deleted", { token: ADMIN_TOKEN });

    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body));
    assert.ok(res.body.some((t) => t.id === hidden.id));
  });
});

describe("POST /api/tor/:id/restore — admin only", () => {
  let target;

  before(async () => {
    target = await createTor();
    await api(`/tor/${target.id}`, { method: "DELETE", token: ADMIN_TOKEN });
  });

  it("forbids an organization token (403)", async () => {
    const res = await api(`/tor/${target.id}/restore`, { method: "POST", token: ORG_TOKEN });

    assert.equal(res.status, 403);
  });

  it("lets an admin restore the record", async () => {
    const res = await api(`/tor/${target.id}/restore`, { method: "POST", token: ADMIN_TOKEN });

    assert.equal(res.status, 201);
    assert.equal(res.body.deletedAt, undefined, "deletedAt is cleared");
  });

  it("returns the record to the public listing", async () => {
    const res = await api("/tor?pageSize=100");

    assert.ok(res.body.some((t) => t.id === target.id));
  });

  it("returns 404 restoring an unknown id", async () => {
    const res = await api(`/tor/${MISSING_ID}/restore`, { method: "POST", token: ADMIN_TOKEN });

    assert.equal(res.status, 404);
  });
});
