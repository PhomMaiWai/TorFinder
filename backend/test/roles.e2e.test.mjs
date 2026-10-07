// Owner and auditor sessions against the running server: they are real,
// accepted sessions, but they open no admin route.
//
// Tokens are minted here rather than obtained from /auth/login — the auth suite
// deliberately exhausts the login rate limiter, so a later suite that logged in
// would get 429s (see tor.e2e.test.mjs). Must match the SESSION_SECRET the
// server booted with.
//
// ADMIN_ONLY is every route behind AdminGuard. A new admin route belongs in it;
// each entry only needs to reach the guard, which answers before the body or
// the id is looked at.

import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { describe, it } from "node:test";

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:4000";
const API = `${BASE_URL}/api`;
const SESSION_SECRET = process.env.SESSION_SECRET ?? "dev-only-insecure-secret-change-me";

function makeToken(role) {
  const payload = {
    sub: "000000000000000000000000",
    email: `roles-${role}@ci.test`,
    name: `CI ${role}`,
    role,
    exp: Math.floor(Date.now() / 1000) + 3600,
  };
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", SESSION_SECRET).update(data).digest("base64url");
  return `${data}.${signature}`;
}

const TOKENS = {
  admin: makeToken("admin"),
  owner: makeToken("owner"),
  auditor: makeToken("auditor"),
};

// A well-formed ObjectId nothing has.
const ID = "0123456789abcdef01234567";

const ADMIN_ONLY = [
  ["GET", "/accounts"],
  ["GET", "/accounts/directory"],
  ["PATCH", `/accounts/${ID}`],
  ["PATCH", `/accounts/${ID}/suspend`],
  ["PATCH", `/accounts/${ID}/reactivate`],
  ["POST", "/ai/extract"],
  ["POST", `/ai/extract/${ID}`],
  ["GET", "/audit"],
  ["POST", "/datagov/sync"],
  ["POST", "/egp/sync"],
  ["GET", "/egp/near-misses"],
  ["GET", "/egp/metrics"],
  ["GET", "/feedback"],
  ["PATCH", `/feedback/${ID}`],
  ["POST", "/gproc/capture"],
  ["GET", `/gproc/capture/${ID}`],
  ["GET", `/matching/tor/${ID}/companies`],
  ["POST", "/matching/budget/refresh"],
  ["POST", "/mea/sync"],
  ["POST", "/tor"],
  ["GET", "/tor/deleted"],
  ["PATCH", `/tor/${ID}`],
  ["DELETE", `/tor/${ID}`],
  ["POST", `/tor/${ID}/restore`],
];

const an = (role) => (/^[aeiou]/.test(role) ? `an ${role}` : `a ${role}`);

async function api(path, { method = "GET", token } = {}) {
  const headers = {};
  if (token) headers.authorization = `Bearer ${token}`;
  if (method !== "GET" && method !== "DELETE") headers["content-type"] = "application/json";

  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: method === "GET" || method === "DELETE" ? undefined : "{}",
  });
  return res.status;
}

describe("the tokens themselves are good", () => {
  // Without these, every 403 below could just mean "the secret doesn't match".
  it("an admin session opens an admin route", async () => {
    assert.equal(await api("/accounts", { token: TOKENS.admin }), 200);
  });

  for (const role of ["owner", "auditor"]) {
    it(`${an(role)} session is accepted where any signed-in account may go`, async () => {
      assert.equal(await api("/notifications", { token: TOKENS[role] }), 200);
    });
  }
});

for (const role of ["owner", "auditor"]) {
  describe(`${an(role)} session on admin-only routes`, () => {
    for (const [method, path] of ADMIN_ONLY) {
      it(`${method} /api${path} is refused (403)`, async () => {
        assert.equal(await api(path, { method, token: TOKENS[role] }), 403);
      });
    }
  });
}
