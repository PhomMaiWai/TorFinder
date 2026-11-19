// ASVS 11.4.2 and 11.2.2: password hashes record the scrypt settings they were
// made with, and a hash from before the stronger settings is redone at the
// owner's next correct sign-in. Run against the freshly booted backend +
// MongoDB, like the other e2e suites.

import assert from "node:assert/strict";
import { randomBytes, scrypt } from "node:crypto";
import { after, before, describe, it } from "node:test";

import { MongoClient } from "mongodb";

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:4000";
const mongo = new MongoClient(process.env.MONGODB_URI ?? "mongodb://localhost:27017/torfinder");
const users = () => mongo.db().collection("users");

const PASSWORD = "Rehash-Check-2741";
// Its own client address (trusted from loopback), so the suite's sign-ins don't
// share the per-IP login limit with the suites that ran before it.
const CLIENT_IP = "198.51.100.211";

/** A hash made the old way: Node's scrypt defaults (N=16384, r=8, p=1), no settings stored. */
function legacyHash(password) {
  const salt = randomBytes(16).toString("hex");
  return new Promise((resolve, reject) =>
    scrypt(password, salt, 64, (error, key) => (error ? reject(error) : resolve({ passwordHash: key.toString("hex"), passwordSalt: salt }))),
  );
}

const login = (email, password) =>
  fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": CLIENT_IP },
    body: JSON.stringify({ email, password }),
  });

before(() => mongo.connect());
after(() => mongo.close());

describe("password hash upgrade (ASVS 11.4.2, 11.2.2)", () => {
  const email = `ci+rehash-${Date.now()}@example.com`;
  let old;

  before(async () => {
    old = await legacyHash(PASSWORD);
    await users().insertOne({
      email,
      name: "CI Rehash Co",
      role: "org",
      status: "approved",
      emailVerified: true,
      ...old,
      createdAt: new Date(),
    });
  });
  after(() => users().deleteOne({ email }));

  it("signs in with a hash made under the old settings", async () => {
    const res = await login(email, PASSWORD);
    assert.equal(res.status, 200, await res.text());
  });

  it("then stores a new hash, with the settings it was made with", async () => {
    const user = await users().findOne({ email });
    assert.notEqual(user.passwordHash, old.passwordHash);
    assert.notEqual(user.passwordSalt, old.passwordSalt);
    assert.deepEqual(user.passwordParams, { alg: "scrypt", N: 16384, r: 8, p: 5 });
  });

  it("and the same password still works with the new hash, a wrong one still doesn't", async () => {
    assert.equal((await login(email, PASSWORD)).status, 200);
    assert.equal((await login(email, "Wrong-Password-000")).status, 401);
  });

  it("leaves a current hash alone at the next sign-in", async () => {
    const before = await users().findOne({ email });
    assert.equal((await login(email, PASSWORD)).status, 200);
    const after = await users().findOne({ email });
    assert.equal(after.passwordHash, before.passwordHash);
  });
});
