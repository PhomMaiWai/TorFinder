import { ConflictException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { randomUUID } from "node:crypto";

import { isSoftwareProject } from "../common/software-filter";
import { DatabaseService } from "../database/database.service";
import { ImportRecord, TorImportService, summarizeSync } from "../tor/tor-import.service";
import { ACTIONABLE_WINDOW_MS, DECIDED_STAGES, TOR_STAGES } from "../tor/tor.constants";
import { UNKNOWN, formatBaht, parseDate } from "../tor/tor-normalize";
import { GprocClient } from "./gproc.client";
import {
  GPROC_ANNOUNCE_TYPES,
  GPROC_CANCELLED,
  GPROC_REQUEST,
  PROJECT_NUMBER,
  gprocProjectUrl,
} from "./gproc.constants";
import { GprocAnnouncement, GprocOutcome, GprocProjectDetail, GprocRun } from "./gproc.types";

const AWARD_STAGE = TOR_STAGES[2];
const CANCELLED_STATUS = "ยกเลิกโครงการ";
/** How far back the scheduled refresh looks: older projects have long been decided. */
const REFRESH_WINDOW_MS = 180 * 86_400_000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * One project read from process5, as the record it becomes — or null when the
 * project has no announcement a company can act on yet (only a plan).
 * The stage is the latest announcement that has one; a withdrawal or a price
 * notice never moves a project backwards.
 */
/** The last element matching, without the ES2023 lib this build targets below. */
function lastWhere<T>(items: T[], matches: (item: T) => unknown): T | undefined {
  for (let i = items.length - 1; i >= 0; i--) if (matches(items[i])) return items[i];
  return undefined;
}

export function toImportRecord(
  detail: GprocProjectDetail,
  rows: GprocAnnouncement[],
  now = new Date(),
): ImportRecord | null {
  const current = lastWhere(rows, (row) => GPROC_ANNOUNCE_TYPES[row.announceType]?.stage);
  const type = current && GPROC_ANNOUNCE_TYPES[current.announceType];
  if (!current || !type?.stage || !detail.projectName) return null;

  const code = detail.projectId;
  const pageUrl = gprocProjectUrl(code);
  const agency = [detail.deptName, detail.deptSubName].filter(Boolean).join(" · ") || UNKNOWN;
  const referencePrice = lastWhere(rows, (row) => row.priceBuild)?.priceBuild ?? undefined;

  return {
    doc: {
      title: detail.projectName,
      agency,
      // process5 publishes the reference price, never the budget.
      budget: UNKNOWN,
      // The bid date is printed only inside the invitation; the extractor reads it.
      deadline: UNKNOWN,
      daysLeft: 0,
      match: 0,
      tags: [type.label],
      stage: type.stage,
      summary: [
        `${type.label}ของโครงการ "${detail.projectName}"`,
        `โดย${agency} (เลขที่โครงการ ${code})`,
        referencePrice ? `ราคากลาง ${formatBaht(referencePrice)}` : null,
        "รายละเอียดฉบับเต็มอยู่ในระบบ e-GP กรมบัญชีกลาง",
      ]
        .filter(Boolean)
        .join(" · "),
      createdAt: parseDate(current.announceDate) ?? now,
      sourceRef: `gproc:${code}:${current.announceType}`,
      sourceUrl: pageUrl,
      projectNumber: code,
      referencePrice,
      contractStatus: detail.projectStatus === GPROC_CANCELLED ? CANCELLED_STATUS : undefined,
      // Newest first, like every other source. Each row opens the project's
      // page: process5 renders its documents on demand, there is no file URL.
      documents: rows
        .map((row) => ({
          label: GPROC_ANNOUNCE_TYPES[row.announceType]?.label ?? row.announceType,
          publishedAt: parseDate(row.announceDate),
          url: pageUrl,
        }))
        .reverse(),
    },
  };
}

/**
 * Imports projects from the national e-GP by number. The numbers come from an
 * admin's own search on process5 (the extension collects them), because the
 * search itself is behind a bot check this app does not try to pass.
 *
 * Runs are serial and slow on purpose — one project at a time with a pause
 * between — and stop after a few consecutive failures, since that means the
 * portal is down rather than one project being broken.
 */
@Injectable()
export class GprocService {
  private readonly logger = new Logger(GprocService.name);
  /** Recent runs, newest last; the extension polls one by id. */
  private readonly runs = new Map<string, GprocRun>();
  private active = false;

  constructor(
    private readonly db: DatabaseService,
    private readonly client: GprocClient,
    private readonly importer: TorImportService,
  ) {}

  /** Starts a capture in the background and returns its run to poll. */
  startCapture(projectNumbers: string[]): GprocRun {
    if (this.active) throw new ConflictException("มีการนำเข้าที่กำลังประมวลผลอยู่ รอให้เสร็จก่อน");

    const codes = [...new Set(projectNumbers)]
      .filter((code) => PROJECT_NUMBER.test(code))
      .slice(0, GPROC_REQUEST.maxPerCapture);
    const run = this.newRun(codes.length);

    this.active = true;
    void this.process(run, codes, { skipKnown: true }).finally(() => {
      this.active = false;
    });
    return run;
  }

  getRun(id: string): GprocRun {
    const run = this.runs.get(id);
    if (!run) throw new NotFoundException("ไม่พบการนำเข้านี้");
    return run;
  }

  /**
   * Re-reads the projects imported from here that are still in play, so a
   * draft becomes an invitation and an invitation a winner without anyone
   * capturing it again. Decided and cancelled projects are left alone.
   */
  async refresh(): Promise<string> {
    if (this.active) return "skipped — a capture is running";
    const codes = await this.db.tors.distinct("projectNumber", {
      sourceRef: { $regex: "^gproc:" },
      deletedAt: { $exists: false },
      stage: { $ne: AWARD_STAGE },
      contractStatus: { $ne: CANCELLED_STATUS },
      createdAt: { $gte: new Date(Date.now() - REFRESH_WINDOW_MS) },
    });
    if (codes.length === 0) return "nothing to refresh";

    this.active = true;
    try {
      const run = await this.process(this.newRun(codes.length), codes as string[], { skipKnown: false });
      return `${run.counts.created} new, ${run.counts.updated} updated, ${run.counts.failed} failed`;
    } finally {
      this.active = false;
    }
  }

  /**
   * Re-reads the procurement step of every project still in play, whichever
   * portal it came from — the one fact that says for certain whether bidding
   * is over. A project already decided is not asked again.
   */
  async refreshSteps(): Promise<string> {
    const numbers = (await this.db.tors.distinct("projectNumber", {
      deletedAt: { $exists: false },
      stage: { $ne: AWARD_STAGE },
      projectNumber: { $regex: PROJECT_NUMBER.source },
      createdAt: { $gte: new Date(Date.now() - ACTIONABLE_WINDOW_MS) },
      "procurementStep.stage": { $nin: [...DECIDED_STAGES] },
    })) as string[];

    let updated = 0;
    let consecutiveFailures = 0;
    for (const projectNumber of numbers) {
      if (consecutiveFailures >= GPROC_REQUEST.breaker) break;
      try {
        const step = await this.client.procurementStep(projectNumber);
        consecutiveFailures = 0;
        if (step) {
          await this.db.tors.updateMany(
            { projectNumber },
            { $set: { procurementStep: { ...step, checkedAt: new Date() } } },
          );
          updated++;
        }
      } catch (error) {
        consecutiveFailures++;
        this.logger.warn(`process5 step ${projectNumber}: ${String(error)}`);
      }
      await sleep(GPROC_REQUEST.delayMs);
    }
    return `${updated}/${numbers.length} procurement steps read`;
  }

  private newRun(total: number): GprocRun {
    const run: GprocRun = {
      id: randomUUID(),
      status: "running",
      startedAt: new Date(),
      total,
      counts: { created: 0, updated: 0, known: 0, skipped: 0, failed: 0 },
      notes: [],
    };
    this.runs.set(run.id, run);
    // Map keeps insertion order: the first key is the oldest run.
    if (this.runs.size > GPROC_REQUEST.runsKept) this.runs.delete(this.runs.keys().next().value!);
    return run;
  }

  private async process(run: GprocRun, codes: string[], { skipKnown }: { skipKnown: boolean }): Promise<GprocRun> {
    // Projects another portal already covers are richer there (files,
    // contracts) — reading them again here would only cost the portal requests.
    const known = skipKnown ? await this.coveredElsewhere(codes) : new Set<string>();
    const records: ImportRecord[] = [];
    let consecutiveFailures = 0;

    const note = (outcome: GprocOutcome, code: string, why: string) => {
      run.counts[outcome]++;
      run.notes.push(`${code}: ${why}`);
    };

    try {
      for (const code of codes) {
        if (known.has(code)) {
          note("known", code, "มีในระบบจากแหล่งอื่นแล้ว");
          continue;
        }
        if (consecutiveFailures >= GPROC_REQUEST.breaker) {
          note("skipped", code, "หยุดชั่วคราวเพราะ e-GP ตอบผิดพลาดติดกัน");
          continue;
        }

        try {
          const detail = await this.client.projectDetail(code);
          consecutiveFailures = 0;
          if (!detail) {
            note("skipped", code, "ไม่พบโครงการใน e-GP");
          } else if (!isSoftwareProject(detail.projectName ?? "")) {
            note("skipped", code, "ไม่ใช่งานซอฟต์แวร์/IT");
          } else {
            const record = toImportRecord(detail, await this.client.announcements(detail));
            if (record) records.push(record);
            else note("skipped", code, "ยังไม่มีประกาศที่ยื่นข้อเสนอได้");
          }
        } catch (error) {
          consecutiveFailures++;
          note("failed", code, error instanceof Error ? error.message : String(error));
        }
        await sleep(GPROC_REQUEST.delayMs);
      }

      // One import for the whole batch: each import recomputes every budget
      // verdict, which is worth paying once, not per project.
      if (records.length) {
        const result = await this.importer.import("gproc", records);
        run.counts.created += result.imported;
        run.counts.updated += result.updated;
        run.counts.known += result.skipped;
        this.logger.log(`process5: ${summarizeSync({ ...result, failed: [] })}`);
      }
      run.status = "done";
    } catch (error) {
      run.status = "failed";
      run.notes.push(error instanceof Error ? error.message : String(error));
      this.logger.error(`process5 run ${run.id} failed: ${String(error)}`);
    }

    run.finishedAt = new Date();
    return run;
  }

  private async coveredElsewhere(codes: string[]): Promise<Set<string>> {
    const numbers = await this.db.tors.distinct("projectNumber", {
      projectNumber: { $in: codes },
      sourceRef: { $not: /^gproc:/ },
      deletedAt: { $exists: false },
    });
    return new Set(numbers as string[]);
  }
}
