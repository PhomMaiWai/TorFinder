// ASVS 16.3.1: a company account created through Google sign-up leaves an
// `auth.signup` line in the security log, like a password sign-up does, and
// a refused duplicate is logged as a failure. CI can't mint a token Google
// signed, so the token check and the database are stubbed and the service is
// called directly. Loaded from dist — run `npm run build` first.

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { MongoServerError, ObjectId } from "mongodb";

import { AuthService } from "../dist/auth/auth.service.js";

function captureOutput(fn) {
  const chunks = [];
  const out = process.stdout.write.bind(process.stdout);
  const err = process.stderr.write.bind(process.stderr);
  process.stdout.write = (chunk) => (chunks.push(String(chunk)), true);
  process.stderr.write = (chunk) => (chunks.push(String(chunk)), true);
  return fn().finally(() => {
    process.stdout.write = out;
    process.stderr.write = err;
  }).then(
    (value) => ({ value, output: chunks.join("") }),
    (error) => ({ error, output: chunks.join("") }),
  );
}

const IDENTITY = { email: "new-company@example.com", googleId: "google-123", name: "New Company" };
const COMPANY = {
  companyName: "บริษัท ใหม่ จำกัด",
  taxId: "0105563001236",
  contactName: "CI",
  phone: "0812345678",
  address: "1 CI Street",
  specialty: "software",
  size: "1-10 คน",
};

/** An AuthService whose Google check always passes and whose database knows no account. */
function serviceWith(insertOne) {
  const db = { users: { findOne: async () => null, updateOne: async () => ({}), insertOne } };
  const service = new AuthService(db, { notify: async () => {} }, {}, {});
  service.verifyGoogleCredential = async () => IDENTITY;
  return service;
}

const signupLine = (output) => output.split("\n").find((line) => line.includes('"auth.signup"'));

describe("Google company sign-up is logged (ASVS 16.3.1)", () => {
  it("writes auth.signup success with the new account's id and reason google", async () => {
    const insertedId = new ObjectId();
    const service = serviceWith(async () => ({ insertedId }));
    const { value, output } = await captureOutput(() =>
      service.googleCompleteSignup({ credential: "token", nonce: "n".repeat(32), ...COMPANY }, "203.0.113.5"),
    );
    assert.deepEqual(value, { status: "pending", companyName: COMPANY.companyName });
    const line = signupLine(output);
    assert.ok(line, "an auth.signup event was written");
    assert.match(line, /"outcome":"success"/);
    assert.match(line, new RegExp(insertedId.toString()));
    assert.match(line, /"reason":"google"/);
    assert.match(line, /new-company@example\.com/);
  });

  it("logs a duplicate address as a failed sign-up and still answers 409", async () => {
    const duplicate = new MongoServerError({ message: "E11000 duplicate key", code: 11000 });
    const service = serviceWith(async () => {
      throw duplicate;
    });
    const { error, output } = await captureOutput(() =>
      service.googleCompleteSignup({ credential: "token", nonce: "n".repeat(32), ...COMPANY }, "203.0.113.5"),
    );
    assert.equal(error?.getStatus?.(), 409);
    const line = signupLine(output);
    assert.ok(line, "an auth.signup event was written");
    assert.match(line, /"outcome":"failure"/);
    assert.match(line, /"reason":"google_duplicate_email"/);
  });
});
