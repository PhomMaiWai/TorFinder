import { Module } from "@nestjs/common";

import { AuditModule } from "../audit/audit.module";
import { DatabaseModule } from "../database/database.module";
import { TorModule } from "../tor/tor.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { EgpDocumentsController } from "./egp-documents.controller";
import { EgpDocumentsService } from "./egp-documents.service";
import { GprocClient } from "./gproc.client";
import { GprocController } from "./gproc.controller";
import { GprocScheduler } from "./gproc.scheduler";
import { GprocService } from "./gproc.service";

@Module({
  imports: [AuditModule, DatabaseModule, TorModule, NotificationsModule],
  controllers: [GprocController, EgpDocumentsController],
  providers: [GprocClient, GprocService, GprocScheduler, EgpDocumentsService],
  // The extractor reads signed invitations through the same client.
  exports: [GprocClient],
})
export class GprocModule {}
