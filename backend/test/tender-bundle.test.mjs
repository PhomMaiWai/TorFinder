// Which files of a procurement bundle the extractor hands to the model: the
// bidding document and the agency's TOR, never the standard forms, and never a
// file whose bytes aren't a PDF. Shared by the national e-GP and MEA bundles.
// Loaded from dist like the other logic-only suites — run `npm run build` first.

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { pickTenderPdfs } from "../dist/common/tender-bundle.js";
import { readZip } from "../dist/common/zip.js";
import { writeZip } from "../dist/common/zip-writer.js";

const pdf = (text, padding = 0) => Buffer.from(`%PDF-1.4\n${text}\n${"x".repeat(padding)}`);
const LABELS = { bidding: "bidding", tor: "tor" };

describe("pickTenderPdfs", () => {
  it("takes the bidding document and the largest non-form PDF, in that order", async () => {
    const zip = writeZip([
      { name: "69059146792/bid_bond.pdf", data: pdf("bond", 5000) },
      { name: "69059146792/TOR_AI_software.pdf", data: pdf("tor", 2000) },
      { name: "69059146792/doc_69059146792.pdf", data: pdf("bidding") },
      { name: "69059146792/quotation.pdf", data: pdf("quotation", 9000) },
      { name: "69059146792/readme.txt", data: Buffer.from("hello") },
    ]);
    const picked = await pickTenderPdfs(readZip(zip), 1_000_000, LABELS);
    assert.deepEqual(
      picked.map((doc) => [doc.kind, doc.label, doc.pdf.toString("latin1").split("\n")[1]]),
      [
        ["bidding", "bidding", "bidding"],
        ["tor", "tor", "tor"],
      ],
    );
  });

  it("skips a file that fails the PDF magic check and whatever does not fit", async () => {
    const zip = writeZip([
      { name: "doc_1.pdf", data: Buffer.from("<html>error</html>") },
      { name: "tor.pdf", data: pdf("tor", 500) },
    ]);
    assert.deepEqual(await pickTenderPdfs(readZip(zip), 100, LABELS), []);
    const picked = await pickTenderPdfs(readZip(zip), 1_000_000, LABELS);
    assert.deepEqual(picked.map((doc) => doc.kind), ["tor"]);
  });
});
