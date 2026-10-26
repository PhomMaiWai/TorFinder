// Unit coverage for the "closing within" search filter (matchesDeadline,
// DEADLINE_RANGES in src/lib/tor-ui.ts) — a pure predicate with no server or
// browser involved, unlike every other suite in this directory. The filter
// itself lives entirely in a client component (TorSearch), so there is no
// server-rendered HTML an e2e test could assert on; this tests the logic
// directly instead.
//
// Runs on Node's native TypeScript support (no ts-node/tsx needed) — see
// package.json's test:e2e script. tor-ui.ts's only `@/`-aliased import is a
// `import type`, which type-stripping erases before module resolution ever
// sees it, so the path alias (unresolvable outside webpack/Next) never
// matters here.

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { DEADLINE_RANGES, matchesDeadline } from "../src/lib/tor-ui.ts";
import type { Bidding, TorStage } from "../src/types/tor.ts";

const DAY_MS = 86_400_000;

type Fields = { deadline: string; daysLeft: number; stage: TorStage; bidding: Bidding };

/**
 * An open record closing in exactly `days` calendar days. Built from `bidding`
 * directly (matchesDeadline reads daysUntilClose's own `closesAt`), with
 * `days * DAY_MS` added to `now` — an exact multiple of a day, so the
 * Bangkok-calendar-day math in daysUntilClose lands on exactly `days` no
 * matter what time of day the suite happens to run.
 */
function openClosingIn(days: number): Fields {
  return {
    deadline: "ไม่ระบุ",
    daysLeft: 0,
    stage: "ประกาศ TOR",
    bidding: {
      status: "open",
      reason: null,
      opensAt: null,
      closesAt: new Date(Date.now() + days * DAY_MS).toISOString(),
      closesAtSource: "portal",
    },
  };
}

function closedAwarded(): Fields {
  return {
    deadline: "ไม่ระบุ",
    daysLeft: 0,
    stage: "ประกาศผู้ชนะ",
    bidding: { status: "closed", reason: "awarded", opensAt: null, closesAt: null, closesAtSource: null },
  };
}

function unknownStatus(): Fields {
  return {
    deadline: "ไม่ระบุ",
    daysLeft: 0,
    stage: "เปิดรับฟังความคิดเห็น",
    bidding: { status: "unknown", reason: null, opensAt: null, closesAt: null, closesAtSource: null },
  };
}

describe("DEADLINE_RANGES", () => {
  it("is the two documented windows, 7 days then 30", () => {
    assert.deepEqual(
      DEADLINE_RANGES.map((r) => [r.id, r.days]),
      [
        ["7d", 7],
        ["30d", 30],
      ],
    );
  });
});

describe("matchesDeadline", () => {
  it("'any' (null) matches no matter the status or deadline", () => {
    assert.equal(matchesDeadline(closedAwarded(), null), true);
    assert.equal(matchesDeadline(unknownStatus(), null), true);
    assert.equal(matchesDeadline(openClosingIn(400), null), true);
  });

  it("'7d' matches something open and closing today through the 7th day out", () => {
    assert.equal(matchesDeadline(openClosingIn(0), "7d"), true);
    assert.equal(matchesDeadline(openClosingIn(7), "7d"), true);
  });

  it("'7d' excludes something open but closing further out", () => {
    assert.equal(matchesDeadline(openClosingIn(8), "7d"), false);
  });

  it("'30d' matches up to the 30th day out and no further", () => {
    assert.equal(matchesDeadline(openClosingIn(30), "30d"), true);
    assert.equal(matchesDeadline(openClosingIn(31), "30d"), false);
  });

  it("a closed or awarded record never matches a window, however soon its old deadline was", () => {
    assert.equal(matchesDeadline(closedAwarded(), "7d"), false);
    assert.equal(matchesDeadline(closedAwarded(), "30d"), false);
  });

  it("a record with unknown bidding status never matches a window", () => {
    assert.equal(matchesDeadline(unknownStatus(), "7d"), false);
    assert.equal(matchesDeadline(unknownStatus(), "30d"), false);
  });

  it("an unrecognized range id matches nothing, rather than silently falling back to 'any'", () => {
    assert.equal(matchesDeadline(openClosingIn(1), "90d"), false);
  });
});
