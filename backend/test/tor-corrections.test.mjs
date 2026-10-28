// Unit coverage for what an import does to a record an admin corrected
// (TorImportService) — imported from the compiled build (run after
// `npm run build`, as CI does). The database is faked: each test hands the
// service the stored records it would have found and reads back the writes.

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { ObjectId } from "mongodb";

import { TorImportService } from "../dist/tor/tor-import.service.js";

const STAGE = "เปิดรับฟังความคิดเห็น";

/** A record as a source hands it to the importer. */
function incoming(overrides = {}) {
  return {
    doc: {
      sourceRef: "mea:1",
      title: "จ้างพัฒนาระบบสารสนเทศ (ชื่อจากต้นทาง)",
      agency: "การไฟฟ้านครหลวง",
      budget: "฿1,000,000",
      deadline: "31 ธ.ค. 2575",
      daysLeft: 30,
      match: 0,
      tags: [],
      stage: STAGE,
      summary: "รายละเอียดจากต้นทาง",
      budgetStatus: "ปกติ",
      createdAt: new Date("2026-01-01"),
      ...overrides,
    },
  };
}

/**
 * `known` answers the importer's lookup of refs it already holds; `stored` its
 * lookup of live records the batch could duplicate.
 */
function fakeDb({ known = [], stored = [] } = {}) {
  const writes = { bulk: [], deletes: [], finds: [] };
  return {
    writes,
    tors: {
      find(filter) {
        writes.finds.push(filter);
        const rows = filter.sourceRef?.$in ? known : filter.stage ? stored : [];
        return { toArray: async () => rows };
      },
      bulkWrite: async (ops) => {
        writes.bulk.push(...ops);
        return { upsertedIds: {}, upsertedCount: 0, modifiedCount: ops.length };
      },
      deleteMany: async (filter) => {
        writes.deletes.push(filter);
        return { deletedCount: 0 };
      },
    },
  };
}

const matching = {
  refreshBudgetStatuses: async () => ({}),
  notifyMatches: async () => 0,
};

describe("re-importing a corrected record", () => {
  it("leaves the locked fields alone and updates the rest", async () => {
    const db = fakeDb({
      known: [
        {
          _id: new ObjectId(),
          sourceRef: "mea:1",
          lockedFields: ["title", "budgetStatus"],
        },
      ],
    });
    await new TorImportService(db, matching).import("mea", [incoming()]);

    const [{ updateOne }] = db.writes.bulk;
    const set = updateOne.update.$set;
    assert.equal(set.title, undefined);
    assert.equal(set.budgetStatus, undefined);
    assert.equal(set.summary, "รายละเอียดจากต้นทาง");
    assert.equal(set.agency, "การไฟฟ้านครหลวง");
  });

  it("updates every field of a record nobody corrected", async () => {
    const db = fakeDb({ known: [{ _id: new ObjectId(), sourceRef: "mea:1" }] });
    await new TorImportService(db, matching).import("mea", [incoming()]);
    assert.equal(
      db.writes.bulk[0].updateOne.update.$set.title,
      "จ้างพัฒนาระบบสารสนเทศ (ชื่อจากต้นทาง)",
    );
  });

  it("keeps a corrected copy over a better source's copy of the same project", async () => {
    const corrected = {
      _id: new ObjectId(),
      title: "ชื่อที่ผู้ดูแลแก้แล้ว",
      agency: "การไฟฟ้านครหลวง",
      stage: STAGE,
      projectNumber: "67019999999",
      sourceRef: "mea:9",
      lockedFields: ["classification"],
    };
    const db = fakeDb({ stored: [corrected] });
    const result = await new TorImportService(db, matching).import("egp", [
      incoming({ sourceRef: "egp:1", projectNumber: "67019999999" }),
    ]);

    assert.equal(result.skipped, 1);
    assert.equal(db.writes.bulk.length, 0);
    assert.equal(db.writes.deletes.length, 0);
  });

  it("still replaces an uncorrected copy from a worse source", async () => {
    const plain = {
      _id: new ObjectId(),
      title: "จ้างพัฒนาระบบสารสนเทศ",
      agency: "การไฟฟ้านครหลวง",
      stage: STAGE,
      projectNumber: "67019999999",
      sourceRef: "mea:9",
    };
    const db = fakeDb({ stored: [plain] });
    const result = await new TorImportService(db, matching).import("egp", [
      incoming({ sourceRef: "egp:1", projectNumber: "67019999999" }),
    ]);

    assert.equal(result.superseded, 1);
    assert.deepEqual(db.writes.deletes[0], {
      _id: { $in: [plain._id] },
      lockedFields: { $exists: false },
    });
  });

  it("never purges a corrected record", async () => {
    const db = fakeDb();
    await new TorImportService(db, matching).purge("datagov", () => false);
    assert.deepEqual(db.writes.finds[0].lockedFields, { $exists: false });
  });
});
