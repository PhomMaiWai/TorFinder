// Unit coverage for reading new TORs right after import (KPI K9, #400) and for
// the coverage table behind the backfill (KPI K7, #399) — imported from the
// compiled build (run after `npm run build`, as CI does). No database, no model:
// the collection and the extraction call are fakes that record what was asked.

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { ObjectId } from "mongodb";

import { classifyCoverage, summarizeCoverage } from "../dist/ai/extraction-coverage.js";
import { ExtractionService } from "../dist/ai/extraction.service.js";
import { TorImportService } from "../dist/tor/tor-import.service.js";

const DAY = 24 * 60 * 60_000;
const NOW = Date.UTC(2026, 10, 25);
const PDF = "https://process3.gprocurement.go.th/egp2procmainWeb/FPRO9965Servlet/file.pdf";

const flush = () => new Promise((resolve) => setImmediate(resolve));

function record(overrides = {}) {
  return { stage: "ประกาศ TOR", createdAt: new Date(NOW - DAY), projectNumber: "69099314442", ...overrides };
}

describe("classifyCoverage", () => {
  it("puts a record with an extraction under read, whatever else is true of it", () => {
    assert.equal(classifyCoverage(record({ extraction: { version: 1 }, createdAt: new Date(NOW - 400 * DAY) }), NOW), "read");
  });

  it("finds nothing to read without a file link, a project number or a gproc invitation", () => {
    assert.equal(classifyCoverage(record({ projectNumber: undefined, documents: [{ url: "https://example.com/list" }] }), NOW), "no-document");
    assert.equal(classifyCoverage(record({ projectNumber: undefined, sourceRef: "gproc:1", stage: "ประกาศ TOR" }), NOW), "waiting");
  });

  it("tells a record given up on from one waiting out its cooldown", () => {
    const failedAt = new Date(NOW - 60_000);
    assert.equal(classifyCoverage(record({ extractionFailure: { attempts: 3, failedAt } }), NOW), "gave-up");
    assert.equal(classifyCoverage(record({ extractionFailure: { attempts: 1, failedAt } }), NOW), "cooling-down");
    assert.equal(classifyCoverage(record({ extractionFailure: { attempts: 1, failedAt: new Date(NOW - 2 * DAY) } }), NOW), "waiting");
  });

  it("names the 90-day window as the reason an older record isn't read", () => {
    assert.equal(classifyCoverage(record({ createdAt: new Date(NOW - 91 * DAY) }), NOW), "too-old");
  });
});

describe("summarizeCoverage", () => {
  it("adds every record to exactly one bucket and counts K7 over the readable ones", () => {
    const report = summarizeCoverage(
      [
        record({ extraction: {}, documents: [{ url: PDF }] }),
        record({ extraction: {} }),
        record({ projectNumber: undefined, documents: [{ url: "https://example.com/list" }] }),
        record({ documents: [{ url: PDF }], extractionFailure: { attempts: 3, failedAt: new Date(NOW), reason: "timeout after 120000 ms" } }),
        record({ createdAt: new Date(NOW - 200 * DAY) }),
      ],
      NOW,
    );
    assert.equal(report.total, 5);
    assert.equal(Object.values(report.buckets).reduce((a, b) => a + b, 0), 5);
    assert.equal(report.readable, 4);
    assert.equal(report.read, 2);
    assert.equal(report.withDocuments, 3);
    assert.equal(report.bucketsWithDocuments.read, 1);
    // K7 counts the last 90 days: the old record and the one with nothing to read are out.
    assert.equal(report.recent, 3);
    assert.equal(report.recentRead, 2);
    assert.deepEqual(report.failureReasons, [{ reason: "timeout after N ms", count: 1 }]);
  });
});

/** Just enough of the tors collection for one import of brand-new records. */
function importDb(newIds) {
  return {
    tors: {
      find: () => ({ toArray: async () => [] }),
      bulkWrite: async () => ({
        upsertedIds: Object.fromEntries(newIds.map((id, i) => [i, id])),
        upsertedCount: newIds.length,
        modifiedCount: 0,
      }),
      deleteMany: async () => ({ deletedCount: 0 }),
    },
  };
}

const matching = { refreshBudgetStatuses: async () => {}, notifyMatches: async () => {} };

function imported(i) {
  return {
    doc: {
      sourceRef: `egp:${i}`,
      title: `จ้างพัฒนาระบบสารสนเทศ ${i}`,
      agency: `สำนักงานเขต ${i}`,
      stage: "ประกาศ TOR",
      budget: "฿1,000,000",
      createdAt: new Date(),
    },
  };
}

describe("TorImportService after-import listeners", () => {
  it("hands the listener exactly the records the import created", async () => {
    const ids = [new ObjectId(), new ObjectId(), new ObjectId()];
    const importer = new TorImportService(importDb(ids), matching);
    const calls = [];
    importer.onImported(async (source, newIds) => calls.push({ source, newIds }));

    const result = await importer.import("egp", [imported(1), imported(2), imported(3)]);
    await flush();

    assert.equal(result.imported, 3);
    assert.deepEqual(calls, [{ source: "egp", newIds: ids }]);
  });

  it("doesn't call the listener when nothing new arrived", async () => {
    const importer = new TorImportService(importDb([]), matching);
    let called = false;
    importer.onImported(async () => (called = true));

    await importer.import("egp", [imported(1)]);
    await flush();
    assert.equal(called, false);
  });

  it("finishes the import even when the listener fails or never returns", async () => {
    const importer = new TorImportService(importDb([new ObjectId()]), matching);
    importer.onImported(async () => {
      throw new Error("Vertex AI is down");
    });
    importer.onImported(() => new Promise(() => {}));

    const result = await importer.import("egp", [imported(1)]);
    await flush();
    assert.equal(result.imported, 1);
  });
});

/** An ExtractionService over a fake collection; `read` stands in for one model call. */
function extractionWith(pending, read = async () => {}) {
  const queries = [];
  const db = {
    tors: {
      find: (filter) => {
        queries.push(filter);
        const busy = new Set((filter._id.$nin ?? []).map(String));
        const scoped = filter._id.$in ? new Set(filter._id.$in.map(String)) : null;
        const rows = pending.filter((id) => !busy.has(String(id)) && (!scoped || scoped.has(String(id))));
        return { toArray: async () => rows.map((_id) => ({ _id })) };
      },
      updateOne: async () => ({}),
    },
  };
  const service = new ExtractionService(db, {}, {}, {}, {});
  const reads = [];
  service.extractForTor = async (id) => {
    reads.push(id);
    await read(id);
  };
  return { service, queries, reads };
}

describe("ExtractionService.extractImported", () => {
  it("reads only the records it was given", async () => {
    const [a, b, older] = [new ObjectId(), new ObjectId(), new ObjectId()];
    const { service, queries, reads } = extractionWith([a, b, older]);

    const result = await service.extractImported([a, b]);
    assert.deepEqual(queries[0]._id.$in, [a, b]);
    assert.deepEqual(reads.sort(), [a.toString(), b.toString()].sort());
    assert.equal(result.extracted, 2);
  });

  it("makes no model call when none of them is waiting", async () => {
    const { service, reads } = extractionWith([]);
    const result = await service.extractImported([new ObjectId()]);
    assert.equal(reads.length, 0);
    assert.equal(result.attempted, 0);
  });

  it("records a failed read on that record and carries on with the rest", async () => {
    const [bad, good] = [new ObjectId(), new ObjectId()];
    const { service } = extractionWith([bad, good], async (id) => {
      if (id === bad.toString()) throw new Error("Vertex returned invalid JSON");
    });
    const failures = [];
    service.recordFailure = async (id) => failures.push(String(id));

    const result = await service.extractImported([bad, good]);
    assert.equal(result.failed, 1);
    assert.equal(result.extracted, 1);
    assert.deepEqual(failures, [bad.toString()]);
  });

  it("never reads one record twice when the hourly run overlaps the after-import read", async () => {
    const id = new ObjectId();
    let release;
    const gate = new Promise((resolve) => (release = resolve));
    const { service, reads } = extractionWith([id], () => gate);

    const hourly = service.extractPending();
    await flush();
    const afterImport = service.extractImported([id]);
    await flush();
    release();
    await Promise.all([hourly, afterImport]);

    assert.equal(reads.length, 1);
  });
});
