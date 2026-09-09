import { Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";

import { env } from "../config/env";
import { DatabaseService, TorDoc } from "../database/database.service";
import { EgpClient } from "./egp.client";
import { EGP_ANNOUNCE_TYPES, EGP_SEARCH_KEYWORDS, EgpAnnounceType } from "./egp.constants";
import { isSoftwareProject } from "./egp.filter";
import { EgpAnnouncement, EgpProject, EgpProjectDetail } from "./egp.types";

/** What a project's own announcements and detail record contribute per type. */
type ProjectEnrichment = {
  announcements: EgpAnnouncement[];
  detail: EgpProjectDetail | null;
};

type ImportedTor = TorDoc & { sourceRef: string };

export type SyncResult = {
  fetched: number;
  imported: number;
  updated: number;
  failed: string[];
};

const UNKNOWN = "ไม่ระบุ";

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

const BAHT = new Intl.NumberFormat("th-TH", {
  style: "currency",
  currency: "THB",
  maximumFractionDigits: 0,
});

/**
 * Runs `task` over `items` with at most `limit` in flight, stopping early once
 * `withinBudget()` turns false — the remaining items are simply never started.
 */
async function mapWithLimit<T>(
  items: T[],
  limit: number,
  withinBudget: () => boolean,
  task: (item: T) => Promise<void>,
): Promise<number> {
  let next = 0;
  let started = 0;

  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length && withinBudget()) {
      const index = next++;
      started++;
      await task(items[index]);
    }
  });

  await Promise.all(workers);
  return started;
}

@Injectable()
export class EgpService {
  private readonly logger = new Logger(EgpService.name);

  private inFlight: Promise<SyncResult> | null = null;

  constructor(
    private readonly db: DatabaseService,
    private readonly client: EgpClient,
  ) {}

  /**
   * The scheduled poll and the admin button share one run: a sync takes tens of
   * seconds, and two of them at once would double the load on the portal for
   * identical results.
   */
  sync(): Promise<SyncResult> {
    this.inFlight ??= this.runSync().finally(() => {
      this.inFlight = null;
    });
    return this.inFlight;
  }

  private async runSync(): Promise<SyncResult> {
    const { projects, failed } = await this.collectProjects();

    if (failed.length && projects.size === 0) {
      throw new ServiceUnavailableException("ดึงข้อมูลจากระบบ e-GP ไม่สำเร็จ");
    }
    if (projects.size === 0) return { fetched: 0, imported: 0, updated: 0, failed };

    const docs = await this.withEnrichment([...projects.values()]);

    const result = await this.db.tors.bulkWrite(
      docs.map((doc) => {
        const {
          createdAt,
          sourceRef,
          sourceUrl,
          documents,
          procurementMethod,
          procurementType,
          goodsCategory,
          contractStatus,
          enrichedAt,
          ...core
        } = doc;
        const enrichment = {
          sourceUrl,
          documents,
          procurementMethod,
          procurementType,
          goodsCategory,
          contractStatus,
          enrichedAt,
        };

        // The Mongo driver serializes `undefined` as null instead of omitting
        // the key, so absent fields are dropped here rather than stored as an
        // explicit null.
        const withoutUndefined = (obj: Record<string, unknown>) =>
          Object.fromEntries(Object.entries(obj).filter(([, value]) => value !== undefined));

        // `doc.enrichedAt` is set only when this run actually fetched fresh
        // enrichment for the project (see toTorDoc) — as opposed to every
        // project this sync touched, which includes ones already enriched
        // earlier and deliberately left alone (see withEnrichment). Fresh data
        // is always safe to $set, insert or update alike. Everything else goes
        // to $setOnInsert: a harmless fallback the first time a project is
        // seen, and a no-op — not a downgrade — on a record that already has
        // real enrichment from a previous run. createdAt always goes through
        // $setOnInsert too, so it never drifts once a record exists.
        const isFresh = enrichedAt !== undefined;

        return {
          updateOne: {
            filter: { sourceRef },
            update: {
              $set: withoutUndefined(isFresh ? { ...core, ...enrichment } : core),
              $setOnInsert: withoutUndefined({ createdAt, sourceRef, ...(isFresh ? {} : enrichment) }),
            },
            upsert: true,
          },
        };
      }),
      { ordered: false },
    );

    await this.purgeNonSoftware();

    this.logger.log(`e-GP sync: ${result.upsertedCount} new, ${result.modifiedCount} updated`);
    return {
      fetched: docs.length,
      imported: result.upsertedCount,
      updated: result.modifiedCount,
      failed,
    };
  }

  /**
   * Earlier imports (and looser filters) left non-IT procurement in the
   * database. Imported records are disposable — the portal is the source of
   * truth — so anything that no longer reads as software work is removed.
   * Admin-entered records have no `sourceRef` and are never touched.
   */
  private async purgeNonSoftware(): Promise<void> {
    const imported = await this.db.tors
      .find({ sourceRef: { $exists: true } }, { projection: { title: 1, goodsCategory: 1 } })
      .toArray();

    const stale = imported
      .filter((doc) => !isSoftwareProject(doc.title ?? "", doc.goodsCategory))
      .map((doc) => doc._id);

    if (!stale.length) return;
    const { deletedCount } = await this.db.tors.deleteMany({ _id: { $in: stale } });
    this.logger.log(`e-GP: removed ${deletedCount} imported records that aren't software work`);
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
      EGP_SEARCH_KEYWORDS.map((keyword) => ({ type, keyword })),
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
  ): Promise<ImportedTor[]> {
    const enrichedRefs = await this.enrichedSourceRefs(entries);
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

  /** Records that already have real enrichment on file — safe to skip refetching. */
  private async enrichedSourceRefs(
    entries: { project: EgpProject; type: EgpAnnounceType }[],
  ): Promise<Set<string>> {
    const refs = entries.map((entry) => sourceRefFor(entry.project, entry.type));
    const existing = await this.db.tors
      .find(
        { sourceRef: { $in: refs }, enrichedAt: { $exists: true }, enrichVersion: ENRICH_VERSION },
        { projection: { sourceRef: 1 } },
      )
      .toArray();

    return new Set(existing.map((doc) => doc.sourceRef).filter((ref) => ref !== undefined));
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
    const budget = project.projectBudget ? `วงเงินงบประมาณ ${BAHT.format(project.projectBudget)}` : null;
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
  ): ImportedTor {
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

    return {
      title: project.projectName.trim(),
      agency: agency || "กรุงเทพมหานคร",
      budget: project.projectBudget ? BAHT.format(project.projectBudget) : UNKNOWN,
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
      documents: documents.length ? documents : undefined,
      procurementMethod: detail?.masterMethodIdName ?? undefined,
      procurementType: detail?.masterTypeIdName ?? undefined,
      goodsCategory: detail?.masterGoodsIdName ?? undefined,
      contractStatus: detail?.masterContractAvailableName ?? undefined,
      // Marks that enrichment was attempted this run — not that it succeeded —
      // so a project e-GP genuinely has nothing extra for isn't retried forever.
      enrichedAt: enrichment ? new Date() : undefined,
      enrichVersion: enrichment ? ENRICH_VERSION : undefined,
    };
  }
}
