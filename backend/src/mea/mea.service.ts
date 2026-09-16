import { Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";

import { mapWithLimit } from "../common/concurrency";
import { isSoftwareProject } from "../common/software-filter";
import { TorDoc } from "../database/database.service";
import { ActivityService } from "../activity/activity.service";
import { ImportRecord, SyncResult, TorImportService } from "../tor/tor-import.service";
import { namesSomewhereElse } from "../tor/thai-locality";
import {
  UNKNOWN,
  cleanText,
  daysUntil,
  extractProjectNumber,
  formatBaht,
  formatThaiDate,
  parseDate,
} from "../tor/tor-normalize";
import { MeaClient } from "./mea.client";
import { MEA_AGENCY, MEA_ENRICHMENT, MeaAnnounceType } from "./mea.constants";
import { MeaAnnouncement, MeaDetail } from "./mea.types";

/** Stable identity of one announcement, which is what keeps imports idempotent. */
const sourceRefFor = (type: MeaAnnounceType, keyId: string) => `mea:${type.path}:${keyId}`;

/**
 * The one date that matters per listing: a draft closes when comments close, an
 * invitation when bidding closes, and an award closes nothing.
 */
function closingDate(type: MeaAnnounceType, row: MeaAnnouncement): Date | null {
  if (type.path === "Draft") return parseDate(row.END_DT);
  if (type.path === "Procurement") return parseDate(row.BID_DT);
  return null;
}

@Injectable()
export class MeaService {
  private readonly logger = new Logger(MeaService.name);

  private inFlight: Promise<SyncResult> | null = null;

  constructor(
    private readonly activity: ActivityService,
    private readonly client: MeaClient,
    private readonly importer: TorImportService,
  ) {}

  /**
   * The scheduled poll and the admin button share one run: a sync takes tens of
   * seconds, and two at once would double the load on the portal for identical
   * results.
   */
  sync(): Promise<SyncResult> {
    this.inFlight ??= this.activity.trackSync("MEA", () => this.runSync()).finally(() => {
      this.inFlight = null;
    });
    return this.inFlight;
  }

  private async runSync(): Promise<SyncResult> {
    const { rows, failed } = await this.collect();

    if (failed.length && rows.length === 0) {
      throw new ServiceUnavailableException("ดึงข้อมูลจากระบบจัดซื้อจัดจ้าง กฟน. ไม่สำเร็จ");
    }
    if (rows.length === 0) {
      return { fetched: 0, imported: 0, updated: 0, skipped: 0, superseded: 0, failed };
    }

    const records = await this.withDetails(rows);
    const result = await this.importer.import("mea", records);
    await this.importer.purge("mea", (doc) => this.isWanted(doc.title));

    return { ...result, failed };
  }

  /**
   * Every listing, filtered down to software work before anything else looks at
   * it: the awards listing alone runs to ~10,000 rows, and the detail page of
   * each one is a request we have no reason to spend.
   */
  private async collect(): Promise<{
    rows: { type: MeaAnnounceType; row: MeaAnnouncement }[];
    failed: string[];
  }> {
    const rows: { type: MeaAnnounceType; row: MeaAnnouncement }[] = [];
    const failed: string[] = [];

    await Promise.all(
      this.client.types.map(async (type) => {
        try {
          for (const row of await this.client.announcements(type)) {
            if (row.KEY_ID && this.isWanted(row.SUBJECT)) rows.push({ type, row });
          }
        } catch {
          failed.push(type.path);
        }
      }),
    );

    return { rows, failed };
  }

  /**
   * Software work in Bangkok, which is all this product covers. The utility
   * serves the two neighbouring provinces as well, and says so when it does —
   * those announcements are for somebody else's city.
   *
   * The same rule decides what is imported and what a later run purges, so a
   * record can never sit in the database on terms the import would refuse.
   */
  private isWanted(subject: string | null | undefined): boolean {
    return isSoftwareProject(subject ?? "") && !namesSomewhereElse(subject);
  }

  /**
   * The budget and the buying department are printed on the announcement's own
   * page, not in the listing, so each new announcement costs one more request.
   * Only new ones: what an earlier sync already read is left alone, and a slow
   * portal spends the wall-clock budget instead of stalling the sync — whatever
   * is left over is picked up by the next one.
   */
  private async withDetails(
    entries: { type: MeaAnnounceType; row: MeaAnnouncement }[],
  ): Promise<ImportRecord[]> {
    const enriched = await this.importer.enrichedRefs(
      entries.map(({ type, row }) => sourceRefFor(type, row.KEY_ID)),
      MEA_ENRICHMENT.version,
    );
    const pending = entries.filter(({ type, row }) => !enriched.has(sourceRefFor(type, row.KEY_ID)));

    const details = new Map<string, MeaDetail>();
    const deadline = Date.now() + MEA_ENRICHMENT.budgetMs;

    const started = await mapWithLimit(
      pending,
      MEA_ENRICHMENT.concurrency,
      () => Date.now() < deadline,
      async ({ type, row }) => {
        const detail = await this.client.detail(type, row.KEY_ID).catch(() => null);
        if (detail) details.set(row.KEY_ID, detail);
      },
    );

    if (started < pending.length) {
      this.logger.warn(
        `MEA: detail budget spent — ${started}/${pending.length} done, rest retried next sync`,
      );
    }

    return entries.map(({ type, row }) => this.toRecord(type, row, details.get(row.KEY_ID) ?? null));
  }

  private toRecord(
    type: MeaAnnounceType,
    row: MeaAnnouncement,
    detail: MeaDetail | null,
  ): ImportRecord {
    const closesAt = closingDate(type, row);
    // The draft listing publishes the budget itself; the other two print it on
    // the detail page only.
    const budgetAmount = row.BUDGET ?? detail?.budgetAmount;
    const publishedAt = parseDate(row.POST_DT ?? row.DETAIL_DT);

    const doc = {
      title: cleanText(row.SUBJECT ?? ""),
      agency: [MEA_AGENCY, detail?.department].filter(Boolean).join(" · "),
      budget: formatBaht(budgetAmount),
      deadline: formatThaiDate(closesAt),
      daysLeft: daysUntil(closesAt),
      match: 0,
      tags: [type.label],
      stage: type.stage,
      summary: this.buildSummary(type, row, budgetAmount, detail?.awardedAmount, closesAt),
      createdAt: publishedAt ?? new Date(),
      sourceRef: sourceRefFor(type, row.KEY_ID),
      sourceUrl: this.client.detailUrl(type, row.KEY_ID),
      // MEA files the e-GP project number in a column of its own, or appends it
      // to the announcement number. Either way it is what ties this record to
      // the same project on the other portals.
      projectNumber: extractProjectNumber(row.EGP_PROJ_NO, row.PUBLISH_NO),
      budgetAmount,
      awardedAmount: detail?.awardedAmount,
      procurementMethod: row.METHOD_DESC ?? undefined,
    };

    if (detail) {
      return {
        doc: {
          ...doc,
          documents: detail.documents.length
            ? detail.documents.map((document) => ({ ...document, publishedAt }))
            : undefined,
          // Records that enrichment was attempted this run — not that the
          // portal had anything to add — so an announcement with no
          // attachments isn't refetched forever.
          enrichedAt: new Date(),
          enrichVersion: MEA_ENRICHMENT.version,
        },
      };
    }

    // No detail this run, which on a record enriched earlier means the listing
    // alone: the utility's name without the department that bought, and for
    // the two listings that publish no budget, no budget either — nor the
    // summary sentence quoting it. Marked so the upsert never writes any of
    // them over what an enriched run already stored.
    const provisional: (keyof TorDoc)[] = ["agency", "awardedAmount"];
    if (row.BUDGET === null || row.BUDGET === undefined) {
      provisional.push("budget", "budgetAmount", "summary");
    }
    return { doc, provisional };
  }

  /**
   * A readable paragraph for a reader who never opens the PDF. Only facts the
   * portal actually published go in — nothing is inferred.
   */
  private buildSummary(
    type: MeaAnnounceType,
    row: MeaAnnouncement,
    budgetAmount: number | undefined,
    awardedAmount: number | undefined,
    closesAt: Date | null,
  ): string {
    return [
      `${type.label}ของ${MEA_AGENCY} เลขที่ ${cleanText(row.PUBLISH_NO ?? UNKNOWN)}`,
      budgetAmount ? `วงเงินงบประมาณ ${formatBaht(budgetAmount)}` : null,
      awardedAmount ? `ราคาที่ตกลงซื้อหรือจ้าง ${formatBaht(awardedAmount)}` : null,
      row.METHOD_DESC ? cleanText(row.METHOD_DESC) : null,
      closesAt ? `กำหนดปิดรับ ${formatThaiDate(closesAt)}` : null,
      row.WIN_NAME ? `ผู้ชนะการเสนอราคา: ${cleanText(row.WIN_NAME)}` : null,
      "รายละเอียดฉบับเต็มอยู่ในเอกสารประกาศจากเว็บไซต์จัดซื้อจัดจ้าง กฟน.",
    ]
      .filter(Boolean)
      .join(" · ");
  }
}
