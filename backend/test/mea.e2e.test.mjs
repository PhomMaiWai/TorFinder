// End-to-end coverage for the MEA (การไฟฟ้านครหลวง) import (backend/src/mea),
// run in CI by .github/workflows/auth.yml against a freshly booted backend + MongoDB.
//
// Same approach as tor-integration.e2e.test.mjs's e-GP coverage and
// datagov.e2e.test.mjs: Node's built-in runner + fetch over HTTP, admin-guard
// checks always on, and the live portal fetch kept opt-in since it reaches the
// real procurement.mea.or.th site. The scraper's own HTML parsing is covered
// deterministically in mea-client.test.mjs instead of here.

import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { describe, it } from "node:test";

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

const ADMIN_TOKEN = makeToken("admin", "mea-admin@ci.test");
const ORG_TOKEN = makeToken("org", "mea-org@ci.test");

async function api(path, { method = "GET", token } = {}) {
  const headers = {};
  if (token) headers.authorization = `Bearer ${token}`;

  const res = await fetch(`${API}${path}`, { method, headers });

  const text = await res.text();
  let parsed;
  try {
    parsed = text ? JSON.parse(text) : undefined;
  } catch {
    parsed = text;
  }
  return { status: res.status, body: parsed };
}

describe("POST /api/mea/sync — admin only", () => {
  it("forbids a request with no token (403)", async () => {
    const res = await api("/mea/sync", { method: "POST" });
    assert.equal(res.status, 403, "starting an import must take an admin session");
  });

  it("forbids an organization token (403)", async () => {
    const res = await api("/mea/sync", { method: "POST", token: ORG_TOKEN });
    assert.equal(res.status, 403);
  });
});

describe("POST /api/mea/sync — live import contract (opt-in)", () => {
  // Off in CI: this reaches the real MEA procurement site. Run locally with
  // E2E_MEA_LIVE=1 to exercise it.
  const skip = process.env.E2E_MEA_LIVE !== "1";

  it("is routed and answers with a sync result or a portal-unavailable error", { skip, timeout: 180_000 }, async () => {
    const res = await api("/mea/sync", { method: "POST", token: ADMIN_TOKEN });

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
