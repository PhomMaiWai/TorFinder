// Unit coverage for how the search page orders "find similar" results
// (rankBySimilarity in src/lib/similar-rank.ts) — a pure function, tested
// directly like tor-deadline-filter.test.mts. Its `@/` imports are type-only,
// so Node's type stripping erases them before resolution.

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { rankBySimilarity } from "../src/lib/similar-rank.ts";
import type { TorRecord } from "../src/types/tor.ts";

const tor = (id: string, projectNumber?: string) => ({ id, projectNumber }) as unknown as TorRecord;
const hit = (id: string, similarity: number) => ({ id, similarity, sharedTerms: [] });

describe("rankBySimilarity", () => {
  it("follows the ranking, not the list order", () => {
    const ranked = rankBySimilarity([tor("a"), tor("b"), tor("c")], [hit("c", 90), hit("a", 70)]);
    assert.deepEqual(
      ranked.map((r) => r.tor.id),
      ["c", "a"],
    );
    assert.equal(ranked[0].hit.similarity, 90);
  });

  it("leaves out ranked TORs the filters removed", () => {
    const ranked = rankBySimilarity([tor("a")], [hit("b", 90), hit("a", 70)]);
    assert.deepEqual(
      ranked.map((r) => r.tor.id),
      ["a"],
    );
  });

  it("keeps one card per project, the best-ranked one", () => {
    const tors = [tor("plan", "P1"), tor("award", "P1"), tor("other", "P2"), tor("manual")];
    const ranked = rankBySimilarity(tors, [hit("award", 95), hit("plan", 94), hit("manual", 80), hit("other", 60)]);
    assert.deepEqual(
      ranked.map((r) => r.tor.id),
      ["award", "manual", "other"],
    );
  });
});
