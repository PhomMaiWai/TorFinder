import { ZipEntry } from "./zip";

/**
 * Which files in a procurement bundle are worth a model call. The national
 * e-GP and MEA both zip the same generated set — the bidding document, the
 * agency's TOR and a stack of standard forms — so one picker serves both.
 */

const PDF_MAGIC = "%PDF-";

/** The bidding document e-GP generates: conditions, qualifications, payment, penalties. */
const BIDDING_DOCUMENT = /^doc_.*\.pdf$/i;
/**
 * The standard forms every bundle carries — bonds, price sheets, definitions,
 * the contract template — which say nothing about this project in particular.
 * What is left after them is the agency's own TOR.
 */
const STANDARD_FORM = /quotation|bond|definition|document part|notice|noltice|domestic|performance|contract|annoudoc|payment|action_plan/i;

export const isPdf = (bytes: Buffer) => bytes.subarray(0, PDF_MAGIC.length).toString("latin1") === PDF_MAGIC;

const baseName = (path: string) => path.split(/[\\/]/).pop() ?? path;

export type BundleDocument = { kind: "bidding" | "tor"; label: string; pdf: Buffer };

/**
 * The bidding document and the TOR out of a bundle, in that order, as long as
 * they fit in `maxBytes` together. The TOR is the largest PDF that isn't a
 * standard form: agencies name it however they like, but it is always the bulk
 * of the bundle. An entry whose bytes aren't a PDF is skipped, whatever its name.
 */
export async function pickTenderPdfs(
  entries: ZipEntry[],
  maxBytes: number,
  labels: { bidding: string; tor: string },
): Promise<BundleDocument[]> {
  const pdfs = entries.filter((entry) => /\.pdf$/i.test(entry.name) && entry.size > 0);
  const bidding = pdfs.find((entry) => BIDDING_DOCUMENT.test(baseName(entry.name)));
  const tor = pdfs
    .filter((entry) => entry !== bidding && !STANDARD_FORM.test(baseName(entry.name)))
    .sort((a, b) => b.size - a.size)[0];

  const picked: BundleDocument[] = [];
  let room = maxBytes;
  for (const [entry, kind] of [
    [bidding, "bidding"],
    [tor, "tor"],
  ] as const) {
    if (!entry || entry.size > room) continue;
    const pdf = await entry.readAsync();
    if (!isPdf(pdf)) continue;
    picked.push({ kind, label: labels[kind], pdf });
    room -= pdf.byteLength;
  }
  return picked;
}
