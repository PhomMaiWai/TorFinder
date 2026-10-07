// The stage model (backend/src/tor/tor.constants.ts), without a server. Loaded
// from dist like the other logic-only suites — run `npm run build` first.
//
// Stage values are stored on every record, so what each name means is not up
// to the code: the literals below are the ones already in the database, written
// as code points so no editor or tool can normalise them into different text.
// And code reads stages by name — never by position in TOR_STAGES — so the list
// can grow without anything silently changing meaning.

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { EGP_ANNOUNCE_TYPES } from "../dist/egp/egp.constants.js";
import { GPROC_ANNOUNCE_TYPES } from "../dist/gproc/gproc.constants.js";
import { STAGE, STAGE_LISTING_ORDER, TOR_STAGES } from "../dist/tor/tor.constants.js";

const DRAFT = "เปิดรับฟังความคิดเห็น";
const INVITATION = "ประกาศ TOR";
const AWARD = "ประกาศผู้ชนะ";

describe("stored stage values", () => {
  it("draft, invitation and award keep the text already on every record", () => {
    assert.equal(STAGE.draft, DRAFT);
    assert.equal(STAGE.invitation, INVITATION);
    assert.equal(STAGE.award, AWARD);
  });
});

describe("the stage lists", () => {
  it("every named stage is in TOR_STAGES, and nothing else is", () => {
    assert.deepEqual([...TOR_STAGES].sort(), Object.values(STAGE).sort());
  });

  it("the listing order is a permutation of TOR_STAGES — no stage left out, none twice", () => {
    assert.deepEqual([...STAGE_LISTING_ORDER].sort(), [...TOR_STAGES].sort());
    assert.equal(new Set(STAGE_LISTING_ORDER).size, STAGE_LISTING_ORDER.length);
  });

  it("lists what a company can act on before what is already decided", () => {
    assert.equal(STAGE_LISTING_ORDER.at(-1), STAGE.award);
  });
});

describe("announcement types still map to the same stages", () => {
  const egp = Object.fromEntries(EGP_ANNOUNCE_TYPES.map((type) => [type.code, type.stage]));

  it("e-GP: 98 is the draft, D0 the invitation, W0 the award", () => {
    assert.equal(egp["98"], STAGE.draft);
    assert.equal(egp.D0, STAGE.invitation);
    assert.equal(egp.W0, STAGE.award);
  });

  it("process5: B0 is the draft, D0 the invitation, W0 the award", () => {
    assert.equal(GPROC_ANNOUNCE_TYPES.B0.stage, STAGE.draft);
    assert.equal(GPROC_ANNOUNCE_TYPES.D0.stage, STAGE.invitation);
    assert.equal(GPROC_ANNOUNCE_TYPES.W0.stage, STAGE.award);
  });
});
