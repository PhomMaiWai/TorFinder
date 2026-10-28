import { Injectable, Logger } from "@nestjs/common";

import { Document } from "mongodb";

import { escapeRegex } from "../common/regex";
import { DatabaseService, SyncRunDoc, SyncRunStatus } from "../database/database.service";
import { ListAuditQueryDto } from "./dto/list-audit-query.dto";

export type AuditFeedEntry = {
  action: string;
  detail: string;
  actor: string;
  type: "manual" | "auto";
  date: string;
};

export type AuditFeedPage = {
  items: AuditFeedEntry[];
  total: number;
  page: number;
  pageSize: number;
  /** Every action label there is, for the filter. */
  actions: string[];
};

/** A feed row as the union yields it: a sync run keeps its raw fields until the page is cut. */
type FeedRow = Omit<AuditFeedEntry, "date" | "detail"> & {
  detail?: string;
  date: Date;
  run?: SyncRunDoc;
};

const SYNC_ACTOR = "e-GP Sync Bot";

const SYNC_ACTION_LABELS: Record<SyncRunStatus, string> = {
  success: "ซิงค์ข้อมูล e-GP สำเร็จ",
  partial: "ซิงค์ข้อมูล e-GP สำเร็จบางส่วน",
  failed: "ซิงค์ข้อมูล e-GP ล้มเหลว",
};

const DAY_MS = 86_400_000;

/** The start of a calendar day in Bangkok, where every admin reads the log. */
const bangkokDay = (day: string) => new Date(`${day}T00:00:00+07:00`);

/** The query's filters as a $match on the unioned feed; none set matches everything. */
function feedFilter({ action, actor, from, to }: ListAuditQueryDto): Document {
  const match: Document = {};
  if (action) match.action = action;
  if (actor?.trim()) match.actor = { $regex: escapeRegex(actor.trim()), $options: "i" };
  if (from || to) {
    match.date = {
      ...(from && { $gte: bangkokDay(from) }),
      // The whole of the last day: up to, not including, the next midnight.
      ...(to && { $lt: new Date(bangkokDay(to).getTime() + DAY_MS) }),
    };
  }
  return match;
}

/**
 * Reads back as one line: what came in, what changed, what didn't. Shared by
 * the recorded sync runs and the entries for an import an admin started.
 */
export function importDetail({ imported, updated, failed }: { imported: number; updated: number; failed: string[] }): string {
  const parts = [`นำเข้าใหม่ ${imported} รายการ`, `อัปเดต ${updated} รายการ`];
  if (failed.length > 0) parts.push(`ดึงข้อมูลล้มเหลว ${failed.length} แหล่ง`);
  return parts.join(" · ");
}

function syncDetail(run: SyncRunDoc): string {
  if (run.status === "failed") return run.error ?? "ไม่สามารถเชื่อมต่อระบบ e-GP ได้";
  return importDetail({ ...run, failed: run.failedFeeds });
}

/**
 * The admin dashboard's audit feed. Manual entries (see record()) come from
 * an admin doing something attributable — approving an account, moderating a
 * comment, adding, editing, hiding or restoring a TOR, starting an import, an
 * AI extraction or a budget refresh. Automatic entries are never written here:
 * e-GP sync runs already live in `syncRuns` (see EgpService), and are read
 * straight from there and merged in at query time, so there is exactly one
 * place a sync's outcome is stored.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly db: DatabaseService) {}

  /**
   * Records one attributable admin action. Best-effort: a logging hiccup must
   * never block (or fail) the action itself, same posture as EgpService's
   * sync-run recording.
   */
  async record(actor: string, action: string, detail: string): Promise<void> {
    try {
      await this.db.auditLogEntries.insertOne({ actor, action, detail, createdAt: new Date() });
    } catch (error) {
      this.logger.warn(`Failed to record audit log entry: ${String(error)}`);
    }
  }

  /**
   * One page of manual entries and e-GP sync runs together, newest first. The
   * two collections are unioned before filtering, so the page, the total and
   * every filter cover both — a sync run is found by its action label, the
   * bot's name or its day like any other entry.
   */
  async list(query: ListAuditQueryDto): Promise<AuditFeedPage> {
    const { page, pageSize } = query;

    const [result] = await this.db.auditLogEntries
      .aggregate<{ items: FeedRow[]; total: { count: number }[] }>([
        { $project: { _id: 0, action: 1, detail: 1, actor: 1, type: { $literal: "manual" }, date: "$createdAt" } },
        {
          $unionWith: {
            coll: this.db.syncRuns.collectionName,
            pipeline: [
              {
                $project: {
                  _id: 0,
                  action: {
                    $switch: {
                      branches: Object.entries(SYNC_ACTION_LABELS).map(([status, label]) => ({
                        case: { $eq: ["$status", status] },
                        then: label,
                      })),
                      default: SYNC_ACTION_LABELS.failed,
                    },
                  },
                  actor: { $literal: SYNC_ACTOR },
                  type: { $literal: "auto" },
                  date: "$startedAt",
                  run: { status: "$status", imported: "$imported", updated: "$updated", failedFeeds: "$failedFeeds", error: "$error" },
                },
              },
            ],
          },
        },
        { $match: feedFilter(query) },
        { $sort: { date: -1 } },
        {
          $facet: {
            items: [{ $skip: (page - 1) * pageSize }, { $limit: pageSize }],
            total: [{ $count: "count" }],
          },
        },
      ])
      .toArray();

    const actions = await this.db.auditLogEntries.distinct("action");

    return {
      total: result?.total[0]?.count ?? 0,
      page,
      pageSize,
      // What the action filter can offer: every label that has ever been written.
      actions: [...new Set([...actions, ...Object.values(SYNC_ACTION_LABELS)])].sort((a, b) => a.localeCompare(b, "th")),
      items: (result?.items ?? []).map(({ run, date, ...entry }) => ({
        ...entry,
        detail: run ? syncDetail(run) : (entry.detail ?? ""),
        date: date.toISOString(),
      })),
    };
  }
}
