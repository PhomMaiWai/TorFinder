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
const PLAN = "\u0e41\u0e1c\u0e19\u0e01\u0e32\u0e23\u0e08\u0e31\u0e14\u0e0b\u0e37\u0e49\u0e2d\u0e08\u0e31\u0e14\u0e08\u0e49\u0e32\u0e07";
const PRICE = "\u0e1b\u0e23\u0e30\u0e01\u0e32\u0e28\u0e23\u0e32\u0e04\u0e32\u0e01\u0e25\u0e32\u0e07";
const AWARD = "ประกาศผู้ชนะ";

describe("stored stage values", () => {
  it("draft, invitation and award keep the text already on every record", () => {
    assert.equal(STAGE.draft, DRAFT);
    assert.equal(STAGE.invitation, INVITATION);
    assert.equal(STAGE.award, AWARD);
  });

  it("plan and price are the labels process5 already uses for those notices", () => {
    assert.equal(STAGE.plan, PLAN);
    assert.equal(STAGE.price, PRICE);
    assert.equal(GPROC_ANNOUNCE_TYPES.P0.label, PLAN);
    assert.equal(GPROC_ANNOUNCE_TYPES.price.label, PRICE);
  });
});

describe("the stage lists", () => {
  it("TOR_STAGES is the lifecycle: plan, draft, price, invitation, award", () => {
    assert.deepEqual([...TOR_STAGES], [STAGE.plan, STAGE.draft, STAGE.price, STAGE.invitation, STAGE.award]);
  });

  it("every named stage is in TOR_STAGES, and nothing else is", () => {
    assert.deepEqual([...TOR_STAGES].sort(), Object.values(STAGE).sort());
  });

  it("the listing order is a permutation of TOR_STAGES — no stage left out, none twice", () => {
    assert.deepEqual([...STAGE_LISTING_ORDER].sort(), [...TOR_STAGES].sort());
    assert.equal(new Set(STAGE_LISTING_ORDER).size, STAGE_LISTING_ORDER.length);
  });

  it("lists what a company can act on before what is already decided", () => {
    assert.equal(STAGE_LISTING_ORDER.at(-1), STAGE.award);
    assert.ok(STAGE_LISTING_ORDER.indexOf(STAGE.invitation) < STAGE_LISTING_ORDER.indexOf(STAGE.plan));
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
