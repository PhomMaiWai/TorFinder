import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { MongoServerError, ObjectId, WithId } from "mongodb";

import { DatabaseService, SavedSearchDoc } from "../database/database.service";
import { CreateSavedSearchDto } from "./dto/create-saved-search.dto";

const DUPLICATE_KEY = 11000;

/** Enough for anyone's real set of searches; stops a script filling the collection. */
export const MAX_SAVED_SEARCHES = 50;

const toView = ({ _id, name, filters, createdAt }: WithId<SavedSearchDoc>) => ({
  id: _id.toString(),
  name,
  filters,
  createdAt,
});

/** Each account's own searches. Every query is scoped by userId: nobody reads or deletes another's. */
@Injectable()
export class SavedSearchesService {
  constructor(private readonly db: DatabaseService) {}

  async findOwn(userId: string) {
    const docs = await this.db.savedSearches
      .find({ userId: new ObjectId(userId) })
      .sort({ createdAt: -1 })
      .toArray();
    return docs.map(toView);
  }

  /** Names are unique per account, so the saved list never shows two searches it can't tell apart. */
  async create(userId: string, { name, filters }: CreateSavedSearchDto) {
    const owner = new ObjectId(userId);
    if (
      (await this.db.savedSearches.countDocuments({ userId: owner })) >=
      MAX_SAVED_SEARCHES
    ) {
      throw new ConflictException(
        `บันทึกการค้นหาได้สูงสุด ${MAX_SAVED_SEARCHES} รายการ กรุณาลบรายการเก่าก่อน`,
      );
    }

    // A plain object, not the DTO instance, so only the validated fields are stored.
    const doc: SavedSearchDoc = {
      userId: owner,
      name,
      filters: { ...filters },
      createdAt: new Date(),
    };
    try {
      const { insertedId } = await this.db.savedSearches.insertOne(doc);
      return toView({ _id: insertedId, ...doc });
    } catch (error) {
      if (error instanceof MongoServerError && error.code === DUPLICATE_KEY) {
        throw new ConflictException("มีการค้นหาที่บันทึกไว้ชื่อนี้แล้ว");
      }
      throw error;
    }
  }

  /** Someone else's id answers exactly like a missing one. */
  async remove(userId: string, id: string): Promise<void> {
    if (!ObjectId.isValid(id))
      throw new NotFoundException("ไม่พบการค้นหาที่บันทึกไว้");
    const { deletedCount } = await this.db.savedSearches.deleteOne({
      _id: new ObjectId(id),
      userId: new ObjectId(userId),
    });
    if (deletedCount === 0)
      throw new NotFoundException("ไม่พบการค้นหาที่บันทึกไว้");
  }
}
