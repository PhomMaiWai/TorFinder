import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { Collection, MongoClient } from "mongodb";

import { StoredExtraction } from "../ai/ai.types";
import { hashPassword } from "../common/password";
import { env } from "../config/env";
import { TOR_BUDGET_STATUSES, TOR_STAGES } from "../tor/tor.constants";
import { SEED_TORS, SEED_USERS } from "./seed-data";

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
  sourceUrl?: string;
  /**
   * What a model read out of the announcement document. Kept in its own field,
   * never merged into the ones above: those are what an agency published, this
   * is inferred, and the difference has to survive all the way to the reader.
   */
  extraction?: StoredExtraction;
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
   * Demo data so a fresh checkout shows the same thing for everyone. Each set is
   * seeded only when its collection is empty, so restarts never duplicate it and
   * anything you create by hand is left alone.
   */
  private async seed(): Promise<void> {
    if (!env.seedDemoData) return;
    await Promise.all([this.seedUsers(), this.seedTors()]);
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

  private async seedTors(): Promise<void> {
    if ((await this.tors.countDocuments()) > 0) return;

    const dayMs = 24 * 60 * 60 * 1000;
    const docs = SEED_TORS.map(({ daysAgo, ...tor }) => ({
      ...tor,
      match: 0,
      createdAt: new Date(Date.now() - daysAgo * dayMs),
    }));

    await this.tors.insertMany(docs);
    this.logger.log(`Seeded ${docs.length} demo TOR records`);
  }
}
