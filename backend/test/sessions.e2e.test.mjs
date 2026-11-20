// ASVS 7.5.2: an account sees where it is signed in and can end any of those
// sessions, after giving its password again. ASVS 7.4.5: an admin can end
// every session of one account, or of every account. Run against the freshly
// booted backend + MongoDB, like the other e2e suites.

import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { after, before, describe, it } from "node:test";

import { MongoClient } from "mongodb";

import { passwordFields } from "../dist/common/password.js";

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:4000";
const API = `${BASE_URL}/api`;
const mongo = new MongoClient(process.env.MONGODB_URI ?? "mongodb://localhost:27017/torfinder");
const users = () => mongo.db().collection("users");
const sessions = () => mongo.db().collection("sessions");

const SESSION_SECRET = process.env.SESSION_SECRET ?? "dev-only-insecure-secret-change-me";
const PASSWORD = "Sessions-Check-4417";
// Its own client address, so these sign-ins don't share the per-IP login limit.
const CLIENT_IP = "198.51.100.213";

function mintAdminToken() {
  const now = Math.floor(Date.now() / 1000);
  const payload = { sub: "0123456789abcdef01234568", email: "admin@ci.test", name: "CI admin", role: "admin", iat: now, exp: now + 3600 };
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${data}.${createHmac("sha256", SESSION_SECRET).update(data).digest("base64url")}`;
}

async function api(path, { method = "GET", body, token, userAgent } = {}) {
  const headers = { "x-forwarded-for": CLIENT_IP };
  if (body !== undefined) headers["content-type"] = "application/json";
  if (token) headers.authorization = `Bearer ${token}`;
  // What the frontend forwards from the browser (auth.controller.ts).
  if (userAgent) headers["x-client-user-agent"] = userAgent;
  const res = await fetch(`${API}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : undefined };
}

const FIREFOX = "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0";
const SAFARI = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15";

/** An approved company with a password, written straight into the database. */
async function approvedCompany(created) {
  const email = `ci+sessions-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`;
  const { insertedId } = await users().insertOne({
    email,
    name: "CI Sessions Co",
    role: "org",
    status: "approved",
    emailVerified: true,
    ...(await passwordFields(PASSWORD)),
    company: { companyName: "CI Sessions Co", taxId: "0105563001244", contactName: "CI", phone: "0812345678", address: "1 CI Street", specialty: "software", size: "1-10 คน" },
    createdAt: new Date(),
  });
  created.push(insertedId);
  return { id: insertedId, email };
}

async function signIn(email, userAgent) {
  const login = await api("/auth/login", { method: "POST", body: { email, password: PASSWORD }, userAgent });
  assert.equal(login.status, 200, JSON.stringify(login.body));
  return login.body.token;
}

before(() => mongo.connect());
after(() => mongo.close());

describe("signed-in devices (ASVS 7.5.2)", () => {
  const created = [];
  after(async () => {
    await sessions().deleteMany({ userId: { $in: created } });
    await users().deleteMany({ _id: { $in: created } });
  });

  it("lists each session, marks this one, and shows no token", async () => {
    const company = await approvedCompany(created);
    await signIn(company.email, FIREFOX);
    const current = await signIn(company.email, SAFARI);

    const list = await api("/auth/sessions", { token: current });
    assert.equal(list.status, 200, JSON.stringify(list.body));
    assert.equal(list.body.needsPassword, true);
    assert.equal(list.body.sessions.length, 2);
    const [newest, older] = list.body.sessions;
    assert.equal(newest.current, true);
    assert.equal(older.current, false);
    assert.match(newest.device, /Safari/);
    assert.match(older.device, /Firefox/);
    assert.equal(newest.ip, CLIENT_IP);
    assert.ok(!JSON.stringify(list.body).includes(current), "the token itself is never listed");
  });

  it("ending the other sessions needs the password, and ends only them", async () => {
    const company = await approvedCompany(created);
    const other = await signIn(company.email, FIREFOX);
    const current = await signIn(company.email, SAFARI);

    const noPassword = await api("/auth/sessions/end-others", { method: "POST", token: current, body: {} });
    assert.equal(noPassword.status, 403);
    assert.equal(noPassword.body.code, "reauth-required");
    const wrong = await api("/auth/sessions/end-others", { method: "POST", token: current, body: { password: "not-the-password" } });
    assert.equal(wrong.status, 403);
    assert.equal((await api("/accounts/me", { token: other })).status, 200, "a refused request ends nothing");

    const ended = await api("/auth/sessions/end-others", { method: "POST", token: current, body: { password: PASSWORD } });
    assert.equal(ended.status, 200, JSON.stringify(ended.body));
    assert.equal(ended.body.ended, 1);
    assert.equal((await api("/accounts/me", { token: other })).status, 401);
    assert.equal((await api("/accounts/me", { token: current })).status, 200);
  });

  it("ends one chosen session, and never another account's", async () => {
    const company = await approvedCompany(created);
    const other = await signIn(company.email, FIREFOX);
    const current = await signIn(company.email, SAFARI);
    const { body } = await api("/auth/sessions", { token: current });
    const target = body.sessions.find((session) => !session.current);

    const stranger = await approvedCompany(created);
    const strangerToken = await signIn(stranger.email, FIREFOX);
    const theirs = await api(`/auth/sessions/${target.id}/end`, { method: "POST", token: strangerToken, body: { password: PASSWORD } });
    assert.equal(theirs.status, 400, "a session of another account is not found");
    assert.equal((await api("/accounts/me", { token: other })).status, 200);

    const ended = await api(`/auth/sessions/${target.id}/end`, { method: "POST", token: current, body: { password: PASSWORD } });
    assert.equal(ended.status, 200, JSON.stringify(ended.body));
    assert.equal((await api("/accounts/me", { token: other })).status, 401);
    assert.equal((await api("/accounts/me", { token: current })).status, 200);
  });

  it("GET /auth/session says whether this session is still open, for the frontend's page check", async () => {
    const company = await approvedCompany(created);
    const other = await signIn(company.email, FIREFOX);
    const current = await signIn(company.email, SAFARI);
    assert.equal((await api("/auth/session", { token: other })).status, 204);
    assert.equal((await api("/auth/session")).status, 401);

    await api("/auth/sessions/end-others", { method: "POST", token: current, body: { password: PASSWORD } });
    assert.equal((await api("/auth/session", { token: other })).status, 401);
    assert.equal((await api("/auth/session", { token: current })).status, 204);
  });

  it("a token that names a session not in the database is refused", async () => {
    const company = await approvedCompany(created);
    const token = await signIn(company.email, FIREFOX);
    const [data] = token.split(".");
    const payload = { ...JSON.parse(Buffer.from(data, "base64url").toString()), sid: "AAAAAAAAAAAAAAAAAAAAAA" };
    const forged = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const signed = `${forged}.${createHmac("sha256", SESSION_SECRET).update(forged).digest("base64url")}`;
    assert.equal((await api("/accounts/me", { token: signed })).status, 401);
  });
});

describe("admins end sessions (ASVS 7.4.5)", () => {
  const created = [];
  after(async () => {
    await sessions().deleteMany({ userId: { $in: created } });
    await users().deleteMany({ _id: { $in: created } });
  });

  it("an admin signs one account out everywhere", async () => {
    const company = await approvedCompany(created);
    const first = await signIn(company.email, FIREFOX);
    const second = await signIn(company.email, SAFARI);
    const bystander = await approvedCompany(created);
    const bystanderToken = await signIn(bystander.email, FIREFOX);

    const ended = await api(`/accounts/${company.id}/sessions/end`, { method: "POST", token: mintAdminToken() });
    assert.equal(ended.status, 200, JSON.stringify(ended.body));
    assert.equal((await api("/accounts/me", { token: first })).status, 401);
    assert.equal((await api("/accounts/me", { token: second })).status, 401);
    assert.equal((await api("/accounts/me", { token: bystanderToken })).status, 200, "other accounts keep their sessions");
  });

  it("only an admin may do it", async () => {
    const company = await approvedCompany(created);
    const token = await signIn(company.email, FIREFOX);
    assert.equal((await api(`/accounts/${company.id}/sessions/end`, { method: "POST", token })).status, 403);
    assert.equal((await api("/accounts/sessions/end-all", { method: "POST", token })).status, 403);
    assert.ok([401, 403].includes((await api("/accounts/sessions/end-all", { method: "POST" })).status));
  });

  it("an admin signs every account out at once", async () => {
    const one = await approvedCompany(created);
    const two = await approvedCompany(created);
    const oneToken = await signIn(one.email, FIREFOX);
    const twoToken = await signIn(two.email, SAFARI);

    const ended = await api("/accounts/sessions/end-all", { method: "POST", token: mintAdminToken() });
    assert.equal(ended.status, 200, JSON.stringify(ended.body));
    assert.ok(ended.body.accounts >= 2);
    assert.equal((await api("/accounts/me", { token: oneToken })).status, 401);
    assert.equal((await api("/accounts/me", { token: twoToken })).status, 401);

    // Signing in again works; wait out the second the floor was set in, as the suites after this one sign in too.
    await new Promise((resolve) => setTimeout(resolve, 1100));
    const again = await signIn(one.email, FIREFOX);
    assert.equal((await api("/accounts/me", { token: again })).status, 200);
  });
});
