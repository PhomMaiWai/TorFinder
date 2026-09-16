import { Injectable, Logger } from "@nestjs/common";
import { ObjectId } from "mongodb";

import { DatabaseService, TorDoc } from "../database/database.service";
import { MatchingService } from "../matching/matching.service";
import { TorDedupIndex } from "./tor-dedup-index";
import { TorImportSource, sourceOf, sourceRank } from "./tor.constants";

/** A record a source has normalized into the shape the database stores. */
export type ImportedTor = TorDoc & { sourceRef: string };

export type ImportRecord = {
  doc: ImportedTor;
  /**
   * Fields of `doc` this run could only guess at, because the source's
   * enrichment step was skipped or failed — a listing-page link instead of the
   * document, the utility's name without the department that bought. A guess
   * beats an empty field on a record being created and loses to what a
   * better-informed run already stored, so these are written on insert only.
   */
  provisional?: readonly (keyof TorDoc)[];
};

/** What a source's own sync reports: the import, plus what it couldn't fetch. */
export type SyncResult = ImportResult & { failed: string[] };

/** One line describing a sync, for whoever triggered it — a scheduler, a log. */
export function summarizeSync({ imported, updated, skipped, superseded, failed }: SyncResult): string {
  return [
    `${imported} new, ${updated} updated`,
    skipped ? `${skipped} already published elsewhere` : null,
    superseded ? `${superseded} superseded` : null,
    failed.length ? `${failed.length} feed(s) failed` : null,
  ]
    .filter(Boolean)
    .join(", ");
}

export type ImportResult = {
  fetched: number;
  imported: number;
  updated: number;
  /** Already published by a source this one doesn't outrank. */
  skipped: number;
  /** Worse copies of the same project, dropped in favour of this source's. */
  superseded: number;
};

/** What the duplicate check needs to know about a record already in the database. */
type StoredRecord = {
  _id: ObjectId;
  title: string;
  agency: string;
  stage: string;
  projectNumber?: string;
  sourceRef?: string;
};

/**
 * The same real project reaches us once per portal, and each portal splits it
 * into one announcement per stage — so identity is the project *and* the stage,
 * never the project alone.
 */
const identity = (projectNumber: string, stage: string) => `${projectNumber}|${stage}`;

/**
 * The half of an import every source shares: decide what is genuinely new,
 * drop what another source already published better, and write the rest.
 * Fetching and normalizing is each source's own business; everything from
 * there on is identical, and duplicated logic across three importers is how
 * the same project ends up in the listings three times.
 */
@Injectable()
export class TorImportService {
  private readonly logger = new Logger(TorImportService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly matching: MatchingService,
  ) {}

  async import(source: TorImportSource, records: ImportRecord[]): Promise<ImportResult> {
    const unique = collapseDuplicates(records);
    if (unique.length === 0) {
      return { fetched: 0, imported: 0, updated: 0, skipped: 0, superseded: 0 };
    }

    const known = await this.knownRefs(unique);
    const { accepted, skipped, superseded } = await this.resolveDuplicates(
      source,
      unique.filter((record) => !known.has(record.doc.sourceRef)),
    );

    const writes = [...unique.filter((record) => known.has(record.doc.sourceRef)), ...accepted];
    // Every record can be a duplicate of something already published — an
    // empty batch is a legitimate outcome, and one Mongo refuses to be handed.
    if (writes.length === 0) {
      this.logger.log(`${source}: nothing to write — ${skipped} already published elsewhere`);
      return { fetched: unique.length, imported: 0, updated: 0, skipped, superseded: 0 };
    }

    const result = await this.db.tors.bulkWrite(
      writes.map((record) => ({ updateOne: { ...upsertFor(record), upsert: true } })),
      { ordered: false },
    );

    if (superseded.length) {
      await this.db.tors.deleteMany({ _id: { $in: superseded } });
    }
    // The budget verdict is relative to every other announcement, so an import
    // that adds or removes records invalidates the stored ones.
    await this.matching.refreshBudgetStatuses();

    this.logger.log(
      `${source}: ${result.upsertedCount} new, ${result.modifiedCount} updated, ` +
        `${skipped} already published elsewhere, ${superseded.length} superseded`,
    );

    return {
      fetched: unique.length,
      imported: result.upsertedCount,
      updated: result.modifiedCount,
      skipped,
      superseded: superseded.length,
    };
  }

  /**
   * Drops the records this source would no longer import. Earlier runs — and
   * looser rules — left announcements behind that don't belong here any more,
   * and an imported record is disposable because the portal remains the source
   * of truth. `keep` is the source's own rule, so what the import refuses and
   * what the database holds can never drift apart. Admin-entered records have
   * no `sourceRef` and are never touched.
   */
  async purge(source: TorImportSource, keep: (doc: TorDoc) => boolean): Promise<number> {
    const imported = await this.db.tors
      .find(
        { sourceRef: { $regex: `^${source}:` } },
        { projection: { title: 1, agency: 1, goodsCategory: 1 } },
      )
      .toArray();

    const stale = imported.filter((doc) => !keep(doc as TorDoc)).map((doc) => doc._id);
    if (!stale.length) return 0;

    const { deletedCount } = await this.db.tors.deleteMany({ _id: { $in: stale } });
    this.logger.log(`${source}: removed ${deletedCount} records it would no longer import`);
    return deletedCount;
  }

  /**
   * Refs whose stored record already holds enrichment of this generation.
   * Enrichment costs a request per announcement, so a source fetches it only
   * for what hasn't been enriched yet — and refetches everything once when it
   * starts collecting something new and bumps its version.
   */
  async enrichedRefs(sourceRefs: string[], version: number): Promise<Set<string>> {
    const existing = await this.db.tors
      .find(
        { sourceRef: { $in: sourceRefs }, enrichedAt: { $exists: true }, enrichVersion: version },
        { projection: { sourceRef: 1 } },
      )
      .toArray();
    return new Set(existing.map((doc) => doc.sourceRef).filter((ref) => ref !== undefined));
  }

  /** Records this source has imported before — an update, not a new arrival. */
  private async knownRefs(records: ImportRecord[]): Promise<Set<string>> {
    const existing = await this.db.tors
      .find(
        { sourceRef: { $in: records.map((record) => record.doc.sourceRef) } },
        { projection: { sourceRef: 1 } },
      )
      .toArray();
    return new Set(existing.map((doc) => doc.sourceRef).filter((ref) => ref !== undefined));
  }

  /**
   * Which of the genuinely new records may be written. A project already in the
   * database can have arrived from another portal, or been typed in by an
   * admin: the copy from the better-placed source wins, and the other one is
   * either skipped before it is written or removed after.
   *
   * Two ways to recognise the same project. The e-GP project number is exact
   * and is carried — or can be dug out of the announcement number — by all
   * three portals, so it decides whenever both sides have one. Only what is
   * left over falls back to comparing titles.
   */
  private async resolveDuplicates(
    source: TorImportSource,
    fresh: ImportRecord[],
  ): Promise<{ accepted: ImportRecord[]; skipped: number; superseded: ObjectId[] }> {
    if (fresh.length === 0) return { accepted: [], skipped: 0, superseded: [] };

    // Only the stages this batch can collide with: identity is project + stage,
    // so a draft is never compared against an award, and on a source that only
    // publishes one stage this leaves most of the collection unread.
    const stages = [...new Set(fresh.map((record) => record.doc.stage))];

    const stored = (await this.db.tors
      .find(
        { deletedAt: { $exists: false }, stage: { $in: stages } },
        { projection: { title: 1, agency: 1, stage: 1, projectNumber: 1, sourceRef: 1 } },
      )
      .toArray()) as StoredRecord[];

    const byIdentity = new Map<string, StoredRecord>();
    // Per stage, not one index over everything: a project's draft and its
    // invitation are worded almost identically on purpose, and they are two
    // announcements a company wants to see, not one record duplicated.
    const byStage = new Map<string, StoredRecord[]>();

    for (const record of stored) {
      if (record.projectNumber) byIdentity.set(identity(record.projectNumber, record.stage), record);
      const bucket = byStage.get(record.stage);
      if (bucket) bucket.push(record);
      else byStage.set(record.stage, [record]);
    }

    const titleIndexes = new Map<string, TorDedupIndex<StoredRecord>>();
    const byTitle = (stage: string) => {
      const existing = titleIndexes.get(stage);
      if (existing) return existing;
      const index = new TorDedupIndex(byStage.get(stage) ?? []);
      titleIndexes.set(stage, index);
      return index;
    };

    const incomingRank = sourceRank(source);
    const accepted: ImportRecord[] = [];
    const superseded: ObjectId[] = [];
    let skipped = 0;

    for (const record of fresh) {
      const { projectNumber, stage, title, agency } = record.doc;
      const duplicate =
        (projectNumber ? byIdentity.get(identity(projectNumber, stage)) : null) ??
        byTitle(stage).find(title, agency);

      if (!duplicate) {
        accepted.push(record);
        continue;
      }
      if (sourceRank(sourceOf(duplicate.sourceRef)) >= incomingRank) {
        skipped++;
        continue;
      }
      superseded.push(duplicate._id);
      accepted.push(record);
    }

    return { accepted, skipped, superseded };
  }
}

/**
 * Collapses a batch onto one record per announcement. A source lists the same
 * announcement under several searches — same ref, trivially the same record —
 * and MEA also files the occasional announcement twice under two ids, which
 * only its project number and stage give away. First copy wins either way.
 */
function collapseDuplicates(records: ImportRecord[]): ImportRecord[] {
  const seen = new Set<string>();
  const collapsed: ImportRecord[] = [];

  for (const record of records) {
    const { sourceRef, projectNumber, stage } = record.doc;
    const keys = [sourceRef, projectNumber ? identity(projectNumber, stage) : null].filter(
      (key) => key !== null,
    );
    if (keys.some((key) => seen.has(key))) continue;

    for (const key of keys) seen.add(key);
    collapsed.push(record);
  }
  return collapsed;
}

/**
 * The upsert for one record: what the portal says now goes to `$set`, and what
 * this run had to guess — plus the identity, which must never drift — goes to
 * `$setOnInsert`. Undefined values are dropped rather than written, because the
 * driver serializes `undefined` as an explicit null.
 */
function upsertFor({ doc, provisional }: ImportRecord) {
  const { createdAt, sourceRef, ...fields } = doc;
  const set: Record<string, unknown> = {};
  const setOnInsert: Record<string, unknown> = { createdAt, sourceRef };

  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) continue;
    if (provisional?.includes(key as keyof TorDoc)) setOnInsert[key] = value;
    else set[key] = value;
  }

  return {
    filter: { sourceRef },
    // Mongo rejects an empty operator, and a record whose every field was a
    // guess leaves nothing to $set.
    update: Object.keys(set).length ? { $set: set, $setOnInsert: setOnInsert } : { $setOnInsert: setOnInsert },
  };
}
