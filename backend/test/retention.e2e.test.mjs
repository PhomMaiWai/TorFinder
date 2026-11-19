// ASVS 14.2.7: data with no further use is deleted on a schedule. The backend
// sets the schedule as TTL indexes when it starts; this checks they exist with
// the documented periods (docs/operations/limits-and-retention.md), and that
// the sign-up rule can only ever match an unconfirmed, unreviewed account.
// Run against the freshly booted backend + MongoDB, like the other e2e suites.

import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import { MongoClient } from "mongodb";

const mongo = new MongoClient(process.env.MONGODB_URI ?? "mongodb://localhost:27017/torfinder");
const db = () => mongo.db();
const DAY = 24 * 60 * 60;

/** The period each TTL index should have: the env override when CI sets one, else the documented default. */
const days = (name, fallback) => Number(process.env[name] || fallback);

const ttlIndex = async (collection, name) =>
  (await db().collection(collection).listIndexes().toArray()).find((index) => index.name === name);

before(() => mongo.connect());
after(() => mongo.close());

describe("retention (ASVS 14.2.7)", () => {
  const expected = [
    ["notifications", "retention_notifications", "createdAt", days("RETENTION_NOTIFICATIONS_DAYS", 180)],
    ["syncRuns", "retention_sync_runs", "startedAt", days("RETENTION_SYNC_RUNS_DAYS", 90)],
    ["auditLogEntries", "retention_audit_log", "createdAt", days("RETENTION_AUDIT_LOG_DAYS", 365)],
    ["users", "retention_unverified_signups", "createdAt", days("RETENTION_UNVERIFIED_SIGNUP_DAYS", 30)],
  ];

  for (const [collection, name, field, period] of expected) {
    it(`deletes ${collection} after ${period} days`, async () => {
      const index = await ttlIndex(collection, name);
      assert.ok(index, `${name} exists`);
      assert.deepEqual(index.key, { [field]: 1 });
      assert.equal(index.expireAfterSeconds, period * DAY);
    });
  }

  it("removes only accounts that are unconfirmed and still pending", async () => {
    const index = await ttlIndex("users", "retention_unverified_signups");
    assert.deepEqual(index.partialFilterExpression, { emailVerified: false, status: "pending" });
  });

  it("still expires emailed links the moment they lapse", async () => {
    const index = (await db().collection("authTokens").listIndexes().toArray()).find(
      (candidate) => candidate.key.expiresAt === 1,
    );
    assert.equal(index?.expireAfterSeconds, 0);
  });
});
