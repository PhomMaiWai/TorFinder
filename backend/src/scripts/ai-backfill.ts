import "reflect-metadata";

import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";

import { AppModule } from "../app.module";
import { ExtractionService } from "../ai/extraction.service";
import { COVERAGE_BUCKETS, CoverageReport, ESTIMATED_USD_PER_EXTRACTION } from "../ai/extraction-coverage";
import { VertexClient } from "../ai/vertex.client";

/**
 * One-off catch-up for the AI extraction backlog (KPI K7, issue #399). The
 * hourly run reads 25 records at most and only those from the last 90 days,
 * so a backlog of a few hundred takes days, and older records never.
 *
 * Counts first, always: with no --apply it prints why each record is or isn't
 * read, how many this run would try and a rough Vertex AI cost, and calls no
 * model. Nothing is read until you pass --apply.
 *
 *   npm run ai-backfill --prefix backend                                   # count only
 *   npm run ai-backfill --prefix backend -- --apply --max=100              # read up to 100
 *   npm run ai-backfill --prefix backend -- --apply --max=600 --include-older --retry-failed
 *
 * --include-older  also read records announced more than 90 days ago
 * --retry-failed   give records that failed before one more try each
 * --max=N          stop after trying N records (default 100)
 *
 * (Build first — `npm run build --prefix backend` — this runs the compiled
 * dist/, same as `npm start`. Needs VERTEX_PROJECT_ID and Google credentials
 * for --apply, like the backend itself.)
 */
async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const includeOlder = args.includes("--include-older");
  const retryFailed = args.includes("--retry-failed");
  const maxArg = args.find((arg) => arg.startsWith("--max="));
  const max = maxArg ? Number(maxArg.slice("--max=".length)) : 100;
  if (!Number.isInteger(max) || max < 1) throw new Error(`--max must be a positive whole number, got ${maxArg}`);

  const app = await NestFactory.createApplicationContext(AppModule, { logger: ["log", "error", "warn"] });
  const logger = new Logger("AiBackfill");
  const extraction = app.get(ExtractionService);

  const before = await extraction.coverage();
  print(logger, "Before", before);

  const eligible =
    before.buckets.waiting +
    (includeOlder ? before.buckets["too-old"] : 0) +
    (retryFailed ? before.buckets["gave-up"] + before.buckets["cooling-down"] : 0);
  const planned = Math.min(eligible, max);
  logger.log(
    `This run would try ${planned} record(s) of ${eligible} eligible ` +
      `(about $${(planned * ESTIMATED_USD_PER_EXTRACTION).toFixed(2)} of Vertex AI at ` +
      `$${ESTIMATED_USD_PER_EXTRACTION} a record — a rough estimate; the "Vertex …" log lines show the real usage).`,
  );

  if (!apply) {
    logger.log("Nothing read. Re-run with --apply to read them.");
    await app.close();
    return;
  }
  if (!app.get(VertexClient).isConfigured) {
    throw new Error("VERTEX_PROJECT_ID is empty — set it (and Google credentials) to read documents.");
  }

  const result = await extraction.backfill({ max, includeOlder, retryFailed });
  logger.log(
    `Done in ${result.batches} batch(es): ${result.extracted} read, ${result.skipped} with nothing usable, ` +
      `${result.failed} failed, of ${result.attempted} tried` +
      (retryFailed ? ` (${result.failuresCleared} earlier failure(s) cleared first)` : ""),
  );
  print(logger, "After", await extraction.coverage());
  await app.close();
}

function print(logger: Logger, label: string, report: CoverageReport) {
  const pct = (part: number, whole: number) => (whole ? `${Math.round((part / whole) * 100)}%` : "–");
  logger.log(
    `${label}: K7 = ${report.recentRead} of ${report.recent} readable from the last 90 days ` +
      `(${pct(report.recentRead, report.recent)}); all ages ${report.read} of ${report.readable} ` +
      `(${pct(report.read, report.readable)}); ${report.total} listed`,
  );
  for (const bucket of COVERAGE_BUCKETS) {
    logger.log(`  ${bucket.padEnd(13)} ${String(report.buckets[bucket]).padStart(5)}`);
  }
  for (const { reason, count } of report.failureReasons) {
    logger.log(`  failure x${count}: ${reason}`);
  }
}

main().catch((error) => {
  new Logger("AiBackfill").error(error instanceof Error ? error.stack : String(error));
  process.exitCode = 1;
});
