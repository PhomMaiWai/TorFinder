// Unit coverage for the per-address sign-in lock (ASVS 6.3.1) and the moment
// it tells the owner (ASVS 6.3.5). Imported from the compiled build (run
// after `npm run build`).

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { env } from "../dist/config/env.js";
import { LoginAttempts } from "../dist/auth/login-attempts.js";

const LIMIT = env.throttle.loginFailureLimit;

describe("LoginAttempts", () => {
  it("reports the lockout once: on the failure that reaches the limit", () => {
    const attempts = new LoginAttempts();
    const signals = Array.from({ length: LIMIT + 3 }, () => attempts.recordFailure("a@example.com"));
    assert.deepEqual(
      signals.map((locked, i) => (locked ? i + 1 : 0)).filter(Boolean),
      [LIMIT],
      "only the limit-th failure locks; later guesses while locked don't re-notify",
    );
    assert.throws(() => attempts.assertAllowed("a@example.com"), { status: 429 });
  });

  it("counts each address on its own", () => {
    const attempts = new LoginAttempts();
    for (let i = 0; i < LIMIT; i += 1) attempts.recordFailure("a@example.com");
    assert.equal(attempts.recordFailure("b@example.com"), LIMIT === 1);
    assert.doesNotThrow(() => attempts.assertAllowed("b@example.com"));
  });

  it("a correct password clears the count, so a later lockout notifies again", () => {
    const attempts = new LoginAttempts();
    for (let i = 0; i < LIMIT - 1; i += 1) attempts.recordFailure("a@example.com");
    attempts.recordSuccess("a@example.com");
    for (let i = 0; i < LIMIT - 1; i += 1) assert.equal(attempts.recordFailure("a@example.com"), false);
    assert.equal(attempts.recordFailure("a@example.com"), true);
  });
});
