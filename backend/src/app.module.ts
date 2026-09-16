import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";

import { AccountsModule } from "./accounts/accounts.module";
import { ActivityModule } from "./activity/activity.module";
import { AuthModule } from "./auth/auth.module";
import { env } from "./config/env";
import { DatabaseModule } from "./database/database.module";
import { AiModule } from "./ai/ai.module";
import { DataGovModule } from "./datagov/datagov.module";
import { EgpModule } from "./egp/egp.module";
import { FeedbackModule } from "./feedback/feedback.module";
import { MeaModule } from "./mea/mea.module";
import { MatchingModule } from "./matching/matching.module";
import { HealthController } from "./health.controller";
import { NotificationsModule } from "./notifications/notifications.module";
import { SavedTorsModule } from "./saved-tors/saved-tors.module";
import { TorModule } from "./tor/tor.module";

@Module({
  imports: [
    ThrottlerModule.forRoot([
      { name: "default", ttl: env.throttle.ttlMs, limit: env.throttle.limit },
    ]),
    DatabaseModule,
    AuthModule,
    AccountsModule,
    ActivityModule,
    TorModule,
    AiModule,
    EgpModule,
    DataGovModule,
    MeaModule,
    FeedbackModule,
    MatchingModule,
    SavedTorsModule,
    NotificationsModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
