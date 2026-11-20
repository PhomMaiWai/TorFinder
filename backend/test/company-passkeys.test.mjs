// ASVS 6.3.3: with passkeys required, a company (like staff) that signed in
// without one may only use the /auth routes, to add one; viewers sign in with
// Google and are not asked. Logic-only, from dist (run `npm run build` first).
// Each test file runs in its own process, so turning the requirement on here
// doesn't reach any other suite.

import assert from "node:assert/strict";
import { before, describe, it } from "node:test";

let SessionGuard, OrgGuard, createSessionToken;

before(async () => {
  process.env.STAFF_PASSKEYS_REQUIRED = "true";
  process.env.COMPANY_PASSKEYS_REQUIRED = "true";
  ({ SessionGuard } = await import("../dist/common/session.guard.js"));
  ({ OrgGuard } = await import("../dist/common/org.guard.js"));
  ({ createSessionToken } = await import("../dist/common/token.js"));
});

const token = (role, amr) =>
  createSessionToken({ sub: "000000000000000000000000", email: `${role}@ci.test`, name: role, role, ...(amr && { amr }) });

function run(Guard, role, path, amr) {
  const request = { headers: { authorization: `Bearer ${token(role, amr)}` }, path, method: "GET" };
  const context = { switchToHttp: () => ({ getRequest: () => request }) };
  try {
    return { allowed: new Guard().canActivate(context) };
  } catch (error) {
    return { allowed: false, status: error.getStatus?.(), code: error.getResponse?.().code };
  }
}

describe("company passkeys, when required (ASVS 6.3.3)", () => {
  it("a company signed in with its password alone gets none of its data", () => {
    assert.deepEqual(run(SessionGuard, "org", "/api/saved-tors", ["pwd"]), { allowed: false, status: 403, code: "passkey-setup-required" });
    assert.deepEqual(run(OrgGuard, "org", "/api/profile", ["pwd"]), { allowed: false, status: 403, code: "passkey-setup-required" });
  });

  it("but can still reach the sign-in routes, to add a passkey", () => {
    assert.equal(run(SessionGuard, "org", "/api/auth/passkeys", ["pwd"]).allowed, true);
    assert.equal(run(SessionGuard, "org", "/api/auth/sessions", ["pwd"]).allowed, true);
  });

  it("a company that used its passkey gets in", () => {
    assert.equal(run(SessionGuard, "org", "/api/saved-tors", ["pwd", "passkey"]).allowed, true);
    assert.equal(run(OrgGuard, "org", "/api/profile", ["pwd", "passkey"]).allowed, true);
  });

  it("staff follow the same rule", () => {
    assert.equal(run(SessionGuard, "admin", "/api/notifications", ["pwd"]).code, "passkey-setup-required");
    assert.equal(run(SessionGuard, "admin", "/api/notifications", ["pwd", "passkey"]).allowed, true);
  });

  it("a public viewer, who signs in with Google, is not asked for one", () => {
    assert.equal(run(SessionGuard, "viewer", "/api/saved-tors", ["google"]).allowed, true);
  });
});
