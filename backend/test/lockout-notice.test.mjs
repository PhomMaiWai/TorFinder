// Unit coverage for ASVS 6.3.5: the failed sign-in that locks a real account
// emails its owner, once per lock, and an unknown address never sends mail
// (so the lock can't be used to learn which addresses have accounts).
// Loaded from dist like the other logic-only suites — run `npm run build` first.

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { ObjectId } from "mongodb";

import { AuthService } from "../dist/auth/auth.service.js";
import { LoginAttempts } from "../dist/auth/login-attempts.js";
import { env } from "../dist/config/env.js";

const LIMIT = env.throttle.loginFailureLimit;

/** An AuthService whose database knows one account (no password set, so every try fails) and whose mailer only records. */
function serviceWith(account) {
  const sent = [];
  const db = { users: { findOne: async ({ email }) => (account && email === account.email ? account : null) } };
  const links = { notify: async (email, notice) => sent.push({ email, notice }) };
  const service = new AuthService(db, links, {}, {});
  return { service, sent };
}

const tryLogin = (service, email) =>
  service.login({ email, password: "Wrong-password-1" }, "203.0.113.7").then(
    () => assert.fail("a wrong password must not sign in"),
    (error) => error.getStatus(),
  );

describe("LoginAttempts.recordFailure", () => {
  it("reports the lock exactly once, on the failure that reaches the limit", async () => {
    const attempts = new LoginAttempts();
    const results = [];
    for (let i = 0; i < LIMIT + 2; i += 1) results.push(await attempts.recordFailure("someone@example.com"));
    assert.deepEqual(
      results.map((locked, i) => (locked ? i + 1 : null)).filter(Boolean),
      [LIMIT],
    );
  });
});

describe("lockout notice (ASVS 6.3.5)", () => {
  it("emails the owner once when their account is locked, and refuses further tries with 429", async () => {
    const account = { _id: new ObjectId(), email: "owner@example.com" };
    const { service, sent } = serviceWith(account);

    for (let i = 0; i < LIMIT; i += 1) assert.equal(await tryLogin(service, account.email), 401);
    assert.equal(await tryLogin(service, account.email), 429);
    assert.equal(await tryLogin(service, account.email), 429);

    // notify() is not awaited by login; let it run.
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(sent, [{ email: account.email, notice: "login-locked" }]);
  });

  it("sends nothing for an address with no account, though it locks the same way", async () => {
    const { service, sent } = serviceWith(null);

    for (let i = 0; i < LIMIT; i += 1) assert.equal(await tryLogin(service, "nobody@example.com"), 401);
    assert.equal(await tryLogin(service, "nobody@example.com"), 429);

    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(sent, []);
  });
});
