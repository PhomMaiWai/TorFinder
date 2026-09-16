import { Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";

import { mapWithLimit } from "../common/concurrency";
import { SOFTWARE_SEARCH_KEYWORDS, isSoftwareProject } from "../common/software-filter";
import { env } from "../config/env";
import { DatabaseService, SyncRunDoc, SyncRunStatus } from "../database/database.service";
import { EgpClient } from "./egp.client";
import { EGP_ANNOUNCE_TYPES, EgpAnnounceType } from "./egp.constants";
import { EgpAnnouncement, EgpProject, EgpProjectDetail } from "./egp.types";
import { ImportRecord, SyncResult, TorImportService } from "../tor/tor-import.service";
import { UNKNOWN, formatBaht } from "../tor/tor-normalize";

/** What a project's own announcements and detail record contribute per type. */
type ProjectEnrichment = {
  announcements: EgpAnnouncement[];
  detail: EgpProjectDetail | null;
};

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
 * Bumped whenever enrichment starts collecting something new (currently the
 * announcement document list). Records enriched by an older version are
 * refetched once, spread over syncs by the usual wall-clock budget.
 */
const ENRICH_VERSION = 3;

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
      const result = await this.runSync();
      await this.recordRun(startedAt, result);
      return result;
    } catch (error) {
      await this.recordRun(startedAt, null, error);
      throw error;
    }
  }

  private async recordRun(startedAt: Date, result: SyncResult | null, error?: unknown): Promise<void> {
    const doc: SyncRunDoc = result
      ? {
          startedAt,
          finishedAt: new Date(),
          status: result.failed.length > 0 ? "partial" : "success",
          fetched: result.fetched,
          imported: result.imported,
          updated: result.updated,
          failedFeeds: result.failed,
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

  private async runSync(): Promise<SyncResult> {
    const { projects, failed } = await this.collectProjects();

    if (failed.length && projects.size === 0) {
      throw new ServiceUnavailableException("ดึงข้อมูลจากระบบ e-GP ไม่สำเร็จ");
    }
    if (projects.size === 0) {
      return { fetched: 0, imported: 0, updated: 0, skipped: 0, superseded: 0, failed };
    }

    const records = await this.withEnrichment([...projects.values()]);
    const result = await this.importer.import("egp", records);
    await this.importer.purge("egp", (doc) => isSoftwareProject(doc.title, doc.goodsCategory));

    return { ...result, failed };
  }

  /**
   * Searches every keyword against every announcement type and collapses the
   * results, so a project matching several keywords is only carried once.
   */
  private async collectProjects(): Promise<{
    projects: Map<string, { project: EgpProject; type: EgpAnnounceType }>;
    failed: string[];
  }> {
    const queries = EGP_ANNOUNCE_TYPES.flatMap((type) =>
      SOFTWARE_SEARCH_KEYWORDS.map((keyword) => ({ type, keyword })),
    );

    const projects = new Map<string, { project: EgpProject; type: EgpAnnounceType }>();
    const failed: string[] = [];

    // Each query is a few sequential page requests; running the queries in a
    // bounded pool turns a minute of waiting into seconds without bursting.
    await mapWithLimit(
      queries,
      env.egp.concurrency,
      () => true,
      async ({ type, keyword }) => {
        try {
          for (let page = 1; page <= env.egp.maxPages; page++) {
            const body = await this.client.searchProjects(type.id, page, keyword);
            for (const project of body.data ?? []) {
              // The portal's text search is loose; this keeps the import to
              // software / IT work instead of every procurement that happens to
              // contain the keyword.
              if (!isSoftwareProject(project.projectName)) continue;
              projects.set(sourceRefFor(project, type), { project, type });
            }
            if (!body.hasNextPage) break;
          }
        } catch {
          failed.push(`${type.code}/${keyword || "all"}`);
        }
      },
    );

    return { projects, failed };
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
        const [announcements, detail] = await Promise.all([
          this.client.announcements(projectId).catch(() => []),
          this.client.projectDetail(projectId).catch(() => null),
        ]);
        enrichment.set(projectId, { announcements, detail });
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

    // The document itself when e-GP has one on file; otherwise the project's
    // own listing page, so the link is never a dead end.
    const sourceUrl =
      announcement?.id && announcement.projectAnnouncementPath
        ? this.client.fileUrl(announcement.id, announcement.projectAnnouncementPath)
        : this.client.listingUrl(project.projectId);

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
    // enrichment is only real when this run actually fetched it — without it
    // `sourceUrl` is the project's listing page rather than the document, which
    // is fine on a new record and a downgrade on one an earlier sync enriched.
    const enrichmentFields = {
      documents: documents.length ? documents : undefined,
      procurementMethod: detail?.masterMethodIdName ?? undefined,
      procurementType: detail?.masterTypeIdName ?? undefined,
      goodsCategory: detail?.masterGoodsIdName ?? undefined,
      contractStatus: detail?.masterContractAvailableName ?? undefined,
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

    return enrichment ? { doc: { ...doc, ...enrichmentFields } } : { doc, provisional: ["sourceUrl"] };
  }
}
