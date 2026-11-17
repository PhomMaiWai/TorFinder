// Unit coverage for the growth path (#261) — imported from the compiled build
// (run after `npm run build`, as CI does), like market-insights.test.mjs.

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildGrowthPath, capOf, STARTER_CAP } from "../dist/insights/growth-path.js";

let serial = 0;
/** One awarded project at `agency`, won by `vendor` for `amount` baht, signed in `year`. */
function award(agency, vendor, amount, year = 2025) {
  serial += 1;
  return {
    agency,
    projectNumber: `G-${serial}`,
    budgetAmount: amount,
    contracts: vendor ? [{ vendor, amount, signedAt: new Date(`${year}-03-01T00:00:00Z`) }] : [],
  };
}

/** One open announcement as the matching dashboard returns it. */
function job(id, agency, budgetAmount, match = 50, status = "open") {
  return { id, title: `งาน ${id}`, agency, budgetAmount, daysLeft: 10, match, bidding: { status, closesAt: null } };
}

const company = { largestPastContract: 1_000_000 };
const names = (path) => path.agencies.map((row) => row.agency);

describe("capOf", () => {
  it("uses the largest past contract first", () => {
    assert.deepEqual(capOf({ largestPastContract: 2_000_000, preferredBudgetMax: 9_000_000 }), {
      cap: 2_000_000,
      capSource: "pastContract",
    });
  });

  it("falls back to the library's public-sector contracts, ignoring private ones", () => {
    const pastProjects = [
      { value: 800_000, clientType: "government" },
      { value: 5_000_000, clientType: "private" },
      { value: 600_000, clientType: "stateEnterprise" },
    ];
    assert.deepEqual(capOf({ pastProjects }), { cap: 800_000, capSource: "library" });
  });

  it("then the preferred budget, then the starter size", () => {
    assert.equal(capOf({ preferredBudgetMax: 3_000_000 }).capSource, "preferredMax");
    assert.deepEqual(capOf({}), { cap: STARTER_CAP, capSource: "starter" });
    assert.equal(capOf({ largestPastContract: 0 }).capSource, "starter");
  });
});

describe("buildGrowthPath — agencies", () => {
  it("only counts jobs at or under the company's size", () => {
    const awards = [
      award("เขตใหญ่", "บริษัท ก จำกัด", 50_000_000),
      award("เขตใหญ่", "บริษัท ข จำกัด", 30_000_000),
      award("เขตเล็ก", "บริษัท ก จำกัด", 400_000),
      award("เขตเล็ก", "บริษัท ข จำกัด", 900_000),
    ];
    const path = buildGrowthPath(company, awards, []);
    assert.deepEqual(names(path), ["เขตเล็ก"]);
    assert.equal(path.agencies[0].rightSized, 2);
    assert.equal(path.agencies[0].medianSize, 650_000);
  });

  it("puts the agency with more jobs per winning company first", () => {
    const awards = [
      ...["ก", "ข", "ค", "ง"].map((name) => award("เขตแข่งสูง", `บริษัท ${name} จำกัด`, 500_000)),
      award("เขตแข่งน้อย", "บริษัท ก จำกัด", 500_000),
      award("เขตแข่งน้อย", "บริษัท ข จำกัด", 500_000),
      award("เขตแข่งน้อย", "บริษัท ก จำกัด", 500_000),
    ];
    const path = buildGrowthPath(company, awards, []);
    assert.deepEqual(names(path), ["เขตแข่งน้อย", "เขตแข่งสูง"]);
    assert.equal(path.agencies[0].rivals, 2);
    assert.equal(path.agencies[0].topWinner.vendor, "บริษัท ก จำกัด");
    assert.ok(Math.abs(path.agencies[0].topWinner.share - 2 / 3) < 1e-9);
  });

  it("ranks five jobs shared by two companies above two jobs won by one", () => {
    const awards = [
      award("เขตสองงาน", "บริษัท ก จำกัด", 300_000),
      award("เขตสองงาน", "บริษัท ก จำกัด", 300_000),
      ...["ข", "ค", "ข", "ค", "ข"].map((name) => award("เขตห้างาน", `บริษัท ${name} จำกัด`, 300_000)),
    ];
    assert.deepEqual(names(buildGrowthPath(company, awards, [])), ["เขตห้างาน", "เขตสองงาน"]);
  });

  it("leaves out an agency with a single job this size", () => {
    const path = buildGrowthPath(company, [award("เขตครั้งเดียว", "บริษัท ก จำกัด", 300_000)], []);
    assert.deepEqual(path.agencies, []);
  });

  it("ranks agencies whose winners are never named after the ones that can be judged", () => {
    const awards = [
      award("เขตไม่รู้ผู้ชนะ", null, 300_000),
      award("เขตไม่รู้ผู้ชนะ", null, 300_000),
      award("เขตรู้", "บริษัท ก จำกัด", 300_000),
      award("เขตรู้", "บริษัท ข จำกัด", 300_000),
    ];
    // An award without a named winner still counts when its amount is known.
    awards[0].awardedAmount = 300_000;
    awards[1].awardedAmount = 300_000;
    const path = buildGrowthPath(company, awards, []);
    assert.deepEqual(names(path), ["เขตรู้", "เขตไม่รู้ผู้ชนะ"]);
    assert.equal(path.agencies[1].topWinner, null);
  });

  it("counts companies the agency hired again in a later year", () => {
    const awards = [
      award("เขตต่อเนื่อง", "บริษัท ก จำกัด", 400_000, 2024),
      award("เขตต่อเนื่อง", "บริษัท ก จำกัด", 400_000, 2025),
      award("เขตต่อเนื่อง", "บริษัท ข จำกัด", 400_000, 2025),
    ];
    const [row] = buildGrowthPath(company, awards, []).agencies;
    assert.equal(row.rehires, 1);
    assert.deepEqual(row.years, [2025, 2024]);
  });
});

describe("buildGrowthPath — open jobs", () => {
  it("splits open jobs into this size and one step up, leaving out closed and unpriced ones", () => {
    const jobs = [
      job("1", "เขตใดก็ได้", 800_000),
      job("2", "เขตใดก็ได้", 1_500_000),
      job("3", "เขตใดก็ได้", 2_500_000),
      job("4", "เขตใดก็ได้", 500_000, 90, "closed"),
      job("5", "เขตใดก็ได้", null),
    ];
    const path = buildGrowthPath(company, [], jobs);
    assert.equal(path.nextCap, 2_000_000);
    assert.deepEqual(path.jobs.now.map((row) => row.id), ["1"]);
    assert.deepEqual(path.jobs.next.map((row) => row.id), ["2"]);
  });

  it("lists jobs at a recommended agency first, then by match", () => {
    const awards = [award("เขตแนะนำ", "บริษัท ก จำกัด", 400_000), award("เขตแนะนำ", "บริษัท ก จำกัด", 400_000)];
    const jobs = [job("a", "เขตอื่น", 500_000, 95), job("b", "เขตแนะนำ", 500_000, 40), job("c", "เขตอื่น", 500_000, 60)];
    const path = buildGrowthPath(company, awards, jobs);
    assert.deepEqual(path.jobs.now.map((row) => row.id), ["b", "a", "c"]);
    assert.equal(path.jobs.now[0].atRecommendedAgency, true);
  });
});
