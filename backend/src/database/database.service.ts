import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { Collection, MongoClient } from "mongodb";

import { hashPassword } from "../common/password";
import { env } from "../config/env";

export type UserDoc = {
  email: string;
  name: string;
  role: "admin" | "org";
  passwordHash: string;
  passwordSalt: string;
  createdAt: Date;
};

const SEED_USERS = [
  { email: "admin@bma.go.th", name: "ผู้ดูแลระบบ", role: "admin", password: "Admin1234!" },
  { email: "contact@arundigital.co.th", name: "Arun Digital", role: "org", password: "Org12345!" },
] as const;

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  private readonly client = new MongoClient(env.mongodbUri);

  users!: Collection<UserDoc>;

  async onModuleInit(): Promise<void> {
    await this.client.connect();
    this.users = this.client.db().collection<UserDoc>("users");
    await this.users.createIndex({ email: 1 }, { unique: true });
    await this.seed();
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.close();
  }

  // Demo-only seed data — replace with a real signup flow when one exists.
  private async seed(): Promise<void> {
    const count = await this.users.countDocuments();
    if (count > 0) return;

    for (const user of SEED_USERS) {
      const { hash, salt } = await hashPassword(user.password);
      await this.users.insertOne({
        email: user.email,
        name: user.name,
        role: user.role,
        passwordHash: hash,
        passwordSalt: salt,
        createdAt: new Date(),
      });
    }
    this.logger.log(`Seeded ${SEED_USERS.length} demo users`);
  }
}
