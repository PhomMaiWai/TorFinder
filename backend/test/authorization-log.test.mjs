// ASVS 16.3.2 at Level 3: every authorization decision is logged, the allowed
// ones too, so access to protected data is on record. A guard that admits a
// request writes `access.granted` (who, role, method, path); one that refuses
// writes `access.denied`. Neither carries the query string or any data.
// Loaded from dist like the other logic-only suites — run `npm run build` first.

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { AdminGuard } from "../dist/common/admin.guard.js";
import { SessionGuard } from "../dist/common/session.guard.js";
import { createSessionToken } from "../dist/common/token.js";

function captureOutput(fn) {
  const chunks = [];
  const out = process.stdout.write.bind(process.stdout);
  const err = process.stderr.write.bind(process.stderr);
  process.stdout.write = (chunk) => (chunks.push(String(chunk)), true);
  process.stderr.write = (chunk) => (chunks.push(String(chunk)), true);
  try {
    try {
      fn();
    } catch {
      // a refusal throws; only the log matters here
    }
  } finally {
    process.stdout.write = out;
    process.stderr.write = err;
  }
  return chunks.join("");
}

const token = (role) => createSessionToken({ sub: "0123456789abcdef01234567", email: `${role}@ci.test`, name: `CI ${role}`, role });

function decide(Guard, role) {
  const request = {
    headers: { authorization: `Bearer ${token(role)}` },
    ip: "192.0.2.44",
    method: "GET",
    path: "/api/certificates/0123456789abcdef01234567/file",
  };
  const context = { switchToHttp: () => ({ getRequest: () => request }) };
  return captureOutput(() => new Guard().canActivate(context));
}

const line = (output, event) => output.split("\n").find((l) => l.includes(`"${event}"`));

describe("authorization decisions are logged (ASVS 16.3.2)", () => {
  it("an admitted request writes access.granted with user, role, method and path", () => {
    const granted = line(decide(AdminGuard, "admin"), "access.granted");
    assert.ok(granted, "access.granted was written");
    assert.match(granted, /"userId":"0123456789abcdef01234567"/);
    assert.match(granted, /"role":"admin"/);
    assert.match(granted, /"reason":"role:admin"/);
    assert.match(granted, /"path":"\/api\/certificates\/0123456789abcdef01234567\/file"/);
  });

  it("a refused request writes access.denied and no access.granted", () => {
    const output = decide(AdminGuard, "org");
    assert.ok(line(output, "access.denied"));
    assert.equal(line(output, "access.granted"), undefined);
  });

  it("session-only routes log their admitted requests too", () => {
    const granted = line(decide(SessionGuard, "viewer"), "access.granted");
    assert.ok(granted);
    assert.match(granted, /"reason":"session"/);
  });
});
