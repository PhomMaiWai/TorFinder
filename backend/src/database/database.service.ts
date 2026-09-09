import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { Collection, MongoClient } from "mongodb";

import { StoredExtraction } from "../ai/ai.types";
import { hashPassword } from "../common/password";
import { env } from "../config/env";
import { TOR_BUDGET_STATUSES, TOR_STAGES } from "../tor/tor.constants";
import { SEED_USERS } from "./seed-data";

export const ACCOUNT_STATUSES = ["pending", "approved", "rejected"] as const;
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

export type CompanyProfile = {
  companyName: string;
  taxId: string;
  contactName: string;
  phone: string;
  address: string;
  specialty: string;
  size: string;
};

export type UserDoc = {
  email: string;
  name: string;
  role: "admin" | "org";
  /** Organizations sign themselves up and stay pending until an admin approves. */
  status: AccountStatus;
  passwordHash: string;
  passwordSalt: string;
  createdAt: Date;
  company?: CompanyProfile;
  reviewedAt?: Date;
};

export type TorDoc = {
  title: string;
  agency: string;
  budget: string;
  deadline: string;
  daysLeft: number;
  match: number;
  tags: string[];
  stage: (typeof TOR_STAGES)[number];
  summary: string;
  budgetStatus?: (typeof TOR_BUDGET_STATUSES)[number];
  createdAt: Date;
  /** Set only on records imported from e-GP; absent on admin-entered ones. */
  sourceRef?: string;
  /** The record's own document when e-GP has one; otherwise the project's listing page. */
  sourceUrl?: string;
  /**
   * What a model read out of the announcement document. Kept in its own field,
   * never merged into the ones above: those are what an agency published, this
   * is inferred, and the difference has to survive all the way to the reader.
   */
  extraction?: StoredExtraction;
  /** e-GP's own project number, printed on every announcement of the project. */
  projectNumber?: string;
  /** Raw budget in baht, next to the formatted `budget` string. */
  budgetAmount?: number;
  /** Every announcement e-GP holds for the project, newest first. */
  documents?: { label: string; publishedAt: Date | null; url: string }[];
  /** Structured facts the portal has on file for the project — real, not inferred. */
  procurementMethod?: string;
  procurementType?: string;
  goodsCategory?: string;
  contractStatus?: string;
  /**
   * Set once the e-GP document link and procurement facts have actually been
   * fetched (even if the portal had none to give). Absent means enrichment was
   * skipped — budget ran out, or the request timed out — so it's retried on the
   * next sync instead of being treated as "already have this".
   */
  enrichedAt?: Date;
  /** Which generation of enrichment produced the fields above (see EgpService). */
  enrichVersion?: number;
};

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  private readonly client = new MongoClient(env.mongodbUri);

  users!: Collection<UserDoc>;
  tors!: Collection<TorDoc>;

  async onModuleInit(): Promise<void> {
    await this.client.connect();
    this.users = this.client.db().collection<UserDoc>("users");
    this.tors = this.client.db().collection<TorDoc>("tors");
    await this.users.createIndex({ email: 1 }, { unique: true });
    await this.users.createIndex({ status: 1, createdAt: -1 });
    await this.tors.createIndex({ createdAt: -1 });
    // Makes the e-GP import idempotent: re-running it updates instead of duplicating.
    await this.tors.createIndex({ sourceRef: 1 }, { unique: true, sparse: true });
    await this.backfillAccountStatus();
    await this.seed();
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.close();
  }

  /** Accounts created before approvals existed were already in use, so they count as approved. */
  private async backfillAccountStatus(): Promise<void> {
    const { modifiedCount } = await this.users.updateMany(
      { status: { $exists: false } },
      { $set: { status: "approved" } },
    );
    if (modifiedCount > 0) this.logger.log(`Backfilled status on ${modifiedCount} accounts`);
  }

  /**
   * Demo accounts only, and only when the collection is empty. TOR records are
   * never seeded: the public pages show real e-GP announcements, so fake ones
   * would be indistinguishable from the imported data.
   */
  private async seed(): Promise<void> {
    if (!env.seedDemoData) return;
    await this.seedUsers();
  }

  private async seedUsers(): Promise<void> {
    if ((await this.users.countDocuments()) > 0) return;

    const docs = await Promise.all(
      SEED_USERS.map(async ({ password, ...user }) => {
        const { hash, salt } = await hashPassword(password);
        return { ...user, passwordHash: hash, passwordSalt: salt, createdAt: new Date() };
      }),
    );

    await this.users.insertMany(docs);
    this.logger.log(`Seeded ${docs.length} demo users`);
  }
}
