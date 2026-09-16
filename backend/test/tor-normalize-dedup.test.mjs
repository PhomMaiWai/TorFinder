// Unit coverage for the layer every importer shares once it needs to compare
// what it fetched against what is already stored: tor-normalize.ts (folding
// each portal's own dialect — Thai numerals, /Date()/, baht strings — onto one
// form), tor-dedup.ts (the fuzzy title/agency heuristics), tor-dedup-index.ts
// (the shingle index resolveDuplicates() uses to avoid an O(n²) scan), and the
// SOURCE_RANK precedence in tor.constants.ts that decides which of three
// sources' copies of the same project survives.
//
// Runs against the compiled output (`npm run build` must have run first, same
// as mea-client.test.mjs) because tor-dedup-index.ts uses a constructor
// parameter property, which Node's native TS support cannot transform.
//
// Fixtures below are drawn from how each of the three portals actually files
// the same project, per the source code and comments in the files under test:
//   - e-GP:      ISO dates, Arabic numerals, an 11-digit project number of its
//                own, agency written as "กรม... · กอง...".
//   - MEA:       ASP.NET `/Date(ms)/` timestamps, Thai numerals ("๒๘,๐๐๐"),
//                and the e-GP project number appended to free text
//                ("... เลขที่โครงการในระบบ e-GP : 69089649017").
//   - data.go.th: plain numbers/strings out of a CKAN datastore row, no project
//                number of its own beyond what e-GP assigned.

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  UNKNOWN,
  cleanText,
  daysUntil,
  extractProjectNumber,
  foldThaiDigits,
  formatBaht,
  formatThaiDate,
  parseDate,
} from "../dist/tor/tor-normalize.js";
import { isLikelyDuplicateTitle, isLikelySameAgency, normalizeForMatch } from "../dist/tor/tor-dedup.js";
import { TorDedupIndex } from "../dist/tor/tor-dedup-index.js";
import { sourceOf, sourceRank } from "../dist/tor/tor.constants.js";

describe("foldThaiDigits", () => {
  it("maps each Thai numeral onto its Arabic digit", () => {
    assert.equal(foldThaiDigits("๐๑๒๓๔๕๖๗๘๙"), "0123456789");
  });

  it("folds only the Thai digits in a mixed MEA quantity string", () => {
    assert.equal(foldThaiDigits("๒๘,๐๐๐ อัน"), "28,000 อัน");
  });

  it("leaves an already-Arabic e-GP string untouched", () => {
    assert.equal(foldThaiDigits("69089649017"), "69089649017");
  });
});

describe("cleanText", () => {
  it("collapses newlines and repeated whitespace from scraped HTML", () => {
    assert.equal(cleanText("  จัดซื้อ\n\n  ครุภัณฑ์   คอมพิวเตอร์  \t"), "จัดซื้อ ครุภัณฑ์ คอมพิวเตอร์");
  });
});

describe("formatBaht / UNKNOWN", () => {
  it("formats a positive amount as Thai currency", () => {
    assert.ok(formatBaht(2_144_669).includes("2,144,669"));
  });

  it("falls back to UNKNOWN for zero, negative, null and undefined", () => {
    assert.equal(formatBaht(0), UNKNOWN);
    assert.equal(formatBaht(-500), UNKNOWN);
    assert.equal(formatBaht(null), UNKNOWN);
    assert.equal(formatBaht(undefined), UNKNOWN);
  });
});

describe("parseDate — each source's own date dialect", () => {
  it("parses an ISO date the way e-GP and data.go.th publish it", () => {
    const date = parseDate("2026-09-24T00:00:00.000Z");
    assert.equal(date?.toISOString(), "2026-09-24T00:00:00.000Z");
  });

  it("parses MEA's ASP.NET /Date(ms)/ wire format", () => {
    const date = parseDate("/Date(1789491600000)/");
    assert.equal(date?.getTime(), 1_789_491_600_000);
  });

  it("returns null for an unparseable string instead of an Invalid Date", () => {
    const date = parseDate("ไม่ระบุ");
    assert.equal(date, null);
  });

  it("returns null for null, undefined and empty string", () => {
    assert.equal(parseDate(null), null);
    assert.equal(parseDate(undefined), null);
    assert.equal(parseDate(""), null);
  });
});

describe("daysUntil", () => {
  it("floors a closed announcement's countdown at 0, never negative", () => {
    assert.equal(daysUntil(new Date(Date.now() - 10 * 86_400_000)), 0);
  });

  it("returns 0 for a null date", () => {
    assert.equal(daysUntil(null), 0);
  });

  it("rounds a future deadline up to whole days", () => {
    // Just over 2 full days away must read as 3, not 2 — a company should never
    // be told there's less time left than there actually is.
    const inTwoDaysAndAMinute = new Date(Date.now() + 2 * 86_400_000 + 60_000);
    assert.equal(daysUntil(inTwoDaysAndAMinute), 3);
  });
});

describe("formatThaiDate", () => {
  it("falls back to UNKNOWN for a null date", () => {
    assert.equal(formatThaiDate(null), UNKNOWN);
  });

  it("renders a real date in the Thai (Buddhist calendar) locale", () => {
    // 2026 CE is 2569 BE — the whole reason this formatter exists instead of
    // toLocaleDateString("en-US") is that every reader expects the Thai year.
    const text = formatThaiDate(new Date("2026-09-24T00:00:00.000Z"));
    assert.ok(text.includes("2569"), `expected the Buddhist-era year in "${text}"`);
  });
});

describe("extractProjectNumber — the one identifier all three portals share", () => {
  it("reads e-GP's own project number field directly", () => {
    assert.equal(extractProjectNumber("69089649017"), "69089649017");
  });

  it("digs the project number out of MEA's free-text announcement number", () => {
    const meaAnnouncementNo = "ปย.001/2569 เลขที่โครงการในระบบ e-GP : 69089649017";
    assert.equal(extractProjectNumber(meaAnnouncementNo), "69089649017");
  });

  it("accepts data.go.th's proj_no as a number rather than a string", () => {
    assert.equal(extractProjectNumber(69089649017), "69089649017");
  });

  it("checks candidates in order and returns the first that has one", () => {
    assert.equal(extractProjectNumber(null, undefined, "no number here", "69089649017"), "69089649017");
  });

  it("rejects a shorter run of digits — a quantity or a year, not a project number", () => {
    assert.equal(extractProjectNumber("28,000"), undefined);
    assert.equal(extractProjectNumber("2569"), undefined);
  });

  it("folds Thai numerals before matching, in case a source ever files one that way", () => {
    assert.equal(extractProjectNumber("๖๙๐๘๙๖๔๙๐๑๗"), "69089649017");
  });

  it("returns undefined when nothing in any candidate qualifies", () => {
    assert.equal(extractProjectNumber(null, undefined, "2569"), undefined);
  });
});

describe("normalizeForMatch", () => {
  it("folds Thai numerals, lowercases, strips meaningless punctuation and collapses whitespace", () => {
    assert.equal(normalizeForMatch('จัดซื้อครุภัณฑ์ (๒๘,๐๐๐ หน่วย) - Phase 1'), "จัดซื้อครุภัณฑ์ 28 000 หน่วย phase 1");
  });

  it("trims the trailing space left behind by a stripped closing parenthesis", () => {
    // Every punctuation character in the class becomes its own space, so the
    // hyphen inside "(e-bidding)" splits into two words rather than surviving.
    assert.equal(normalizeForMatch("Digital Permit Tracking System (e-bidding)"), "digital permit tracking system e bidding");
  });
});

describe("isLikelyDuplicateTitle — the same project, worded differently by each source", () => {
  it("matches after case and punctuation differences alone", () => {
    assert.ok(
      isLikelyDuplicateTitle(
        "Digital Permit Tracking System",
        "digital permit tracking system",
      ),
    );
  });

  it("matches when e-GP appends a clause an admin or MEA never would", () => {
    assert.ok(
      isLikelyDuplicateTitle(
        "Digital Permit Tracking System",
        "Digital Permit Tracking System ด้วยวิธีประกวดราคาอิเล็กทรอนิกส์",
      ),
    );
  });

  it("matches a reworded title with the same words in a different order", () => {
    assert.ok(
      isLikelyDuplicateTitle(
        "Traffic Signal Analytics Platform",
        "Platform Analytics for Traffic Signal",
      ),
    );
  });

  it("does not treat '#1' as contained in '#10'", () => {
    assert.equal(isLikelyDuplicateTitle("PhaseRolloutPlan #1", "PhaseRolloutPlan #10"), false);
  });

  it("rejects unrelated titles", () => {
    assert.equal(
      isLikelyDuplicateTitle("Warehouse Robotics Fleet Upgrade", "Digital Permit Tracking System"),
      false,
    );
  });

  it("rejects when either title is empty after normalization", () => {
    assert.equal(isLikelyDuplicateTitle("", "Digital Permit Tracking System"), false);
  });
});

describe("isLikelySameAgency — e-GP's group·department vs a shorter name elsewhere", () => {
  it("matches e-GP's combined group and department against MEA's plain department name", () => {
    assert.ok(isLikelySameAgency("การไฟฟ้านครหลวง · ฝ่ายพัสดุ", "ฝ่ายพัสดุ"));
  });

  it("matches identical agency names", () => {
    assert.ok(isLikelySameAgency("กรมบัญชีกลาง", "กรมบัญชีกลาง"));
  });

  it("rejects two agencies that share no common substring", () => {
    assert.equal(isLikelySameAgency("การไฟฟ้านครหลวง", "กรมบัญชีกลาง"), false);
  });
});

describe("TorDedupIndex — cross-source fuzzy lookup at scale", () => {
  const stage = "ประกาศ TOR";

  function buildIndex(entries) {
    return new TorDedupIndex(entries);
  }

  it("finds an exact-title match via the fast path, honoring the agency check", () => {
    const stored = [{ title: "Digital Permit Tracking System", agency: "กรมที่ดิน", stage }];
    const index = buildIndex(stored);

    assert.equal(index.find("Digital Permit Tracking System", "กรมที่ดิน"), stored[0]);
    assert.equal(index.find("Digital Permit Tracking System", "หน่วยงานอื่น"), null);
  });

  it("finds a fuzzy match through the shingle index when titles aren't byte-identical", () => {
    // Thai script carries no spaces, so wordOverlap() never fires on it (see
    // TorDedupIndex's own comment) — the realistic fuzzy case here is
    // containment, e.g. e-GP appending a procurement-method clause onto the
    // same title data.go.th reports. Long enough that the shared run clears
    // both the shingle length and MIN_CONTAINMENT_LENGTH, and different
    // enough from the stored title that the exact byTitle map can't answer it
    // — this can only be found by scanning the shingle candidates.
    const baseTitle = "จ้างพัฒนาระบบบริหารจัดการเอกสารอิเล็กทรอนิกส์สำหรับหน่วยงานราชการ";
    const stored = [{ title: baseTitle, agency: "กรมบัญชีกลาง · กองระบบสารสนเทศ", stage }];
    const index = buildIndex(stored);

    const found = index.find(`${baseTitle} ด้วยวิธีประกวดราคาอิเล็กทรอนิกส์`, "กรมบัญชีกลาง");
    assert.equal(found, stored[0]);
  });

  it("never matches across a stored record from an unrelated agency", () => {
    const stored = [{ title: "Digital Permit Tracking System", agency: "กรมที่ดิน", stage }];
    const index = buildIndex(stored);

    assert.equal(index.find("Digital Permit Tracking System", "การไฟฟ้านครหลวง"), null);
  });

  it("returns null when nothing in the index shares a title", () => {
    const stored = [{ title: "Digital Permit Tracking System", agency: "กรมที่ดิน", stage }];
    const index = buildIndex(stored);

    assert.equal(index.find("Warehouse Robotics Fleet Upgrade", "กรมที่ดิน"), null);
  });

  it("builds cleanly over an empty stored set", () => {
    const index = buildIndex([]);
    assert.equal(index.find("Anything", "Anyone"), null);
  });
});

describe("sourceOf / sourceRank — which source's copy survives", () => {
  it("reads the source off the sourceRef prefix", () => {
    assert.equal(sourceOf("egp:69089649017:D0"), "egp");
    assert.equal(sourceOf("mea:12345"), "mea");
    assert.equal(sourceOf("datagov:69089649017"), "datagov");
  });

  it("treats a missing or unrecognized ref as manual", () => {
    assert.equal(sourceOf(undefined), "manual");
    assert.equal(sourceOf("something-else:1"), "manual");
  });

  it("ranks manual above e-GP above MEA above data.go.th", () => {
    const ranks = ["manual", "egp", "mea", "datagov"].map(sourceRank);
    assert.deepEqual(
      ranks,
      [...ranks].sort((a, b) => b - a),
      "SOURCE_RANK must already be in descending order: manual, egp, mea, datagov",
    );
  });

  // These mirror exactly what TorImportService.resolveDuplicates() does with
  // the two numbers once TorDedupIndex has found a candidate: keep the
  // higher-ranked copy, skip or supersede the other.
  function winner(existingRef, incomingSource) {
    const existingRank = sourceRank(sourceOf(existingRef));
    const incomingRank = sourceRank(incomingSource);
    return existingRank >= incomingRank ? "existing" : "incoming";
  }

  it("keeps an existing e-GP announcement over an incoming data.go.th contract record", () => {
    assert.equal(winner("egp:69089649017:D0", "datagov"), "existing");
  });

  it("keeps an existing e-GP announcement over an incoming MEA one", () => {
    assert.equal(winner("egp:69089649017:D0", "mea"), "existing");
  });

  it("lets an incoming e-GP announcement supersede an existing data.go.th record", () => {
    assert.equal(winner("datagov:69089649017", "egp"), "incoming");
  });

  it("lets an incoming e-GP announcement supersede an existing MEA record", () => {
    assert.equal(winner("mea:12345", "egp"), "incoming");
  });

  it("lets an incoming MEA record supersede an existing data.go.th one", () => {
    assert.equal(winner("datagov:69089649017", "mea"), "incoming");
  });

  it("never lets data.go.th supersede anything, including another data.go.th run", () => {
    assert.equal(winner("datagov:69089649017", "datagov"), "existing");
    assert.equal(winner("mea:12345", "datagov"), "existing");
    assert.equal(winner("egp:69089649017:D0", "datagov"), "existing");
  });

  it("keeps a manual entry over every automated source", () => {
    assert.equal(winner("undefined-ref-means-manual", "egp"), "existing");
    for (const source of ["egp", "mea", "datagov"]) {
      assert.equal(winner(undefined, source), "existing");
    }
  });
});
