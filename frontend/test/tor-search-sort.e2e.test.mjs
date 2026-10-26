// End-to-end coverage for the search order (src/lib/tor-sort.ts): the default
// puts a TOR with time to prepare first and one closing tomorrow below it, and
// each `?sort=` renders the order it names.
//
// Same approach as tor-timeline.e2e.test.mjs: records go straight into the
// `tors` collection, and the server-rendered /public page is read for the order
// of the card titles. The open/closed state is the backend's (tor-bidding.ts),
// so the records carry the evidence it reads: an invitation with a closing
// date the model read from the document, and the invitation notice's date.
//
// Requires, all pointed at the same database (a fresh one — the records must be
// the only ones, so they all fit on the first page):
//   - a running backend
//   - E2E_FRONTEND_URL  a running `next start` of this app (default http://localhost:3000)
//   - MONGODB_URI       the database both are using
// The search caches the listing for 30s, so run it against a frontend that has
// not rendered /public in the last 30 seconds.

import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import { MongoClient } from "mongodb";

const FRONTEND_URL = process.env.E2E_FRONTEND_URL ?? "http://localhost:3000";
const MONGODB_URI = process.env.MONGODB_URI ?? "mongodb://torr:torr@localhost:27017/torr?authSource=admin";

const PREFIX = "SORT-E2E";
const INVITATION = "ประกาศ TOR";
const AWARD = "ประกาศผู้ชนะ";
const DAY = 24 * 60 * 60 * 1000;

/** The Bangkok calendar date `days` from now, as the ISO date the model writes. */
function bangkokDate(days) {
  return new Date(Date.now() + 7 * 60 * 60 * 1000 + days * DAY).toISOString().slice(0, 10);
}

/** An invitation open until `closesIn` days from now, announced `openedAgo` days ago. */
function openTor(name, { closesIn, openedAgo, budget }) {
  return {
    ...base(name, budget),
    stage: INVITATION,
    extraction: { deadline: bangkokDate(closesIn) },
    documents: [
      { label: "ประกาศเชิญชวน", publishedAt: new Date(Date.now() - openedAgo * DAY), url: "https://example.test/d0" },
    ],
  };
}

function base(name, budget) {
  return {
    title: `${PREFIX} ${name}`,
    agency: "CI agency",
    budget,
    deadline: "\u0e44\u0e21\u0e48\u0e23\u0e30\u0e1a\u0e38",
    daysLeft: 0,
    match: 0,
    tags: [],
    summary: "",
    createdAt: new Date(),
  };
}

const RECORDS = [
  // Open, but closing tomorrow: too little time to prepare.
  openTor("closing-tomorrow", { closesIn: 1, openedAgo: 2, budget: "฿2,000,000" }),
  // Open with time to prepare; the newer of the two leads.
  openTor("ten-days", { closesIn: 10, openedAgo: 5, budget: "฿9,000,000" }),
  openTor("twenty-days-new", { closesIn: 20, openedAgo: 1, budget: "฿1,000,000" }),
  // No closing date: the backend can't say it is open.
  { ...base("unknown", "฿5,000,000"), stage: INVITATION },
  // Already decided.
  { ...base("awarded", "฿50,000,000"), stage: AWARD },
];

/** The record names in the order their cards appear on the rendered page. */
async function order(query = "") {
  const res = await fetch(`${FRONTEND_URL}/public${query}`, { headers: { cookie: "NEXT_LOCALE=en" } });
  assert.equal(res.status, 200);
  const html = await res.text();
  const pattern = new RegExp(`<h3[^>]*>${PREFIX} ([a-z-]+)</h3>`, "g");
  return [...html.matchAll(pattern)].map((match) => match[1]);
}

let mongo;

before(async () => {
  mongo = new MongoClient(MONGODB_URI);
  await mongo.connect();
  await mongo.db().collection("tors").insertMany(RECORDS);
});

after(async () => {
  await mongo.db().collection("tors").deleteMany({ title: { $regex: `^${PREFIX} ` } });
  await mongo.close();
});

describe("search order", () => {
  it("by default, open with time to prepare first (newest opened first), closing tomorrow after, then unknown, then closed", async () => {
    assert.deepEqual(await order(), ["twenty-days-new", "ten-days", "closing-tomorrow", "unknown", "awarded"]);
  });

  it("?sort=closing restores soonest-closing first", async () => {
    assert.deepEqual(await order("?sort=closing"), ["closing-tomorrow", "ten-days", "twenty-days-new", "unknown", "awarded"]);
  });

  it("?sort=newest lists open TORs by when they opened", async () => {
    assert.deepEqual(await order("?sort=newest"), ["twenty-days-new", "closing-tomorrow", "ten-days", "unknown", "awarded"]);
  });

  it("?sort=budget lists the largest amount first", async () => {
    assert.deepEqual(await order("?sort=budget"), ["awarded", "ten-days", "unknown", "closing-tomorrow", "twenty-days-new"]);
  });

  it("an unknown ?sort= falls back to the default", async () => {
    assert.deepEqual(await order("?sort=bogus"), await order());
  });
});
