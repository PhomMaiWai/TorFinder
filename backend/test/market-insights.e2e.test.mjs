// End-to-end coverage for GET /api/insights/market (FR-24, #256), run in CI
// against a freshly booted backend + MongoDB. Awarded records are written
// straight into `tors` under an agency name no seed uses, so the assertions
// read only that agency's row; every row made here is removed after.

import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import { MongoClient } from "mongodb";

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:4000";
const API = `${BASE_URL}/api`;
const mongo = new MongoClient(process.env.MONGODB_URI ?? "mongodb://localhost:27017/torfinder");
const tors = () => mongo.db().collection("tors");

const RUN = Date.now();
const AGENCY = `สำนักงานทดสอบตลาด CI-${RUN}`;
const OTHER_AGENCY = `สำนักงานทดสอบตลาดอื่น CI-${RUN}`;
const VENDOR_A = `บริษัท ทดสอบเอ ${RUN} จำกัด`;
const VENDOR_B = `บริษัท ทดสอบบี ${RUN} จำกัด`;

/** One awarded record: e-GP shape, a reference price and a signed contract. */
function record(projectNumber, vendor, ratio, overrides = {}) {
  return {
    title: `จ้างพัฒนาระบบสารสนเทศ CI-${RUN}-${projectNumber}`,
    agency: AGENCY,
    budget: "฿1,000,000",
    deadline: "ไม่ระบุ",
    daysLeft: 0,
    match: 0,
    tags: [],
    stage: "ประกาศผู้ชนะ",
    summary: "บันทึกทดสอบ",
    createdAt: new Date("2025-02-01T00:00:00Z"),
    projectNumber: `CI-${RUN}-${projectNumber}`,
    referencePrice: 1_000_000,
    contracts: [
      {
        vendor,
        number: null,
        signedAt: new Date("2025-02-01T00:00:00Z"),
        amount: 1_000_000 * ratio,
        startsAt: null,
        endsAt: null,
        durationDays: null,
      },
    ],
    ...overrides,
  };
}

async function get(path) {
  const res = await fetch(`${API}${path}`);
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : undefined };
}

before(async () => {
  await mongo.connect();
  await tors().insertMany([
    record("1", VENDOR_A, 0.9),
    // A second stage record of project 1: must not count twice.
    record("1", VENDOR_A, 0.9, { stage: "ประกาศเชิญชวน", contracts: [] }),
    record("2", VENDOR_A, 0.8),
    record("3", VENDOR_A, 0.85),
    record("4", VENDOR_B, 0.95),
    // Hidden and not-software records stay out of the insights.
    record("5", VENDOR_B, 0.5, { deletedAt: new Date() }),
    record("6", VENDOR_B, 0.5, { classification: "not-software" }),
    record("7", VENDOR_B, 0.9, { agency: OTHER_AGENCY, createdAt: new Date("2023-05-01T00:00:00Z"), contracts: [{ vendor: VENDOR_B, number: null, signedAt: new Date("2023-05-01T00:00:00Z"), amount: 900_000, startsAt: null, endsAt: null, durationDays: null }] }),
  ]);
});

after(async () => {
  await tors().deleteMany({ title: { $regex: `CI-${RUN}-` } });
  await mongo.close();
});

describe("GET /api/insights/market", () => {
  it("is public and answers with the summary, winners and agencies", async () => {
    const res = await get("/insights/market");
    assert.equal(res.status, 200);
    for (const key of ["summary", "topWinners", "agencies", "discountBands", "years"]) {
      assert.ok(key in res.body, `missing ${key}`);
    }
    assert.equal(res.body.year, null);
  });

  it("counts each project once and skips hidden and not-software records", async () => {
    const { body } = await get("/insights/market");
    const row = body.agencies.find((agency) => agency.agency === AGENCY);
    assert.ok(row, "the test agency should be listed");
    assert.equal(row.projects, 4);
    assert.equal(row.withWinner, 4);
    assert.equal(row.distinctWinners, 2);
    assert.equal(row.topWinners[0].vendor, VENDOR_A);
    assert.equal(row.topWinners[0].wins, 3);
    assert.equal(row.topWinners[0].share, 0.75);
    assert.equal(row.competition, "low");
  });

  it("sets each award against the reference price", async () => {
    const { body } = await get("/insights/market");
    const row = body.agencies.find((agency) => agency.agency === AGENCY);
    assert.equal(row.priced, 4);
    // Discounts 10%, 20%, 15%, 5% — median 12.5%, mean 12.5%.
    assert.ok(Math.abs(row.medianDiscount - 0.125) < 1e-9, `median was ${row.medianDiscount}`);
    assert.ok(Math.abs(row.averageDiscount - 0.125) < 1e-9);
    assert.equal(row.priceCompetition, "moderate");
    assert.equal(row.totalAwarded, 3_500_000);
  });

  it("filters to the year an award was signed in", async () => {
    const { body } = await get("/insights/market?year=2023");
    assert.equal(body.year, 2023);
    assert.ok(body.years.includes(2023) && body.years.includes(2025));
    assert.ok(body.agencies.some((agency) => agency.agency === OTHER_AGENCY));
    assert.ok(!body.agencies.some((agency) => agency.agency === AGENCY));
  });

  it("rejects a year that is not a Christian-era year (400)", async () => {
    assert.equal((await get("/insights/market?year=abc")).status, 400);
    assert.equal((await get("/insights/market?year=2568.5")).status, 400);
    assert.equal((await get("/insights/market?year=3000")).status, 400);
  });
});
