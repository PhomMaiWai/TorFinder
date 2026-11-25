import { PROJECT_NUMBER } from "../gproc/gproc.constants";
import { EXTRACTABLE_DOCUMENT_PATTERN } from "../tor/tor-documents";
import { ACTIONABLE_WINDOW_MS, STAGE } from "../tor/tor.constants";
import { AI_REQUEST } from "./ai.constants";

/**
 * Why a listed record has, or hasn't, been read by the AI — one reason each,
 * checked in this order, so the buckets add up to the whole collection:
 *
 * - `read`: has an extraction (an older version still counts; it is re-read
 *   in the background, but its fields are already on the page)
 * - `no-document`: nothing the queue can open — no PDF or bundle link, and no
 *   e-GP project number to fetch the TOR by
 * - `gave-up`: failed `maxAttempts` times and is no longer retried
 * - `cooling-down`: failed recently and waits out the retry cooldown
 * - `too-old`: announced before the 90-day window the background queue reads
 * - `waiting`: in the queue, not reached yet
 */
export type CoverageBucket = "read" | "no-document" | "gave-up" | "cooling-down" | "too-old" | "waiting";

export const COVERAGE_BUCKETS: readonly CoverageBucket[] = [
  "read",
  "no-document",
  "gave-up",
  "cooling-down",
  "too-old",
  "waiting",
];

/** The fields of a stored record the classification looks at. */
export type CoverageRecord = {
  stage: string;
  createdAt: Date;
  sourceRef?: string;
  projectNumber?: string;
  documents?: { url: string }[];
  extraction?: unknown;
  extractionFailure?: { reason?: string; failedAt?: Date; attempts?: number };
};

const EXTRACTABLE = new RegExp(EXTRACTABLE_DOCUMENT_PATTERN, "i");

/**
 * Whether the queue has anything to read for this record — the same three ways
 * in as `ExtractionService.pendingFilter()`, written out for one record.
 */
export function hasReadableSource(record: CoverageRecord): boolean {
  return (
    (record.documents ?? []).some((doc) => EXTRACTABLE.test(doc.url)) ||
    (record.sourceRef?.startsWith("gproc:") === true && record.stage === STAGE.invitation) ||
    (record.projectNumber !== undefined && PROJECT_NUMBER.test(record.projectNumber))
  );
}

export function classifyCoverage(record: CoverageRecord, now = Date.now()): CoverageBucket {
  if (record.extraction) return "read";
  if (!hasReadableSource(record)) return "no-document";

  const failure = record.extractionFailure;
  if (failure) {
    if ((failure.attempts ?? 0) >= AI_REQUEST.maxAttempts) return "gave-up";
    if (failure.failedAt && failure.failedAt.getTime() >= now - AI_REQUEST.retryAfterMs) return "cooling-down";
  }

  if (record.createdAt.getTime() < now - ACTIONABLE_WINDOW_MS) return "too-old";
  return "waiting";
}

export type CoverageReport = {
  /** Listed records (not deleted, not classified not-software). */
  total: number;
  /** Records with at least one `documents` entry: K7's denominator before v1.1. */
  withDocuments: number;
  /** Records the queue can open (everything but `no-document`), of any age. */
  readable: number;
  read: number;
  /**
   * K7 as measured: readable records announced in the last 90 days — the
   * window the queue reads and the one bids and match alerts are still about.
   */
  recent: number;
  recentRead: number;
  buckets: Record<CoverageBucket, number>;
  /** The same split, for the records with at least one `documents` entry. */
  bucketsWithDocuments: Record<CoverageBucket, number>;
  /** The most common failure messages, for the `gave-up` and `cooling-down` buckets. */
  failureReasons: { reason: string; count: number }[];
};

const emptyBuckets = (): Record<CoverageBucket, number> =>
  Object.fromEntries(COVERAGE_BUCKETS.map((bucket) => [bucket, 0])) as Record<CoverageBucket, number>;

/** The K7 table: every listed record, by why it has or hasn't been read. */
export function summarizeCoverage(records: CoverageRecord[], now = Date.now()): CoverageReport {
  const buckets = emptyBuckets();
  const bucketsWithDocuments = emptyBuckets();
  const reasons = new Map<string, number>();
  let withDocuments = 0;
  let recent = 0;
  let recentRead = 0;

  for (const record of records) {
    const bucket = classifyCoverage(record, now);
    buckets[bucket]++;
    if (bucket !== "no-document" && record.createdAt.getTime() >= now - ACTIONABLE_WINDOW_MS) {
      recent++;
      if (bucket === "read") recentRead++;
    }
    if (record.documents?.length) {
      withDocuments++;
      bucketsWithDocuments[bucket]++;
    }
    if (bucket === "gave-up" || bucket === "cooling-down") {
      // Numbers and URLs vary per record; the message around them is the reason.
      const reason = (record.extractionFailure?.reason ?? "unknown").replace(/\d+/g, "N").slice(0, 120);
      reasons.set(reason, (reasons.get(reason) ?? 0) + 1);
    }
  }

  return {
    total: records.length,
    withDocuments,
    readable: records.length - buckets["no-document"],
    read: buckets.read,
    recent,
    recentRead,
    buckets,
    bucketsWithDocuments,
    failureReasons: [...reasons]
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10),
  };
}

/**
 * Rough Vertex AI cost of one extraction with gemini-2.5-flash, in US dollars:
 * about 20k input tokens (a TOR and bidding document of a few dozen pages, at
 * ~258 tokens a page) at $0.30 per million, and about 5k output tokens (the JSON
 * answer plus up to 4k of reasoning) at $2.50 per million. Only for sizing a
 * backfill before it runs — the real figures are the `Vertex …` usage lines the
 * client logs for every call.
 */
export const ESTIMATED_USD_PER_EXTRACTION = 0.02;
