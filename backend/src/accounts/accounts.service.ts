import { Injectable, NotFoundException } from "@nestjs/common";
import { Filter, ObjectId } from "mongodb";

import { AccountStatus, DatabaseService, UserDoc } from "../database/database.service";
import { ReviewAccountDto } from "./dto/review-account.dto";
import { UpdateCompanyProfileDto } from "./dto/update-company-profile.dto";

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

  async findOwn(userId: string) {
    if (!ObjectId.isValid(userId)) throw new NotFoundException("ไม่พบบัญชีนี้");

    const doc = await this.db.users.findOne({ _id: new ObjectId(userId) }, { projection: PUBLIC_FIELDS });
    if (!doc) throw new NotFoundException("ไม่พบบัญชีนี้");

    const { _id, ...rest } = doc;
    return { id: _id.toString(), ...rest };
  }

  /**
   * companyName/taxId are normally fixed at signup — but a Google sign-up
   * never collects them (see AuthService.googleAuth), so they start blank on
   * those accounts. This allows a one-time fill for whichever of the two is
   * still blank, then locks it exactly like every other signup path.
   */
  private static readonly LOCKED_ONCE_SET = ["companyName", "taxId"] as const;

  async updateOwn(userId: string, dto: UpdateCompanyProfileDto) {
    if (!ObjectId.isValid(userId)) throw new NotFoundException("ไม่พบบัญชีนี้");

    const current = await this.db.users.findOne(
      { _id: new ObjectId(userId), role: "org" },
      { projection: { company: 1 } },
    );
    if (!current) throw new NotFoundException("ไม่พบบัญชีนี้");

    const filtered = { ...dto };
    for (const field of AccountsService.LOCKED_ONCE_SET) {
      if (current.company?.[field]) delete filtered[field];
    }

    const updates = Object.fromEntries(
      Object.entries(filtered)
        .filter(([, v]) => v !== undefined)
        .map(([key, v]) => [`company.${key}`, v]),
    );

    const result =
      Object.keys(updates).length > 0
        ? await this.db.users.findOneAndUpdate(
            { _id: new ObjectId(userId), role: "org" },
            { $set: updates },
            { returnDocument: "after", projection: PUBLIC_FIELDS },
          )
        : await this.db.users.findOne({ _id: new ObjectId(userId), role: "org" }, { projection: PUBLIC_FIELDS });
    if (!result) throw new NotFoundException("ไม่พบบัญชีนี้");

    const { _id, ...rest } = result;
    return { id: _id.toString(), ...rest };
  }
}
