import { Module } from "@nestjs/common";

import { AuditModule } from "../audit/audit.module";
import { DatabaseModule } from "../database/database.module";
import { GprocModule } from "../gproc/gproc.module";
import { MatchingModule } from "../matching/matching.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { AiController } from "./ai.controller";
import { ExtractionScheduler } from "./extraction.scheduler";
import { ExtractionService } from "./extraction.service";
import { ProposalService } from "./proposal.service";
import { VertexClient } from "./vertex.client";

@Module({
  imports: [AuditModule, DatabaseModule, GprocModule, NotificationsModule, MatchingModule],
  controllers: [AiController],
  providers: [VertexClient, ExtractionService, ExtractionScheduler, ProposalService],
  exports: [VertexClient, ExtractionService],
})
export class AiModule {}
