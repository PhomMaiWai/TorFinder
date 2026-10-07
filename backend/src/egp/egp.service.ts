import { Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";

import { mapWithLimit } from "../common/concurrency";
import { SOFTWARE_SEARCH_KEYWORDS, isSoftwareProject } from "../common/software-filter";
import { env } from "../config/env";
import { DatabaseService, SyncRunDoc, SyncRunStatus } from "../database/database.service";
import { EgpClient } from "./egp.client";
import { EGP_ANNOUNCE_TYPES, EgpAnnounceType } from "./egp.constants";
import { STAGE } from "../tor/tor.constants";
import { EgpAnnouncement, EgpContract, EgpProject, EgpProjectDetail } from "./egp.types";
import { ImportRecord, SyncResult, TorImportService } from "../tor/tor-import.service";
import { UNKNOWN, formatBaht, parseDate, projectMonth } from "../tor/tor-normalize";
import { TorContract } from "../database/database.service";

/** What a project's own announcements and detail record contribute per type. */
type ProjectEnrichment = {
  announcements: EgpAnnouncement[];
  detail: EgpProjectDetail | null;
  contracts: EgpContract[];
};

function toContract(contract: EgpContract): TorContract | null {
  const vendor = contract.projectContractBidderName?.trim();
  if (!vendor) return null;
  return {
    vendor,
    number: contract.projectContractContractNumberEgp?.trim() || null,
    signedAt: parseDate(contract.projectContractContractDate),
    amount: Number(contract.projectContractContractBudget) || null,
    startsAt: parseDate(contract.projectContractContractStartDate),
    endsAt: parseDate(contract.projectContractContractEndDate),
    durationDays: Number(contract.projectContractContractDeadline) || null,
  };
}

/** One run.service.recordRun() row, reshaped for the wire (ISO dates, no _id). */
export type SyncHistoryEntry = {
  startedAt: string;
  finishedAt: string;
  status: SyncRunStatus;
  fetched: number;
  imported: number;
  updated: number;
  failedFeeds: string[];
  /** Present only on a "failed" entry. */
  error?: string;
};

export type EgpMetrics = {
  /** "idle" only before the very first sync has ever run. */
  status: SyncRunStatus | "idle";
  lastRunAt: string | null;
  /** Summed across every sync run that started today, not TorDoc.createdAt (see metrics()). */
  importedToday: number;
  /** Newest first, capped at METRICS_HISTORY_LIMIT runs. */
  history: SyncHistoryEntry[];
};

/** The admin dashboard shows a recent trend, not a full audit trail. */
const METRICS_HISTORY_LIMIT = 20;

/**
 * Bumped whenever enrichment starts collecting something new (v4: the signed
 * contracts). Records enriched by an older version are refetched once, spread
 * over syncs by the usual wall-clock budget.
 */
const ENRICH_VERSION = 4;

/**
 * Titles that read like IT work. The software filter decides what is imported;
 * this only flags what it turned down for a person to look at, so it is broad.
 */
const LOOKS_LIKE_IT =
  /คอมพิวเตอร์|ซอฟต์|ซอฟท์|โปรแกรม|แอปพลิ|แอพพลิ|เว็บ|สารสนเทศ|ฐานข้อมูล|ดิจิทัล|ดิจิตอล|เครือข่าย|อินเทอร์เน็ต|ออนไลน์|คลาวด์|software|server|cloud|\bAI\b|\bIT\b/i;
/**
 * Rejections that are rejected on purpose — supplies, medical imaging, direct
 * purchases — and would bury the few worth a second look.
 */
const KNOWN_NOT_IT = /วัสดุ|เอกซเรย์|เอ็กซเรย์|เฉพาะเจาะจง|เครื่องเสียง/;

/** Pages read per keyword for award notices — the newest are the useful ones. */
const AWARD_KEYWORD_PAGES = 2;
/**
 * Award searches in flight. The portal answers an award search slowly and
 * times out under a burst, and awards are the record, not the opportunity —
 * they can wait their turn.
 */
const AWARD_SEARCH_CONCURRENCY = 2;
const AWARD_STAGE = STAGE.award;

/** Near misses kept per run — the top of the list is what matters. */
const NEAR_MISS_LIMIT = 50;

type NearMiss = { projectNumber: string; title: string };

/** Stable identity of one announcement, used to keep imports idempotent. */
function sourceRefFor(project: EgpProject, type: EgpAnnounceType): string {
  return `egp:${project.projectNumber}:${type.code}`;
}

@Injectable()
export class EgpService {
  private readonly logger = new Logger(EgpService.name);

  private inFlight: Promise<SyncResult> | null = null;

  constructor(
    private readonly client: EgpClient,
    private readonly importer: TorImportService,
    private readonly db: DatabaseService,
  ) {}

  /**
   * The scheduled poll and the admin button share one run: a sync takes tens of
   * seconds, and two of them at once would double the load on the portal for
   * identical results.
   */
  sync(): Promise<SyncResult> {
    this.inFlight ??= this.runAndRecordSync().finally(() => {
      this.inFlight = null;
    });
    return this.inFlight;
  }

  /** What the admin dashboard's pipeline card and sync-history table read. */
  async metrics(): Promise<EgpMetrics> {
    // Server-local midnight — every deployment of this project runs in a
    // single timezone, so this is "today" for whoever's watching the
    // dashboard, not necessarily Bangkok's calendar day if the host clock
    // differs.
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [history, todaysRuns] = await Promise.all([
      this.db.syncRuns.find().sort({ startedAt: -1 }).limit(METRICS_HISTORY_LIMIT).toArray(),
      // Not folded into `history` above: a run older than the last
      // METRICS_HISTORY_LIMIT would silently drop out of today's total on a
      // busy day, even though it's still today.
      this.db.syncRuns
        .find({ startedAt: { $gte: startOfToday } }, { projection: { imported: 1 } })
        .toArray(),
    ]);
    const [latest] = history;
    // `TorDoc.createdAt` is the announcement's e-GP publish date, not when
    // this app imported it (see toTorDoc) — importing a project published
    // last month still counts here, which is the number a "did today's sync
    // work" card actually needs.
    const importedToday = todaysRuns.reduce((sum, run) => sum + run.imported, 0);

    return {
      status: latest?.status ?? "idle",
      lastRunAt: latest ? latest.startedAt.toISOString() : null,
      importedToday,
      history: history.map((run) => ({
        startedAt: run.startedAt.toISOString(),
        finishedAt: run.finishedAt.toISOString(),
        status: run.status,
        fetched: run.fetched,
        imported: run.imported,
        updated: run.updated,
        failedFeeds: run.failedFeeds,
        ...(run.error ? { error: run.error } : {}),
      })),
    };
  }

  /**
   * Every call to sync() — scheduled or from the admin button — becomes one
   * row in the dashboard's sync history, whether it succeeds, only partly
   * succeeds (some feeds failed but data still came back), or throws outright.
   */
  private async runAndRecordSync(): Promise<SyncResult> {
    const startedAt = new Date();
    try {
      const { result, nearMisses } = await this.runSync();
      await this.recordRun(startedAt, result, undefined, nearMisses);
      return result;
    } catch (error) {
      await this.recordRun(startedAt, null, error);
      throw error;
    }
  }

  private async recordRun(
    startedAt: Date,
    result: SyncResult | null,
    error?: unknown,
    nearMisses: NearMiss[] = [],
  ): Promise<void> {
    const doc: SyncRunDoc = result
      ? {
          startedAt,
          finishedAt: new Date(),
          status: result.failed.length > 0 ? "partial" : "success",
          fetched: result.fetched,
          imported: result.imported,
          updated: result.updated,
          failedFeeds: result.failed,
          nearMisses,
        }
      : {
          startedAt,
          finishedAt: new Date(),
          status: "failed",
          fetched: 0,
          imported: 0,
          updated: 0,
          failedFeeds: [],
          error: error instanceof Error ? error.message : String(error),
        };

    // History is a courtesy to the dashboard, not the point of a sync — a
    // failure to record it must never mask (or replace) the real outcome.
    try {
      await this.db.syncRuns.insertOne(doc);
    } catch (insertError) {
      this.logger.warn(`e-GP: failed to record sync run history: ${String(insertError)}`);
    }
  }

  /** The latest run's near misses, for the admin to check the filter against. */
  async nearMisses(): Promise<NearMiss[]> {
    const latest = await this.db.syncRuns.findOne(
      { nearMisses: { $exists: true } },
      { sort: { startedAt: -1 }, projection: { nearMisses: 1 } },
    );
    return latest?.nearMisses ?? [];
  }

  private async runSync(): Promise<{ result: SyncResult; nearMisses: NearMiss[] }> {
    const { projects, failed, nearMisses } = await this.collectProjects();

    if (failed.length && projects.size === 0) {
      throw new ServiceUnavailableException("ดึงข้อมูลจากระบบ e-GP ไม่สำเร็จ");
    }
    if (projects.size === 0) {
      return {
        result: { fetched: 0, imported: 0, updated: 0, skipped: 0, superseded: 0, failed },
        nearMisses,
      };
    }

    // The search only saw the name; the category arrives with the enrichment.
    // Judged by both before the import, the same rule the purge applies after
    // it — otherwise a record the category rules out is inserted and deleted
    // again on every sync, re-enriched each time.
    const records = (await this.withEnrichment([...projects.values()])).filter(({ doc }) =>
      this.isWanted(doc),
    );
    const result = await this.importer.import("egp", records);
    await this.importer.purge("egp", (doc) => this.isWanted(doc));

    return { result: { ...result, failed }, nearMisses };
  }

  private isWanted(doc: { title: string; goodsCategory?: string }): boolean {
    return isSoftwareProject(doc.title, doc.goodsCategory);
  }

  /**
   * How many stored e-GP records the current rules would no longer import —
   * the count a one-time clean-up shows before anyone commits to it.
   */
  previewCleanup(): Promise<number> {
    return this.importer.countOutOfScope("egp", (doc) => this.isWanted(doc));
  }

  /** Removes them. */
  cleanup(): Promise<number> {
    return this.importer.purge("egp", (doc) => this.isWanted(doc));
  }

  /**
   * Drafts and invitations — what a company can still act on — are read in
   * full: every one published in the lookback window, newest first, no search
   * terms, because a keyword search only finds titles that contain one of its
   * words. The list is sorted by publication but an old project can be
   * published late, so one old row doesn't end the scan; a page mostly of them
   * does.
   *
   * Award notices are another order of magnitude (hundreds of thousands) and
   * the portal won't page through them unfiltered, so those are still found by
   * keyword: they are the record of what was won, not an opportunity.
   */
  private async collectProjects(): Promise<{
    projects: Map<string, { project: EgpProject; type: EgpAnnounceType }>;
    failed: string[];
    nearMisses: NearMiss[];
  }> {
    const cutoff = new Date(Date.now() - env.egp.lookbackDays * 86_400_000);
    cutoff.setUTCDate(1); // project numbers carry a month, not a day

    const projects = new Map<string, { project: EgpProject; type: EgpAnnounceType }>();
    const nearMisses = new Map<string, string>();
    const failed: string[] = [];

    // One scan per announcement type, side by side; pages within a scan are
    // sequential since each decides whether the next is needed.
    const consider = (project: EgpProject, type: EgpAnnounceType) => {
      if (isSoftwareProject(project.projectName)) {
        projects.set(sourceRefFor(project, type), { project, type });
      } else if (LOOKS_LIKE_IT.test(project.projectName) && !KNOWN_NOT_IT.test(project.projectName)) {
        nearMisses.set(project.projectNumber, project.projectName.trim());
      }
    };

    const openTypes = EGP_ANNOUNCE_TYPES.filter((type) => type.stage !== AWARD_STAGE);
    const awardSearches = EGP_ANNOUNCE_TYPES.filter((type) => type.stage === AWARD_STAGE).flatMap(
      (type) => SOFTWARE_SEARCH_KEYWORDS.map((keyword) => ({ type, keyword })),
    );

    await mapWithLimit(awardSearches, AWARD_SEARCH_CONCURRENCY, () => true, async ({ type, keyword }) => {
      try {
        for (let page = 1; page <= AWARD_KEYWORD_PAGES; page++) {
          const body = await this.client.searchProjects(type.id, page, keyword);
          for (const project of body.data ?? []) {
            const month = projectMonth(project.projectNumber);
            if (!month || month >= cutoff) consider(project, type);
          }
          if (!body.hasNextPage) break;
        }
      } catch {
        failed.push(`${type.code}/${keyword}`);
      }
    });

    await mapWithLimit(openTypes, env.egp.concurrency, () => true, async (type: EgpAnnounceType) => {
      try {
        for (let page = 1; page <= env.egp.maxPages; page++) {
          const body = await this.client.searchProjects(type.id, page);
          const rows = body.data ?? [];
          let old = 0;

          for (const project of rows) {
            const month = projectMonth(project.projectNumber);
            if (month && month < cutoff) {
              old++;
              continue;
            }
            consider(project, type);
          }
          if (!body.hasNextPage || rows.length === 0 || old > rows.length / 2) break;
        }
      } catch {
        failed.push(type.code);
      }
    });

    const misses = [...nearMisses]
      .slice(0, NEAR_MISS_LIMIT)
      .map(([projectNumber, title]) => ({ projectNumber, title }));
    this.logger.log(
      `e-GP: ${projects.size} software announcements in the last ${env.egp.lookbackDays} days, ` +
        `${nearMisses.size} IT-looking titles turned down`,
    );
    return { projects, failed, nearMisses: misses };
  }

  /**
   * A project's announcements and procurement detail cost two requests, so they
   * are fetched once per distinct project — several types can share a project —
   * and only for what isn't enriched yet. On a recurring poll that skips almost
   * every request; a fresh database pays it once, bounded by a wall-clock
   * budget so a slow portal degrades the sync instead of stalling it.
   */
  private async withEnrichment(
    entries: { project: EgpProject; type: EgpAnnounceType }[],
  ): Promise<ImportRecord[]> {
    const enrichedRefs = await this.importer.enrichedRefs(
      entries.map((entry) => sourceRefFor(entry.project, entry.type)),
      ENRICH_VERSION,
    );
    const pending = entries.filter((entry) => !enrichedRefs.has(sourceRefFor(entry.project, entry.type)));
    const projectIds = [...new Set(pending.map((entry) => entry.project.projectId))];

    const enrichment = new Map<string, ProjectEnrichment>();
    const deadline = Date.now() + env.egp.enrichBudgetMs;

    const started = await mapWithLimit(
      projectIds,
      env.egp.concurrency,
      () => Date.now() < deadline,
      async (projectId) => {
        const [announcements, detail, contracts] = await Promise.all([
          this.client.announcements(projectId).catch(() => []),
          this.client.projectDetail(projectId).catch(() => null),
          this.client.contracts(projectId).catch(() => []),
        ]);
        enrichment.set(projectId, { announcements, detail, contracts });
      },
    );

    if (started < projectIds.length) {
      this.logger.warn(
        `e-GP: enrichment budget spent — ${started}/${projectIds.length} projects done, ` +
          `rest retried on the next sync`,
      );
    }
    this.logger.log(`e-GP: enriched ${started} of ${entries.length} entries`);

    return entries.map(({ project, type }) =>
      this.toTorDoc(project, type, enrichment.get(project.projectId) ?? null),
    );
  }

  /**
   * The announcement matching this specific type, e.g. the TOR draft itself.
   * Prefix match, not exact: e-GP's master name for one type has grown a
   * trailing "/ ..." clause before, and matching on the stable leading part
   * survives that instead of silently finding nothing.
   */
  private matchingAnnouncement(
    announcements: EgpAnnouncement[],
    type: EgpAnnounceType,
  ): EgpAnnouncement | undefined {
    return announcements.find((a) => a.masterAnnounceTypeName?.startsWith(type.label.split(" / ")[0]));
  }

  /**
   * A readable paragraph instead of a bare project number: the detail page's
   * lead text has to stand on its own for a citizen who never opens the PDF.
   * Only facts e-GP actually returned go in — nothing is inferred.
   */
  private buildSummary(
    project: EgpProject,
    type: EgpAnnounceType,
    detail: EgpProjectDetail | null | undefined,
    agency: string,
  ): string {
    const budget = project.projectBudget
      ? `วงเงินงบประมาณ ${formatBaht(project.projectBudget)}`
      : null;
    const facts = [
      detail?.masterMethodIdName ? `วิธี${detail.masterMethodIdName}` : null,
      detail?.masterGoodsIdName ? `หมวด${detail.masterGoodsIdName}` : null,
    ].filter(Boolean);

    return [
      `${type.label}ของโครงการ "${project.projectName.trim()}"`,
      `โดย${agency || "กรุงเทพมหานคร"} (เลขที่โครงการ ${project.projectNumber})`,
      budget,
      facts.length ? facts.join(" · ") : null,
      "รายละเอียดขอบเขตงานและเงื่อนไขฉบับเต็มอยู่ในเอกสารประกาศจากระบบ e-GP",
    ]
      .filter(Boolean)
      .join(" · ");
  }

  private toTorDoc(
    project: EgpProject,
    type: EgpAnnounceType,
    enrichment: ProjectEnrichment | null,
  ): ImportRecord {
    const agency = [project.masterOrgGroupName, project.masterOrgDepartmentName]
      .filter(Boolean)
      .join(" · ");

    const announcement = enrichment
      ? this.matchingAnnouncement(enrichment.announcements, type)
      : undefined;
    const publishedAt = announcement?.projectAnnouncementPublishDate
      ? new Date(announcement.projectAnnouncementPublishDate)
      : null;

    // "View original" opens the project's page on e-GP — every announcement and
    // its status in one place, and a page that exists for every project. The
    // files themselves are listed in `documents`.
    const sourceUrl = this.client.listingUrl(project.projectId);

    const detail = enrichment?.detail;

    // Every announcement e-GP has for this project, newest first — the detail
    // page shows them as the project's paper trail (TOR draft, invitation,
    // award), each linking to its own document.
    const documents = (enrichment?.announcements ?? [])
      .map((a) => ({
        label: a.masterAnnounceTypeName?.trim() || type.label,
        publishedAt: a.projectAnnouncementPublishDate
          ? new Date(a.projectAnnouncementPublishDate)
          : null,
        url:
          a.id && a.projectAnnouncementPath
            ? this.client.fileUrl(a.id, a.projectAnnouncementPath)
            : this.client.listingUrl(project.projectId),
      }))
      .filter((doc) => !doc.publishedAt || !Number.isNaN(doc.publishedAt.getTime()))
      .sort((a, b) => (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0));

    // Everything the portal itself published goes in on every sync. The
    // enrichment is only written when this run actually fetched it, so a sync
    // that skipped it never erases what an earlier one found.
    const enrichmentFields = {
      documents: documents.length ? documents : undefined,
      procurementMethod: detail?.masterMethodIdName ?? undefined,
      procurementType: detail?.masterTypeIdName ?? undefined,
      goodsCategory: detail?.masterGoodsIdName ?? undefined,
      contractStatus: detail?.masterContractAvailableName ?? undefined,
      contracts: (enrichment?.contracts ?? []).flatMap((c) => toContract(c) ?? []),
      // Marks that enrichment was attempted this run — not that it succeeded —
      // so a project e-GP genuinely has nothing extra for isn't retried forever.
      enrichedAt: new Date(),
      enrichVersion: ENRICH_VERSION,
    };

    const doc = {
      title: project.projectName.trim(),
      agency: agency || "กรุงเทพมหานคร",
      budget: formatBaht(project.projectBudget),
      // e-GP publishes the closing date inside the announcement document only.
      deadline: UNKNOWN,
      daysLeft: 0,
      match: 0,
      tags: [type.label],
      stage: type.stage,
      summary: this.buildSummary(project, type, detail, agency),
      // Announcement date, so listings sort by publication rather than import time.
      createdAt: publishedAt && !Number.isNaN(publishedAt.getTime()) ? publishedAt : new Date(),
      sourceRef: sourceRefFor(project, type),
      sourceUrl,
      projectNumber: project.projectNumber,
      budgetAmount: project.projectBudget || undefined,
    };

    return { doc: enrichment ? { ...doc, ...enrichmentFields } : doc };
  }
}
