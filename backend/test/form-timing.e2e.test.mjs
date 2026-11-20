// End-to-end coverage for ASVS 2.4.2: sign-up and comment forms must come back
// no sooner than a person could fill them in. The page issues a signed token
// saying when it was served; FormTimingGuard refuses a submission that is too
// fast, unsigned, forged, for another form, or a day old. Run in CI against a
// freshly booted backend + MongoDB.

import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import { MongoClient, ObjectId } from "mongodb";

import { formToken } from "./helpers/form-token.mjs";

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:4000";
const API = `${BASE_URL}/api`;
const mongo = new MongoClient(process.env.MONGODB_URI ?? "mongodb://localhost:27017/torfinder");
const RUN = Date.now();
let serial = 0;

// Each request from its own documentation address, so this suite never shares
// the sign-up rate limit (5 a minute per client) with itself or other suites.
const nextIp = () => `198.51.100.${(serial % 250) + 1}`;

async function post(path, body, token) {
  serial += 1;
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": nextIp(),
      ...(token !== undefined && { "x-form-token": token }),
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : undefined };
}

const signupBody = () => ({
  email: `ci+form-timing-${RUN}-${serial}@example.com`,
  password: "Correct-Horse-Battery-9",
  companyName: "บริษัท ทดสอบเวลา จำกัด",
  taxId: "0105563001236",
  contactName: "CI",
  phone: "0812345678",
});

before(() => mongo.connect());
after(async () => {
  await mongo.db().collection("users").deleteMany({ email: { $regex: `^ci\\+form-timing-${RUN}-` } });
  await mongo.close();
});

describe("sign-up form timing (ASVS 2.4.2)", () => {
  it("refuses a sign-up with no form token", async () => {
    const res = await post("/auth/signup", signupBody());
    assert.equal(res.status, 400);
    assert.match(res.body.message, /โหลดหน้าใหม่/);
  });

  it("refuses one sent back sooner than a person could fill it in", async () => {
    const res = await post("/auth/signup", signupBody(), formToken("signup", 0));
    assert.equal(res.status, 400);
    assert.match(res.body.message, /เร็วเกินไป/);
  });

  it("refuses a forged, other-form or day-old token", async () => {
    for (const token of [
      formToken("signup", 5000, "not-the-server-secret"),
      formToken("feedback"),
      formToken("signup", 25 * 60 * 60 * 1000),
      "garbage",
    ]) {
      assert.equal((await post("/auth/signup", signupBody(), token)).status, 400, token);
    }
  });

  it("accepts one filled in at a human pace", async () => {
    const res = await post("/auth/signup", signupBody(), formToken("signup"));
    assert.equal(res.status, 201, JSON.stringify(res.body));
  });
});

describe("comment form timing (ASVS 2.4.2)", () => {
  // The guard runs before the route looks the announcement up, so any id shows it.
  const path = `/tor/${new ObjectId()}/feedback`;
  const body = { text: "ความคิดเห็นทดสอบเรื่องเวลา", author: "CI" };

  it("refuses a comment with no token, or one sent too fast", async () => {
    assert.equal((await post(path, body)).status, 400);
    const fast = await post(path, body, formToken("feedback", 500));
    assert.equal(fast.status, 400);
    assert.match(fast.body.message, /เร็วเกินไป/);
  });

  it("lets a human-paced comment through to the route itself", async () => {
    // No such announcement: past the guard, the route answers for itself.
    assert.notEqual((await post(path, body, formToken("feedback"))).status, 400);
  });
});
