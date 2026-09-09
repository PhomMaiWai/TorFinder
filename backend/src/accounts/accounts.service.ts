import { Injectable, NotFoundException } from "@nestjs/common";
import { Filter, ObjectId } from "mongodb";

import { AccountStatus, DatabaseService, UserDoc } from "../database/database.service";
import { ReviewAccountDto } from "./dto/review-account.dto";

/** Never let password material leave the service. */
const PUBLIC_FIELDS = {
  email: 1,
  name: 1,
  status: 1,
  createdAt: 1,
  reviewedAt: 1,
  company: 1,
} as const;

@Injectable()
export class AccountsService {
  constructor(private readonly db: DatabaseService) {}

  async findAll(status?: AccountStatus) {
    const filter: Filter<UserDoc> = { role: "org" };
    if (status) filter.status = status;

    const docs = await this.db.users
      .find(filter, { projection: PUBLIC_FIELDS })
      .sort({ createdAt: -1 })
      .toArray();

    return docs.map(({ _id, ...rest }) => ({ id: _id.toString(), ...rest }));
  }

  async review(id: string, { status }: ReviewAccountDto) {
    if (!ObjectId.isValid(id)) throw new NotFoundException("ไม่พบบัญชีนี้");

    const result = await this.db.users.findOneAndUpdate(
      { _id: new ObjectId(id), role: "org" },
      { $set: { status, reviewedAt: new Date() } },
      { returnDocument: "after", projection: PUBLIC_FIELDS },
    );
    if (!result) throw new NotFoundException("ไม่พบบัญชีนี้");

    const { _id, ...rest } = result;
    return { id: _id.toString(), ...rest };
  }
}
