// End-to-end coverage for saved searches, run in CI against a freshly booted
// backend + MongoDB. Tokens are minted for two made-up accounts (the session
// guard needs no user row), and their rows are removed after.

import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { after, before, describe, it } from "node:test";

import { MongoClient, ObjectId } from "mongodb";

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:4000";
const API = `${BASE_URL}/api`;
const SESSION_SECRET =
  process.env.SESSION_SECRET ?? "dev-only-insecure-secret-change-me";
const mongo = new MongoClient(
  process.env.MONGODB_URI ?? "mongodb://localhost:27017/torfinder",
);

function makeToken(role, sub) {
  const payload = {
    sub,
    email: `${sub}@ci.test`,
    name: `CI ${role}`,
    role,
    exp: Math.floor(Date.now() / 1000) + 3600,
  };
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${data}.${createHmac("sha256", SESSION_SECRET).update(data).digest("base64url")}`;
}

const ALICE = new ObjectId();
const BOB = new ObjectId();
const aliceToken = makeToken("org", ALICE.toString());
const bobToken = makeToken("viewer", BOB.toString());

async function api(path, { method = "GET", body, token } = {}) {
  const headers = {};
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

const save = (body, token = aliceToken) =>
  api("/saved-searches", { method: "POST", token, body });
const list = (token = aliceToken) => api("/saved-searches", { token });
const remove = (id, token = aliceToken) =>
  api(`/saved-searches/${id}`, { method: "DELETE", token });

const FILTERS = {
  query: "ระบบสารสนเทศ",
  sort: "closing",
  statuses: ["bidding"],
  deadline: "7d",
  years: [2569],
  agencies: ["กรุงเทพมหานคร"],
  budgets: ["1m-5m"],
};

before(() => mongo.connect());
after(async () => {
  await mongo
    .db()
    .collection("savedSearches")
    .deleteMany({ userId: { $in: [ALICE, BOB] } });
  await mongo.close();
});

describe("saved searches", () => {
  it("needs a session", async () => {
    assert.equal((await api("/saved-searches")).status, 401);
    assert.equal(
      (
        await api("/saved-searches", {
          method: "POST",
          body: { name: "x", filters: {} },
        })
      ).status,
      401,
    );
  });

  it("saves a search and hands back its filters as given", async () => {
    const res = await save({ name: "  งานซอฟต์แวร์ กทม.  ", filters: FILTERS });
    assert.equal(res.status, 201);
    assert.equal(res.body.name, "งานซอฟต์แวร์ กทม.");
    assert.deepEqual(res.body.filters, FILTERS);
    assert.ok(ObjectId.isValid(res.body.id));
  });

  it("lists the account's own searches, newest first", async () => {
    await save({ name: "ล่าสุด", filters: { query: "cloud" } });
    const res = await list();
    assert.equal(res.status, 200);
    assert.deepEqual(
      res.body.map((s) => s.name),
      ["ล่าสุด", "งานซอฟต์แวร์ กทม."],
    );
  });

  it("drops fields the search page doesn't send", async () => {
    const res = await save({
      name: "ตัดฟิลด์",
      filters: { query: "a", userId: "x", $where: "1" },
      extra: true,
    });
    assert.equal(res.status, 201);
    assert.deepEqual(res.body.filters, { query: "a" });
    assert.equal(res.body.extra, undefined);
  });

  it("refuses a duplicate name for the same account, but not for another", async () => {
    assert.equal((await save({ name: "ล่าสุด", filters: {} })).status, 409);
    assert.equal(
      (await save({ name: "ล่าสุด", filters: {} }, bobToken)).status,
      201,
    );
  });

  it("refuses a blank name, missing filters and malformed filter values", async () => {
    assert.equal((await save({ name: "   ", filters: {} })).status, 400);
    assert.equal((await save({ name: "ไม่มีตัวกรอง" })).status, 400);
    assert.equal(
      (await save({ name: "ปีผิด", filters: { years: ["2569"] } })).status,
      400,
    );
    assert.equal(
      (await save({ name: "ยาวไป", filters: { query: "ก".repeat(201) } }))
        .status,
      400,
    );
    assert.equal(
      (await save({ name: "สถานะผิด", filters: { statuses: "bidding" } }))
        .status,
      400,
    );
  });

  it("keeps accounts apart: another account neither sees nor deletes them", async () => {
    const bobs = (await list(bobToken)).body;
    assert.deepEqual(
      bobs.map((s) => s.name),
      ["ล่าสุด"],
    );

    const alices = (await list()).body;
    assert.equal((await remove(alices[0].id, bobToken)).status, 404);
    assert.equal((await list()).body.length, alices.length);
  });

  it("deletes one of the account's own, once", async () => {
    const [first] = (await list()).body;
    assert.equal((await remove(first.id)).status, 204);
    assert.equal((await remove(first.id)).status, 404);
    assert.ok(!(await list()).body.some((s) => s.id === first.id));
    assert.equal((await remove("not-an-id")).status, 404);
  });

  it("caps how many one account can keep", async () => {
    const carol = makeToken("viewer", new ObjectId().toString());
    const owner = JSON.parse(
      Buffer.from(carol.split(".")[0], "base64url").toString(),
    ).sub;
    try {
      await mongo
        .db()
        .collection("savedSearches")
        .insertMany(
          Array.from({ length: 50 }, (_, i) => ({
            userId: new ObjectId(owner),
            name: `เก่า ${i}`,
            filters: {},
            createdAt: new Date(),
          })),
        );
      const res = await save({ name: "ใบที่ 51", filters: {} }, carol);
      assert.equal(res.status, 409);
      assert.match(res.body.message, /50/);
    } finally {
      await mongo
        .db()
        .collection("savedSearches")
        .deleteMany({ userId: new ObjectId(owner) });
    }
  });
});
