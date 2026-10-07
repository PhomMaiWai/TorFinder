// The role guards (backend/src/common/*.guard.ts), exercised without a server:
// a guard only reads the Authorization header, so a request-shaped object is
// all it needs. Loaded from dist like the other logic-only suites — run
// `npm run build` first.
//
// The property that matters is the whole table, not any one cell: each guard
// admits exactly one role. A new entry in ROLES that a guard starts letting
// through, or an admin that quietly passes an owner route, fails here.

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { AdminGuard } from "../dist/common/admin.guard.js";
import { AuditorGuard } from "../dist/common/auditor.guard.js";
import { OwnerGuard } from "../dist/common/owner.guard.js";
import { ROLES } from "../dist/common/roles.js";
import { createSessionToken } from "../dist/common/token.js";

const GUARDS = [
  { name: "AdminGuard", Guard: AdminGuard, role: "admin" },
  { name: "OwnerGuard", Guard: OwnerGuard, role: "owner" },
  { name: "AuditorGuard", Guard: AuditorGuard, role: "auditor" },
];

const an = (role) => (/^[aeiou]/.test(role) ? `an ${role}` : `a ${role}`);

function tokenFor(role) {
  return createSessionToken({
    sub: "000000000000000000000000",
    email: `${role}@ci.test`,
    name: `CI ${role}`,
    role,
  });
}

/** Runs a guard against a request carrying this Authorization header (or none). */
function run(Guard, authorization) {
  const request = { headers: authorization === undefined ? {} : { authorization } };
  const context = { switchToHttp: () => ({ getRequest: () => request }) };
  try {
    return { allowed: new Guard().canActivate(context), request };
  } catch (error) {
    return { allowed: false, error, request };
  }
}

describe("every role the system knows", () => {
  it("is exactly admin, org, owner and auditor", () => {
    assert.deepEqual([...ROLES].sort(), ["admin", "auditor", "org", "owner"]);
  });
});

for (const { name, Guard, role } of GUARDS) {
  describe(`${name}`, () => {
    it(`admits ${an(role)} session and attaches it to the request`, () => {
      const { allowed, request } = run(Guard, `Bearer ${tokenFor(role)}`);

      assert.equal(allowed, true);
      assert.equal(request.session.role, role);
      assert.equal(request.session.email, `${role}@ci.test`);
    });

    it(`admits no role but ${role}`, () => {
      const admitted = ROLES.filter((r) => run(Guard, `Bearer ${tokenFor(r)}`).allowed);

      assert.deepEqual(admitted, [role]);
    });

    for (const other of ROLES.filter((r) => r !== role)) {
      it(`refuses ${an(other)} session with 403 and attaches nothing`, () => {
        const { error, request } = run(Guard, `Bearer ${tokenFor(other)}`);

        assert.equal(error.getStatus(), 403);
        assert.equal(request.session, undefined);
      });
    }

    it("refuses a request with no Authorization header (403)", () => {
      assert.equal(run(Guard, undefined).error.getStatus(), 403);
    });

    it("refuses a scheme other than Bearer (403)", () => {
      assert.equal(run(Guard, `Basic ${tokenFor(role)}`).error.getStatus(), 403);
    });

    it("refuses a token whose signature was tampered with (403)", () => {
      assert.equal(run(Guard, `Bearer ${tokenFor(role)}x`).error.getStatus(), 403);
    });

    it("refuses a token whose payload was swapped for another role's (403)", () => {
      // Keep this role's signature, graft on a different role's payload.
      const [, signature] = tokenFor(role).split(".");
      const [otherPayload] = tokenFor(role === "admin" ? "org" : "admin").split(".");

      assert.equal(run(Guard, `Bearer ${otherPayload}.${signature}`).error.getStatus(), 403);
    });
  });
}
