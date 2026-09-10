import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Filter, ObjectId } from "mongodb";

import { DatabaseService, TorDoc } from "../database/database.service";
import { CreateTorDto } from "./dto/create-tor.dto";
import { TorSource } from "./dto/list-tor-query.dto";
import { UpdateTorDto } from "./dto/update-tor.dto";
import { isLikelyDuplicateTitle, isLikelySameAgency } from "./tor-dedup";

@Injectable()
export class TorService {
  constructor(private readonly db: DatabaseService) {}

  async create(dto: CreateTorDto) {
    const duplicate = await this.findLikelyDuplicate(dto.title, dto.agency);
    if (duplicate) {
      throw new ConflictException(
        `มีรายการ TOR ที่คล้ายกันอยู่แล้ว: "${duplicate.title}" (${duplicate._id.toString()})`,
      );
    }

    const doc = { ...dto, match: 0, createdAt: new Date() };
    // insertOne mutates what it is given by adding _id — pass a copy so the
    // response keeps exposing only `id`.
    const { insertedId } = await this.db.tors.insertOne({ ...doc });
    return { id: insertedId.toString(), ...doc };
  }

  /**
   * Admin-entered records have no project number to key off, so this is the
   * best signal available: same-ish title, same-ish agency, against every
   * live record regardless of which source created it.
   */
  private async findLikelyDuplicate(title: string, agency: string) {
    const candidates = await this.db.tors
      .find({ deletedAt: { $exists: false } }, { projection: { title: 1, agency: 1 } })
      .toArray();

    return candidates.find(
      (candidate) =>
        isLikelySameAgency(candidate.agency, agency) && isLikelyDuplicateTitle(candidate.title, title),
    );
  }

  async findAll(page = 1, pageSize = 20, source?: TorSource) {
    // Deleted records stay in the collection but out of every listing except
    // the one that exists to restore them.
    const filter: Filter<TorDoc> = { deletedAt: { $exists: false } };
    if (source) filter.sourceRef = { $exists: source === "egp" };

    const docs = await this.db.tors
      .find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .toArray();
    return docs.map(({ _id, ...rest }) => ({ id: _id.toString(), ...rest }));
  }

  async findOne(id: string) {
    const doc = ObjectId.isValid(id) ? await this.db.tors.findOne({ _id: new ObjectId(id) }) : null;
    if (!doc) throw new NotFoundException("ไม่พบรายการ TOR");
    const { _id, ...rest } = doc;
    return { id: _id.toString(), ...rest };
  }

  /** Hidden announcements, newest first — the restore view. */
  async findDeleted() {
    const docs = await this.db.tors
      .find({ deletedAt: { $exists: true } })
      .sort({ deletedAt: -1 })
      .toArray();
    return docs.map(({ _id, ...rest }) => ({ id: _id.toString(), ...rest }));
  }

  /**
   * Hides an announcement without destroying it. Nothing about a public
   * procurement notice should be unrecoverable by a single click, so the record
   * keeps its data and only gains a timestamp.
   */
  async softDelete(id: string) {
    return this.setDeletedAt(id, new Date());
  }

  async restore(id: string) {
    return this.setDeletedAt(id, null);
  }

  private async setDeletedAt(id: string, deletedAt: Date | null) {
    if (!ObjectId.isValid(id)) throw new NotFoundException("ไม่พบรายการ TOR");

    const result = await this.db.tors.findOneAndUpdate(
      { _id: new ObjectId(id) },
      deletedAt ? { $set: { deletedAt } } : { $unset: { deletedAt: "" } },
      { returnDocument: "after" },
    );
    if (!result) throw new NotFoundException("ไม่พบรายการ TOR");

    const { _id, ...rest } = result;
    return { id: _id.toString(), ...rest };
  }

  async update(id: string, dto: UpdateTorDto) {
    if (!ObjectId.isValid(id)) throw new NotFoundException("ไม่พบรายการ TOR");

    // Mongo's driver serializes `undefined` values as null in $set, which would
    // wipe out fields the caller never touched — so only send the ones present.
    const updates = Object.fromEntries(Object.entries(dto).filter(([, v]) => v !== undefined));

    const result = await this.db.tors.findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: updates },
      { returnDocument: "after" },
    );
    if (!result) throw new NotFoundException("ไม่พบรายการ TOR");

    const { _id, ...rest } = result;
    return { id: _id.toString(), ...rest };
  }
}
