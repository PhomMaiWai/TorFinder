// End-to-end coverage for staff passkeys (ASVS 6.3.3 at Level 3, 7.5.3),
// run in CI against a freshly booted backend + MongoDB.
//
// A software authenticator (helpers/software-authenticator.mjs) plays the
// user's device, so registration and sign-in go through the real WebAuthn
// verification. The staff account is inserted straight into `users`, and
// admin tokens are minted, to stay off the seeded accounts other files use.
// CI runs with STAFF_PASSKEYS_REQUIRED off: passkeys are then opt-in, but an
// account that has one must always use it — which is what is tested here.

import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { after, before, describe, it } from "node:test";

import { MongoClient, ObjectId } from "mongodb";

import { hashPassword } from "../dist/common/password.js";
import { SoftwareAuthenticator } from "./helpers/software-authenticator.mjs";

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:4000";
const API = `${BASE_URL}/api`;
const ORIGIN = process.env.FRONTEND_ORIGIN ?? "http://localhost:3000";
const SESSION_SECRET = process.env.SESSION_SECRET ?? "dev-only-insecure-secret-change-me";
const mongo = new MongoClient(process.env.MONGODB_URI ?? "mongodb://localhost:27017/torfinder");
const users = () => mongo.db().collection("users");

const PASSWORD = "correct horse battery staple 42";
// Its own client address (believed from loopback, as the frontend relay
// would send it), so this file's sign-ins get their own rate-limit bucket
// instead of sharing the one the rest of the suite has used up.
const CLIENT_IP = `198.51.100.${10 + (process.pid % 200)}`;
const created = [];

async function api(path, { method = "GET", body, token } = {}) {
  const headers = { "x-forwarded-for": CLIENT_IP };
  if (body !== undefined) headers["content-type"] = "application/json";
  if (token) headers.authorization = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : undefined };
}

const claims = (token) => JSON.parse(Buffer.from(token.split(".")[0], "base64url").toString());

/** A token as the backend would sign it, for an admin that doesn't need to exist. */
function mintToken(fields) {
  const iat = Math.floor(Date.now() / 1000);
  const payload = {
    sub: new ObjectId().toString(),
    email: `admin+passkeys-${iat}@ci.test`,
    name: "CI Admin",
    role: "admin",
    iat,
    act: iat,
    exp: iat + 3600,
    ...fields,
  };
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${data}.${createHmac("sha256", SESSION_SECRET).update(data).digest("base64url")}`;
}

let serial = 0;
async function insertUser(role) {
  serial += 1;
  const { hash, salt } = await hashPassword(PASSWORD);
  const doc = {
    email: `ci+passkey-${Date.now()}-${serial}@example.com`,
    name: `CI Passkey ${serial}`,
    role,
    status: "approved",
    emailVerified: true,
    passwordHash: hash,
    passwordSalt: salt,
    createdAt: new Date(),
  };
  const { insertedId } = await users().insertOne(doc);
  created.push(insertedId);
  return { ...doc, id: insertedId.toString() };
}

const login = (email) => api("/auth/login", { method: "POST", body: { email, password: PASSWORD } });

/** Adds a passkey with a session that is allowed to; returns the re-signed token. */
async function enrol(token, device, name = "CI laptop") {
  const options = await api("/auth/passkeys/options", { method: "POST", token });
  assert.equal(options.status, 200, JSON.stringify(options.body));
  const added = await api("/auth/passkeys", {
    method: "POST",
    token,
    body: { name, response: device.register(options.body) },
  });
  assert.equal(added.status, 201, JSON.stringify(added.body));
  return added.body;
}

/** Password, then passkey: the whole staff sign-in. */
async function signInWithPasskey(email, device) {
  const first = await login(email);
  assert.equal(first.status, 200);
  assert.equal(first.body.status, "passkey-required");
  const second = await api("/auth/passkey/login", {
    method: "POST",
    body: { response: device.authenticate(first.body.options) },
  });
  assert.equal(second.status, 200, JSON.stringify(second.body));
  return second.body.token;
}

before(() => mongo.connect());
after(async () => {
  await users().deleteMany({ _id: { $in: created } });
  await mongo.close();
});

describe("staff passkeys", () => {
  let owner;
  let device;

  before(async () => {
    owner = await insertUser("owner");
    device = new SoftwareAuthenticator(ORIGIN);
  });

  it("a staff account without a passkey signs in with its password, as before", async () => {
    const res = await login(owner.email);
    assert.equal(res.status, 200);
    assert.ok(res.body.token);
    assert.deepEqual(claims(res.body.token).amr, ["pwd"]);
  });

  it("adds a first passkey, and the session comes back passkey-verified", async () => {
    const { body } = await login(owner.email);
    const added = await enrol(body.token, device);
    assert.equal(added.passkeys.length, 1);
    assert.equal(added.passkeys[0].name, "CI laptop");
    assert.equal(added.passkeys[0].publicKey, undefined, "the public key stays on the server");
    const session = claims(added.token);
    assert.deepEqual(session.amr, ["pwd", "passkey"]);
    assert.ok(session.pkt > 0);
    assert.equal(session.iat, claims(body.token).iat, "re-signing keeps iat");
    assert.equal(session.exp, claims(body.token).exp, "re-signing keeps the absolute lifetime");
  });

  it("then asks for the passkey after the password, instead of a session", async () => {
    const res = await login(owner.email);
    assert.equal(res.status, 200);
    assert.equal(res.body.token, undefined);
    assert.equal(res.body.status, "passkey-required");
    assert.deepEqual(res.body.options.allowCredentials.map((c) => c.id), [device.id]);
  });

  it("signs in once the passkey signs the challenge", async () => {
    const token = await signInWithPasskey(owner.email, device);
    const session = claims(token);
    assert.deepEqual(session.amr, ["pwd", "passkey"]);
    assert.equal(session.role, "owner");
    assert.equal((await api("/owner/tors", { token })).status, 200);
  });

  it("refuses a replayed answer: each challenge works once", async () => {
    const first = await login(owner.email);
    const response = device.authenticate(first.body.options);
    const ok = await api("/auth/passkey/login", { method: "POST", body: { response } });
    assert.equal(ok.status, 200);
    const replay = await api("/auth/passkey/login", { method: "POST", body: { response } });
    assert.equal(replay.status, 401);
  });

  it("refuses a key that isn't registered to the account", async () => {
    const first = await login(owner.email);
    const stranger = new SoftwareAuthenticator(ORIGIN);
    const res = await api("/auth/passkey/login", {
      method: "POST",
      body: { response: stranger.authenticate(first.body.options) },
    });
    assert.equal(res.status, 401);
  });

  it("refuses an answer made for another site (phishing)", async () => {
    const first = await login(owner.email);
    const res = await api("/auth/passkey/login", {
      method: "POST",
      body: { response: device.authenticate(first.body.options, { origin: "https://torfinder.example.evil" }) },
    });
    assert.equal(res.status, 401);
  });

  it("refuses a signature counter that went backwards (a cloned key)", async () => {
    const first = await login(owner.email);
    const res = await api("/auth/passkey/login", {
      method: "POST",
      body: { response: device.authenticate(first.body.options, { counter: 1 }) },
    });
    assert.equal(res.status, 401);
  });

  it("doesn't accept a step-up challenge as a sign-in", async () => {
    const token = await signInWithPasskey(owner.email, device);
    const options = await api("/auth/step-up/options", { method: "POST", token });
    assert.equal(options.status, 200);
    const res = await api("/auth/passkey/login", {
      method: "POST",
      body: { response: device.authenticate(options.body) },
    });
    assert.equal(res.status, 401);
  });

  it("a second passkey needs a recent passkey check, not just the password", async () => {
    const token = await signInWithPasskey(owner.email, device);
    const stale = mintToken({
      ...claims(token),
      pkt: Math.floor(Date.now() / 1000) - 3600,
    });
    const refused = await api("/auth/passkeys/options", { method: "POST", token: stale });
    assert.equal(refused.status, 403);
    assert.equal(refused.body.code, "step-up-required");

    const second = new SoftwareAuthenticator(ORIGIN);
    const added = await enrol(token, second, "CI phone");
    assert.equal(added.passkeys.length, 2);
  });

  it("step-up re-signs the session with a fresh check", async () => {
    const token = await signInWithPasskey(owner.email, device);
    const options = await api("/auth/step-up/options", { method: "POST", token });
    const res = await api("/auth/step-up", {
      method: "POST",
      token,
      body: { response: device.authenticate(options.body) },
    });
    assert.equal(res.status, 200);
    assert.ok(claims(res.body.token).pkt >= claims(token).pkt);
    assert.equal(claims(res.body.token).iat, claims(token).iat);
  });

  it("removing a passkey needs a recent check; the account keeps the other", async () => {
    const token = await signInWithPasskey(owner.email, device);
    const list = await api("/auth/passkeys", { token });
    const phone = list.body.find((passkey) => passkey.name === "CI phone");
    const stale = mintToken({ ...claims(token), pkt: Math.floor(Date.now() / 1000) - 3600 });
    assert.equal((await api(`/auth/passkeys/${phone.id}`, { method: "DELETE", token: stale })).status, 403);
    const removed = await api(`/auth/passkeys/${phone.id}`, { method: "DELETE", token });
    assert.equal(removed.status, 200);
    assert.deepEqual(removed.body.map((passkey) => passkey.id), [device.id]);
  });

  it("a company account can't add a passkey (staff only)", async () => {
    const org = await insertUser("org");
    const { body } = await login(org.email);
    assert.equal((await api("/auth/passkeys/options", { method: "POST", token: body.token })).status, 403);
  });
});

describe("step-up on sensitive admin actions", () => {
  let target;
  before(async () => {
    target = await insertUser("org");
  });

  it("refuses a passkey admin whose last check is too old", async () => {
    const token = mintToken({ amr: ["pwd", "passkey"], pkt: Math.floor(Date.now() / 1000) - 3600 });
    const res = await api(`/accounts/${target.id}/suspend`, { method: "PATCH", token });
    assert.equal(res.status, 403);
    assert.equal(res.body.code, "step-up-required");
  });

  it("allows it right after a passkey check", async () => {
    const token = mintToken({ amr: ["pwd", "passkey"], pkt: Math.floor(Date.now() / 1000) });
    assert.equal((await api(`/accounts/${target.id}/suspend`, { method: "PATCH", token })).status, 200);
    assert.equal((await api(`/accounts/${target.id}/reactivate`, { method: "PATCH", token })).status, 200);
  });

  it("with passkeys optional, an admin who never added one isn't blocked", async () => {
    const token = mintToken({ amr: ["pwd"] });
    assert.equal((await api(`/accounts/${target.id}/suspend`, { method: "PATCH", token })).status, 200);
    assert.equal((await api(`/accounts/${target.id}/reactivate`, { method: "PATCH", token })).status, 200);
  });
});

describe("admin passkey reset", () => {
  it("clears the passkeys and ends the staff member's sessions", async () => {
    const auditor = await insertUser("auditor");
    const device = new SoftwareAuthenticator(ORIGIN);
    const { body } = await login(auditor.email);
    await enrol(body.token, device);
    const session = await signInWithPasskey(auditor.email, device);

    const admin = mintToken({ amr: ["pwd", "passkey"], pkt: Math.floor(Date.now() / 1000) });
    const reset = await api(`/accounts/${auditor.id}/passkeys/reset`, { method: "POST", token: admin });
    assert.equal(reset.status, 200, JSON.stringify(reset.body));

    assert.equal((await api("/auth/passkeys", { token: session })).status, 401, "old sessions are revoked");
    // Revocation is per second; the next sign-in must come after it.
    await new Promise((resolve) => setTimeout(resolve, 1100));
    const again = await login(auditor.email);
    assert.ok(again.body.token, "signs in with the password and can add a new passkey");
    assert.deepEqual((await api("/auth/passkeys", { token: again.body.token })).body, []);
  });

  it("needs step-up, and nobody can reset their own", async () => {
    const someone = await insertUser("owner");
    const stale = mintToken({ amr: ["pwd", "passkey"], pkt: Math.floor(Date.now() / 1000) - 3600 });
    assert.equal((await api(`/accounts/${someone.id}/passkeys/reset`, { method: "POST", token: stale })).status, 403);

    const selfId = new ObjectId().toString();
    const self = mintToken({ sub: selfId, amr: ["pwd", "passkey"], pkt: Math.floor(Date.now() / 1000) });
    assert.equal((await api(`/accounts/${selfId}/passkeys/reset`, { method: "POST", token: self })).status, 400);
  });
});
