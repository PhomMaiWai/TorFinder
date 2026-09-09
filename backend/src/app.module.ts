import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";

import { AccountsModule } from "./accounts/accounts.module";
import { AuthModule } from "./auth/auth.module";
import { env } from "./config/env";
import { DatabaseModule } from "./database/database.module";
import { EgpModule } from "./egp/egp.module";
import { HealthController } from "./health.controller";
import { TorModule } from "./tor/tor.module";

@Module({
  imports: [
    ThrottlerModule.forRoot([
      { name: "default", ttl: env.throttle.ttlMs, limit: env.throttle.limit },
    ]),
    DatabaseModule,
    AuthModule,
    AccountsModule,
    TorModule,
    EgpModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
