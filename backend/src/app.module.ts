import { Module } from "@nestjs/common";
import { APP_FILTER, APP_GUARD } from "@nestjs/core";
import { ThrottlerModule } from "@nestjs/throttler";

import { AccountsModule } from "./accounts/accounts.module";
import { AuditModule } from "./audit/audit.module";
import { AuthModule } from "./auth/auth.module";
import { CertificatesModule } from "./certificates/certificates.module";
import { AllExceptionsFilter } from "./common/all-exceptions.filter";
import { LoggingThrottlerGuard } from "./common/logging-throttler.guard";
import { env } from "./config/env";
import { DatabaseModule } from "./database/database.module";
import { AiModule } from "./ai/ai.module";
import { DataGovModule } from "./datagov/datagov.module";
import { EgpModule } from "./egp/egp.module";
import { FeedbackModule } from "./feedback/feedback.module";
import { GprocModule } from "./gproc/gproc.module";
import { MeaModule } from "./mea/mea.module";
import { MatchingModule } from "./matching/matching.module";
import { HealthController } from "./health.controller";
import { InsightsModule } from "./insights/insights.module";
import { LibraryModule } from "./library/library.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { OwnerModule } from "./owner/owner.module";
import { ReportsModule } from "./reports/reports.module";
import { SavedSearchesModule } from "./saved-searches/saved-searches.module";
import { SavedTorsModule } from "./saved-tors/saved-tors.module";
import { SimilarModule } from "./similar/similar.module";
import { TorModule } from "./tor/tor.module";

@Module({
  imports: [
    ThrottlerModule.forRoot([
      { name: "default", ttl: env.throttle.ttlMs, limit: env.throttle.limit },
    ]),
    DatabaseModule,
    AuthModule,
    AuditModule,
    AccountsModule,
    CertificatesModule,
    LibraryModule,
    TorModule,
    SimilarModule,
    AiModule,
    EgpModule,
    DataGovModule,
    MeaModule,
    GprocModule,
    FeedbackModule,
    ReportsModule,
    MatchingModule,
    OwnerModule,
    SavedSearchesModule,
    SavedTorsModule,
    NotificationsModule,
    InsightsModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: LoggingThrottlerGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
